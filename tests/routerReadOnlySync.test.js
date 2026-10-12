"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  sanitizeProfiles,
  sanitizePools,
  sanitizeInterfaces,
  sanitizeBridgeHosts,
  sanitizeUsedPools
} = require("../jobs/routerReadOnlySync");

test("RouterOS profile snapshot is metadata-only and excludes secrets", () => {
  const rows = sanitizeProfiles([{
    name: "Home-30M", rateLimit: "30M/30M", password: "must-not-be-stored",
    raw: { password: "must-not-be-stored" }, comment: "customer profile"
  }]);
  assert.deepEqual(rows, [{
    name: "Home-30M", rateLimit: "30M/30M", localAddress: "",
    remoteAddress: "", sessionTimeout: "", idleTimeout: "",
    onlyOne: null, changeTcpMss: "", comment: "customer profile"
  }]);
  assert.equal(JSON.stringify(rows).includes("must-not-be-stored"), false);
});

test("pool and interface snapshots keep only bounded read-only fields", () => {
  assert.deepEqual(sanitizePools([{ name: "pool-main", ranges: "10.20.0.2-10.20.0.254", nextPool: "none" }]), [
    { name: "pool-main", ranges: "10.20.0.2-10.20.0.254", nextPool: "none" }
  ]);
  assert.deepEqual(sanitizeInterfaces([{ name: "ether1", type: "ether", running: true, disabled: false, comment: "WAN", raw: { secret: "x" } }]), [
    { name: "ether1", type: "ether", running: true, disabled: false, comment: "WAN" }
  ]);
});

test("bridge and used-pool snapshots do not invent identity mappings", () => {
  assert.deepEqual(sanitizeBridgeHosts([{ macAddress: "AA:BB:CC:DD:EE:FF", interface: "bridge1", bridge: "bridge1", vlanId: 10, dynamic: true }]), [
    { macAddress: "AA:BB:CC:DD:EE:FF", interface: "bridge1", bridge: "bridge1", vlanId: "10", dynamic: true }
  ]);
  assert.deepEqual(sanitizeUsedPools([{ pool: "pool-main", address: "10.20.0.20", owner: "pppoe-user", info: "active" }]), [
    { pool: "pool-main", address: "10.20.0.20", owner: "pppoe-user", info: "active" }
  ]);
  assert.deepEqual(sanitizeBridgeHosts([{ interface: "bridge1" }]), []);
});
