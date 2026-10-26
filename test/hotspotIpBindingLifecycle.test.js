"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { dhakaDate, bandwidth } = require("../controllers/hotspotIpBindingController");

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
