"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeUsername,
  sessionUsername,
  createActiveSessionMap,
  findActiveSession
} = require("../utils/activeSessionMatching");

test("normalizes usernames by trimming whitespace and ignoring case", () => {
  assert.equal(normalizeUsername("  Customer.One  "), "customer.one");
});

test("matches RouterOS session aliases username, name, and user", () => {
  const sessions = [
    { name: "  PPPoE-Alpha ", address: "10.0.0.2" },
    { user: "HOTSPOT-Beta", address: "10.0.0.3" },
    { username: "pppoe-gamma", address: "10.0.0.4" },
    { username: "  ", name: "Fallback-Name", address: "10.0.0.5" }
  ];

  assert.equal(sessionUsername(sessions[0]), "pppoe-alpha");
  assert.equal(createActiveSessionMap(sessions).get("hotspot-beta"), sessions[1]);
  assert.equal(findActiveSession(sessions, " PPPoE-ALPHA "), sessions[0]);
  assert.equal(findActiveSession(sessions, "hotspot-BETA"), sessions[1]);
  assert.equal(findActiveSession(sessions, "PPPOE-GAMMA"), sessions[2]);
  assert.equal(findActiveSession(sessions, "fallback-name"), sessions[3]);
});

test("ignores empty and malformed session lists without inventing online users", () => {
  assert.equal(createActiveSessionMap(null).size, 0);
  assert.equal(findActiveSession(null, "customer"), null);
  assert.equal(findActiveSession([{ name: "   " }], "customer"), null);
});
