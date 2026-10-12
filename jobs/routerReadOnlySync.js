"use strict";

const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

let running = false;
let timer = null;

const INTERVAL_MS = Math.max(60_000, Number(process.env.ROUTER_READONLY_SYNC_INTERVAL_MS) || 5 * 60_000);
const SNAPSHOT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS router_readonly_snapshots (
    category VARCHAR(80) PRIMARY KEY,
    payload JSONB NOT NULL DEFAULT '[]'::jsonb,
    item_count INTEGER NOT NULL DEFAULT 0 CHECK (item_count >= 0),
    status VARCHAR(20) NOT NULL CHECK (status IN ('ok','error')),
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_success_at TIMESTAMPTZ,
    last_error TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )
`;

function safeError(error) {
  return String(error?.message || "RouterOS read failed").slice(0, 500);
}

function sanitizeProfiles(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    name: String(r.name || "").slice(0, 160),
    rateLimit: String(r.rateLimit || "").slice(0, 120),
    localAddress: String(r.localAddress || "").slice(0, 120),
    remoteAddress: String(r.remoteAddress || "").slice(0, 120),
    sessionTimeout: String(r.sessionTimeout || "").slice(0, 80),
    idleTimeout: String(r.idleTimeout || "").slice(0, 80),
    onlyOne: r.onlyOne ?? null,
    changeTcpMss: String(r.changeTcpMss || "").slice(0, 40),
    comment: String(r.comment || "").slice(0, 250)
  })).filter((r) => r.name);
}

function sanitizePools(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    name: String(r.name || "").slice(0, 160),
    ranges: String(r.ranges || "").slice(0, 2000),
    nextPool: String(r.nextPool || "none").slice(0, 160)
  })).filter((r) => r.name);
}

function sanitizeInterfaces(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    name: String(r.name || "").slice(0, 160),
    type: String(r.type || "unknown").slice(0, 80),
    running: Boolean(r.running),
    disabled: Boolean(r.disabled),
    comment: String(r.comment || "").slice(0, 250)
  })).filter((r) => r.name);
}

function sanitizeBridgeHosts(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    macAddress: String(r.macAddress || "").slice(0, 32),
    interface: String(r.interface || "").slice(0, 160),
    bridge: String(r.bridge || "").slice(0, 160),
    vlanId: r.vlanId == null ? null : String(r.vlanId).slice(0, 20),
    dynamic: Boolean(r.dynamic)
  })).filter((r) => r.macAddress);
}

function sanitizeUsedPools(rows) {
  return (Array.isArray(rows) ? rows : []).map((r) => ({
    pool: String(r.pool || "").slice(0, 160),
    address: String(r.address || "").slice(0, 64),
    owner: String(r.owner || "").slice(0, 160),
    info: String(r.info || "").slice(0, 250)
  })).filter((r) => r.pool && r.address);
}

async function saveSnapshot(category, payload, status, errorMessage = null) {
  const safePayload = Array.isArray(payload) ? payload : (payload == null ? [] : [payload]);
  await db.query(
    `INSERT INTO router_readonly_snapshots
       (category,payload,item_count,status,last_attempt_at,last_success_at,last_error,updated_at)
     VALUES ($1,$2::jsonb,$3,$4,NOW(),CASE WHEN $4='ok' THEN NOW() ELSE NULL END,$5,NOW())
     ON CONFLICT (category) DO UPDATE SET
       payload=CASE WHEN EXCLUDED.status='ok' THEN EXCLUDED.payload ELSE router_readonly_snapshots.payload END,
       item_count=CASE WHEN EXCLUDED.status='ok' THEN EXCLUDED.item_count ELSE router_readonly_snapshots.item_count END,
       status=EXCLUDED.status,
       last_attempt_at=NOW(),
       last_success_at=CASE WHEN EXCLUDED.status='ok' THEN NOW() ELSE router_readonly_snapshots.last_success_at END,
       last_error=EXCLUDED.last_error,
       updated_at=NOW()`,
    [category, JSON.stringify(safePayload), safePayload.length, status, errorMessage]
  );
}

async function collectOne(category, reader, sanitizer = (value) => value) {
  try {
    const raw = await reader();
    const safe = sanitizer(raw);
    await saveSnapshot(category, safe, "ok");
    return { category, status: "ok", count: Array.isArray(safe) ? safe.length : 1 };
  } catch (error) {
    const message = safeError(error);
    console.warn("[ROUTER READ-ONLY SYNC] " + category + " failed:", message);
    await saveSnapshot(category, [], "error", message).catch((dbError) => {
      console.warn("[ROUTER READ-ONLY SYNC] Could not persist failure state for " + category + ":", safeError(dbError));
    });
    return { category, status: "error", message };
  }
}

async function runRouterReadOnlySync() {
  if (running) return { skipped: true, reason: "previous_run_active" };
  running = true;
  const startedAt = new Date().toISOString();
  const results = [];
  try {
    await db.query(SNAPSHOT_TABLE_SQL);
    // Deliberately sequential: the RouterOS API wrapper opens a connection per
    // reader. Parallel calls previously risked unnecessary socket pressure.
    const checks = [
      ["router_identity", () => mikrotikService.getRouterIdentity(), (v) => ({ identity: String(v || "MikroTik").slice(0, 160) })],
      ["system_resources", () => mikrotikService.getSystemResources(), (v) => ({
        cpuLoad: Number(v.cpuLoad || 0), cpuCount: Number(v.cpuCount || 0),
        boardName: String(v.boardName || "").slice(0, 120), version: String(v.version || "").slice(0, 80),
        uptime: String(v.uptime || "").slice(0, 120), memoryUsagePercent: Number(v.memoryUsagePercent || 0),
        totalMemoryMb: Number(v.totalMemoryMb || 0), freeMemoryMb: Number(v.freeMemoryMb || 0)
      })],
      ["pppoe_profiles", () => mikrotikService.fetchExistingProfiles(), sanitizeProfiles],
      ["ip_pools", () => mikrotikService.getIpPools(), sanitizePools],
      ["used_ip_pools", () => mikrotikService.getUsedIpPools(), sanitizeUsedPools],
      ["interfaces", () => mikrotikService.getInterfaces(), sanitizeInterfaces],
      ["bridge_hosts", () => mikrotikService.getBridgeHosts(), sanitizeBridgeHosts]
    ];
    for (const [category, reader, sanitizer] of checks) {
      results.push(await collectOne(category, reader, sanitizer));
    }
    const succeeded = results.filter((r) => r.status === "ok").length;
    console.log("[ROUTER READ-ONLY SYNC] finished", JSON.stringify({
      startedAt, finishedAt: new Date().toISOString(), succeeded,
      failed: results.length - succeeded, categories: results.length
    }));
    return { startedAt, results };
  } catch (error) {
    console.warn("[ROUTER READ-ONLY SYNC] cycle failed:", safeError(error));
    return { startedAt, failed: true, message: safeError(error), results };
  } finally {
    running = false;
  }
}

function startRouterReadOnlySync() {
  if (timer) return timer;
  // Run after database initialization, then refresh at a bounded cadence.
  runRouterReadOnlySync().catch((error) => console.warn("[ROUTER READ-ONLY SYNC] initial run failed:", safeError(error)));
  timer = setInterval(() => {
    runRouterReadOnlySync().catch((error) => console.warn("[ROUTER READ-ONLY SYNC] scheduled run failed:", safeError(error)));
  }, INTERVAL_MS);
  if (typeof timer.unref === "function") timer.unref();
  return timer;
}

module.exports = { runRouterReadOnlySync, startRouterReadOnlySync };
