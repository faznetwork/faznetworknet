'use strict';

const STALE_AFTER_MS = 15 * 60 * 1000;

function normalizeMac(value) {
  const raw = String(value ?? '').trim().replace(/-/g, ':').toLowerCase();
  if (!/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(raw)) return null;
  return raw;
}

function telemetryLastSeen(item) {
  return item?.observedAt || item?.receivedAt || null;
}

function isTelemetryStale(item, nowMs = Date.now()) {
  const value = telemetryLastSeen(item);
  if (!value) return true;
  const time = new Date(value).getTime();
  return !Number.isFinite(time) || nowMs - time > STALE_AFTER_MS;
}

function matchTelemetryIdentity({ onuMac, callerId }, telemetry) {
  if (!telemetry) return null;
  const target = normalizeMac(telemetry.onuMac);
  if (target && target === normalizeMac(onuMac)) return 'customer_onu_mac';
  if (target && target === normalizeMac(callerId)) return 'pppoe_caller_id';
  return null;
}

module.exports = { STALE_AFTER_MS, normalizeMac, telemetryLastSeen, isTelemetryStale, matchTelemetryIdentity };
