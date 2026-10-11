"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseOpticalPowerDbm } = require("../lib/network/opticalPower");

test("parses numeric dBm values without changing units", () => {
  assert.equal(parseOpticalPowerDbm(-24.567), -24.57);
  assert.equal(parseOpticalPowerDbm("-24.50"), -24.5);
  assert.equal(parseOpticalPowerDbm("RX: -24.50 dBm"), -24.5);
});

test("does not guess the scale of an encoded SNMP OCTET STRING", () => {
  assert.equal(parseOpticalPowerDbm("-2450"), null);
  assert.equal(parseOpticalPowerDbm("0xF65A"), null);
  assert.equal(parseOpticalPowerDbm("unavailable"), null);
});

test("rejects optical power outside the configured physical range", () => {
  assert.equal(parseOpticalPowerDbm(-51), null);
  assert.equal(parseOpticalPowerDbm(11), null);
  assert.equal(parseOpticalPowerDbm(null), null);
});
