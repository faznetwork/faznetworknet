"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const remainingTime = require("../public/js/remaining-time");

const now = Date.parse("2026-10-25T12:00:00+06:00");

test("remaining-time formatter chooses units from actual millisecond delta", () => {
  assert.equal(remainingTime.format(now + 5 * 60 * 1000, now), "5m left");
  assert.equal(remainingTime.format(now + 4 * 60 * 1000, now), "4m left");
  assert.equal(remainingTime.format(now + 30 * 60 * 1000, now), "30m left");
  assert.equal(remainingTime.format(now + 60 * 1000 - 1, now), "< 1m left");
  assert.equal(remainingTime.format(now + 2 * 60 * 60 * 1000, now), "2h left");
  assert.equal(remainingTime.format(now + 23 * 60 * 60 * 1000, now), "23h left");
  assert.equal(remainingTime.format(now + 24 * 60 * 60 * 1000, now), "1d left");
  assert.equal(remainingTime.format(now + 7 * 24 * 60 * 60 * 1000, now), "7d left");
  assert.equal(remainingTime.format(now, now), "Expired");
  assert.equal(remainingTime.format(now - 1, now), "Expired");
});

test("remaining-time formatter handles timezone-aware and Dhaka-naive timestamps consistently", () => {
  assert.equal(
    remainingTime.format("2026-10-25T12:05:00+06:00", "2026-10-25T12:00:00+06:00"),
    "5m left"
  );
  assert.equal(
    remainingTime.format("2026-10-25 12:05:00", "2026-10-25 12:00:00"),
    "5m left"
  );
  assert.equal(remainingTime.format("not-a-date", now), "—");
});
