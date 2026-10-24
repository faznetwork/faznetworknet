"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { getRxPowerStatus } = require("../lib/network/rxPowerStatus");

const NOW = Date.parse("2026-10-11T00:00:00.000Z");
const POWER = -23.4;

test("marks missing power or timestamp as awaiting an OLT reading", () => {
  assert.equal(getRxPowerStatus(null, POWER, NOW), "awaiting_olt_reading");
  assert.equal(getRxPowerStatus(undefined, POWER, NOW), "awaiting_olt_reading");
  assert.equal(getRxPowerStatus(new Date(NOW), null, NOW), "awaiting_olt_reading");
  assert.equal(getRxPowerStatus(new Date(NOW), undefined, NOW), "awaiting_olt_reading");
});

test("marks recent valid readings measured and readings older than 30 minutes stale", () => {
  assert.equal(getRxPowerStatus(new Date(NOW - 10 * 60 * 1000), POWER, NOW), "measured");
  assert.equal(getRxPowerStatus(new Date(NOW - 30 * 60 * 1000), POWER, NOW), "measured");
  assert.equal(getRxPowerStatus(new Date(NOW - 30 * 60 * 1000 - 1), POWER, NOW), "stale");
});

test("rejects invalid, out-of-range and future observations", () => {
  assert.equal(getRxPowerStatus("not-a-date", POWER, NOW), "invalid_timestamp");
  assert.equal(getRxPowerStatus(new Date(NOW + 1000), POWER, NOW), "invalid_timestamp");
  assert.equal(getRxPowerStatus(new Date(NOW), -99, NOW), "invalid_reading");
  assert.equal(getRxPowerStatus(new Date(NOW), 99, NOW), "invalid_reading");
  assert.equal(getRxPowerStatus(new Date(NOW), "not-a-number", NOW), "invalid_reading");
});
