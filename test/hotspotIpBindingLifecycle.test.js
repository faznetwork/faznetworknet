"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { dhakaDate, bandwidth } = require("../controllers/hotspotIpBindingController");
const fs = require("node:fs");
const path = require("node:path");
const mainJs = fs.readFileSync(path.join(__dirname, "../public/js/main.js"), "utf8");
const hubJs = fs.readFileSync(path.join(__dirname, "../public/js/hotspot-unified-hub.js"), "utf8");
const mikrotikService = fs.readFileSync(path.join(__dirname, "../services/mikrotikService.js"), "utf8");

test("local datetime-local expiry is interpreted as Asia/Dhaka", () => {
  assert.equal(dhakaDate("2026-10-27T12:30"), "2026-10-27T06:30:00.000Z");
});

test("an explicit timezone remains authoritative", () => {
  assert.equal(dhakaDate("2026-10-27T12:30:00Z"), "2026-10-27T12:30:00.000Z");
});

test("bandwidth accepts unlimited and upload/download rates", () => {
  assert.equal(bandwidth("Full Speed"), "unlimited");
  assert.equal(bandwidth("5M/5M"), "5M/5M");
  assert.equal(bandwidth("512k/2M"), "512k/2M");
});

test("bandwidth rejects malformed queue limits", () => {
  assert.throws(() => bandwidth("fast"), /Bandwidth must be Unlimited/);
});

test("Hotspot routes short-circuit global PPPoE data loaders", () => {
  assert.match(mainJs, /isHotspotRoute = \/\^\\\/admin\\\/hotspot/);
  assert.match(mainJs, /if \(isHotspotRoute \|\|/);
  assert.match(mainJs, /admin\\\/hotspot.*return;/s);
  assert.match(hubJs, /\/api\/hotspot\/ip-bindings/);
  assert.doesNotMatch(hubJs, /\/api\/pppoe\//);
});

test("RouterOS operations have a bounded longer timeout and failed session polls release their guard", () => {
  assert.match(mikrotikService, /CONNECTION_TIMEOUT_MS = 15000/);
  assert.match(mikrotikService, /OPERATION_TIMEOUT_MS = 30000/);
  assert.match(mikrotikService, /_resetPersistentConnection\(connection/);
  assert.match(mainJs, /signal: controller\.signal/);
  assert.match(mainJs, /finally \{ activePollInFlight = false; \}/);
});
