'use strict';

/**
 * In-memory last-known-good MikroTik status for the admin dashboard.
 *
 * Why this exists: the dashboard badge used to race a fresh RouterOS probe
 * against a 1500 ms deadline on every poll. From Render's datacenter the
 * router answers in many seconds, so the badge always showed the router
 * "Unavailable" even though the router itself was up. A slow path is not
 * a dead router, so the probe now runs in the background with a generous
 * deadline and the dashboard serves the last-known status immediately.
 *
 * Rules (the badge must reflect the ROUTER's real state, nothing else):
 * - Online  — a probe succeeded within the staleness window (120 s).
 * - Checking — no probe has ever succeeded and none has failed yet
 *   (e.g. the first probe is still running after a server restart).
 * - Offline — ONLY when a probe actually failed (connection error or the
 *   generous deadline expired) after the last success, or when the last
 *   success is older than the staleness window. A slow probe never
 *   flips the badge to Offline on its own.
 *
 * No database writes: all state lives in this module. The prober uses its
 * own MikroTikService instance (its own API session and operation queue),
 * so a long probe never blocks interactive router operations.
 */

const DEFAULT_PROBE_INTERVAL_MS = 30000;
const DEFAULT_PROBE_TIMEOUT_MS = 30000;
const DEFAULT_STALE_WINDOW_MS = 120000;
const MAX_TIMEOUT_MS = 60000;

let timer = null;
let started = false;
let inFlight = null;
let client = null;
let probeIntervalMs = DEFAULT_PROBE_INTERVAL_MS;
let probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS;
let staleWindowMs = DEFAULT_STALE_WINDOW_MS;

function freshState() {
  return {
    lastSuccessAt: null,
    lastFailureAt: null,
    lastAttemptAt: null,
    lastError: null,
    consecutiveFailures: 0,
    data: null
  };
}

let state = freshState();

function normaliseMs(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(parsed, max));
}

function defaultClient() {
  const { MikroTikService } = require('./mikrotikService');
  return new MikroTikService();
}

function deriveState(nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  if (state.lastSuccessAt !== null) {
    if (state.lastFailureAt !== null && state.lastFailureAt > state.lastSuccessAt) return 'offline';
    if (now - state.lastSuccessAt > staleWindowMs) return 'offline';
    return 'online';
  }
  if (state.lastFailureAt !== null) return 'offline';
  return 'checking';
}

function getRouterStatusSnapshot(nowMs) {
  const now = Number.isFinite(nowMs) ? nowMs : Date.now();
  const status = deriveState(now);
  return {
    state: status,
    online: status === 'online' ? true : status === 'offline' ? false : null,
    lastSeenAt: state.lastSuccessAt ? new Date(state.lastSuccessAt).toISOString() : null,
    lastAttemptAt: state.lastAttemptAt ? new Date(state.lastAttemptAt).toISOString() : null,
    lastError: state.lastError,
    ageMs: state.lastSuccessAt ? now - state.lastSuccessAt : null,
    consecutiveFailures: state.consecutiveFailures,
    data: state.data
  };
}

function firstErrorMessage(results) {
  for (const result of results) {
    if (result && result.status === 'rejected') {
      const reason = result.reason;
      if (reason && reason.message) return reason.message;
      if (reason) return String(reason);
    }
  }
  return 'Router resource and identity queries failed.';
}

async function probeOnce() {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    state.lastAttemptAt = Date.now();
    const timeoutOpts = {
      operationTimeoutMs: probeTimeoutMs,
      handshakeTimeoutMs: probeTimeoutMs
    };
    try {
      const [resourcesResult, interfacesResult, sessionsResult, identityResult] = await Promise.allSettled([
        client.getSystemResources(timeoutOpts),
        client.getInterfaces(timeoutOpts),
        client.getActiveSessions(timeoutOpts),
        client.testConnection(undefined, timeoutOpts)
      ]);
      const resources = resourcesResult.status === 'fulfilled' ? resourcesResult.value : null;
      const interfaces = interfacesResult.status === 'fulfilled' && Array.isArray(interfacesResult.value)
        ? interfacesResult.value
        : null;
      const sessions = sessionsResult.status === 'fulfilled' && Array.isArray(sessionsResult.value)
        ? sessionsResult.value
        : null;
      const identity = identityResult.status === 'fulfilled' ? identityResult.value : null;
      // The verdict is "can we reach the router", so it rests on the
      // resource/identity queries only. A failed session or interface
      // list must never mark a reachable router Offline.
      if (!resources && !identity) {
        throw new Error(firstErrorMessage([resourcesResult, identityResult]));
      }
      // Traffic for the aggregate interface set is best effort: it fills
      // in when it can and never affects the verdict.
      const trafficByInterface = { ...(state.data ? state.data.trafficByInterface || {} : {}) };
      const names = (interfaces || [])
        .filter((item) => item && item.running && !item.disabled
          && /^(ether|sfp|sfp-sfpplus|sfpplus|lte)/i.test(item.name || '')
          && !/pppoe|loopback/i.test(item.name || ''))
        .slice(0, 8)
        .map((item) => item.name);
      await Promise.all(names.map(async (name) => {
        try {
          const traffic = await client.getInterfaceTraffic(name, timeoutOpts);
          if (traffic) trafficByInterface[name] = traffic;
        } catch (_) {
          // Keep the previous value for this interface.
        }
      }));
      state.data = {
        resources,
        interfaces: interfaces || (state.data ? state.data.interfaces || [] : []),
        // Sessions are stored as-is: null when the session list failed to
        // load, so the dashboard reports "unavailable" instead of "0 online".
        sessions,
        identity,
        trafficByInterface
      };
      state.lastSuccessAt = Date.now();
      state.lastError = null;
      state.consecutiveFailures = 0;
    } catch (error) {
      state.lastFailureAt = Date.now();
      state.lastError = error && error.message ? error.message : String(error);
      state.consecutiveFailures += 1;
      console.warn('[Router Status] Probe failed:', state.lastError);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

function startRouterStatusProber(options = {}) {
  if (started) return { started: true };
  probeIntervalMs = normaliseMs(options.intervalMs, DEFAULT_PROBE_INTERVAL_MS, 5000, 3600000);
  probeTimeoutMs = normaliseMs(options.timeoutMs, DEFAULT_PROBE_TIMEOUT_MS, 1000, MAX_TIMEOUT_MS);
  staleWindowMs = normaliseMs(options.staleWindowMs, DEFAULT_STALE_WINDOW_MS, 10000, 3600000);
  client = options.client || defaultClient();
  started = true;
  void probeOnce();
  timer = setInterval(() => { void probeOnce(); }, probeIntervalMs);
  if (timer && typeof timer.unref === 'function') timer.unref();
  return { started: true };
}

async function stopRouterStatusProber() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  started = false;
  if (inFlight) {
    try { await inFlight; } catch (_) {}
  }
  if (client && typeof client.close === 'function') {
    try { await client.close(); } catch (_) {}
  }
  client = null;
  state = freshState();
  probeIntervalMs = DEFAULT_PROBE_INTERVAL_MS;
  probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS;
  staleWindowMs = DEFAULT_STALE_WINDOW_MS;
  return { stopped: true };
}

module.exports = {
  startRouterStatusProber,
  stopRouterStatusProber,
  getRouterStatusSnapshot,
  probeOnce,
  DEFAULT_PROBE_INTERVAL_MS,
  DEFAULT_PROBE_TIMEOUT_MS,
  DEFAULT_STALE_WINDOW_MS
};
