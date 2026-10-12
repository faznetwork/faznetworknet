"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeMac, getOpticalHealth } = require("../controllers/oltTelemetryController");

test("normalizeMac normalizes colon and hyphen MAC addresses", () => {
  assert.equal(normalizeMac("AA-BB-CC-DD-EE-FF"), "aa:bb:cc:dd:ee:ff");
  assert.equal(normalizeMac("aa:bb:cc:dd:ee:ff"), "aa:bb:cc:dd:ee:ff");
});
test("normalizeMac rejects missing or malformed addresses", () => {
  assert.equal(normalizeMac(""), null);
  assert.throws(() => normalizeMac("aa:bb:cc"), /Invalid ONU MAC/);
});
test("getOpticalHealth classifies fresh verified RX readings", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");
  const base = { identityVerified: true, stale: false, receivedAt: new Date(now - 1000).toISOString(), observedAt: new Date(now - 1000).toISOString() };
  assert.deepEqual(getOpticalHealth({ ...base, rxPowerDbm: -20 }, now), { level: "healthy", label: "Optimal" });
  assert.deepEqual(getOpticalHealth({ ...base, rxPowerDbm: -25 }, now), { level: "warning", label: "Marginal" });
  assert.deepEqual(getOpticalHealth({ ...base, rxPowerDbm: -28 }, now), { level: "critical", label: "Critical" });
  assert.deepEqual(getOpticalHealth({ ...base, rxPowerDbm: -10 }, now), { level: "warning", label: "Check Signal" });
});
test("getOpticalHealth hides stale, unverified, missing, and future telemetry", () => {
  const now = Date.parse("2026-10-12T12:00:00Z");
  const fresh = { identityVerified: true, stale: false, rxPowerDbm: -20, receivedAt: new Date(now - 1000).toISOString(), observedAt: new Date(now - 1000).toISOString() };
  assert.equal(getOpticalHealth({ ...fresh, stale: true }, now).level, "unknown");
  assert.equal(getOpticalHealth({ ...fresh, identityVerified: false }, now).level, "unknown");
  assert.equal(getOpticalHealth({ ...fresh, rxPowerDbm: null }, now).level, "unknown");
  assert.equal(getOpticalHealth({ ...fresh, receivedAt: new Date(now + 1000).toISOString() }, now).level, "unknown");
  assert.equal(getOpticalHealth({ ...fresh, observedAt: new Date(now - 31 * 60 * 1000).toISOString() }, now).level, "unknown");
});
