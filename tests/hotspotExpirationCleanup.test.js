"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createHotspotExpirationCleanup,
  parseRouterOsDuration,
  parseFirstLoginAt,
  routerUserExpired
} = require("../jobs/hotspotExpirationCleanup");

function mockDb(rows) {
  const calls = [];
  return {
    calls,
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT id,username,status")) return { rows };
      return { rows: [] };
    }
  };
}

function quietLogger() {
  return { log() {}, warn() {}, error() {} };
}

test("parses RouterOS uptime and first-login timestamp", () => {
  assert.equal(parseRouterOsDuration("1d2h3m4s"), 93784000);
  assert.equal(parseRouterOsDuration("45m"), 2700000);
  assert.equal(parseRouterOsDuration("unknown"), 0);
  const date = parseFirstLoginAt("FAZ|PROFILE=Gold|VALIDITY=1d|FIRST_LOGIN=oct/11/2026 10:15:00|MAC=AA");
  assert.equal(date.toISOString(), "2026-10-11T04:15:00.000Z");
});

test("does not expire unrelated or manually disabled users without FAZ expiry metadata", () => {
  assert.equal(routerUserExpired({ username: "pppoe-user", disabled: true, comment: "Customer: Example" }, new Set()), false);
  assert.equal(routerUserExpired({ username: "hotspot", disabled: true, comment: "FAZ|PROFILE=Gold|VALIDITY=1d" }, new Set(["faz-exp-hotspot"])), false);
});

test("promotes a used voucher and records first-login expiry without expiring it early", async () => {
  const rows = [{ id: 1, username: "VOUCHER1", status: "unused", cleanup_status: "not_required" }];
  const database = mockDb(rows);
  const router = {
    async getHotspotExpirationSnapshot() {
      return {
        users: [{
          username: "VOUCHER1", comment: "FAZ|PROFILE=Gold|VALIDITY=1d|FIRST_LOGIN=oct/11/2026 10:15:00",
          disabled: false, uptime: "1h", limitUptime: "1d", limitBytesTotal: 0, bytesIn: 0, bytesOut: 0
        }],
        schedulerNames: ["faz-exp-VOUCHER1"]
      };
    },
    async cleanupExpiredHotspotUser() { throw new Error("must not clean up an active voucher"); }
  };
  const run = createHotspotExpirationCleanup({ db: database, mikrotikService: router, logger: quietLogger() });
  const result = await run();
  assert.equal(result.activated, 1);
  assert.equal(result.expired, 0);
  assert.ok(database.calls.some(call => call.sql.includes("status='active'") && call.params[0] instanceof Date));
});

test("expires marked users, kicks/removes them, and retains database history", async () => {
  const rows = [{ id: 2, username: "VOUCHER2", status: "active", cleanup_status: "not_required" }];
  const database = mockDb(rows);
  const cleaned = [];
  const router = {
    async getHotspotExpirationSnapshot() {
      return { users: [{ username: "VOUCHER2", comment: "FAZ|EXPIRED", disabled: true }], schedulerNames: [] };
    },
    async cleanupExpiredHotspotUser(username) { cleaned.push(username); return { usersRemoved: 1 }; }
  };
  const run = createHotspotExpirationCleanup({ db: database, mikrotikService: router, logger: quietLogger(), now: () => new Date("2026-10-11T12:00:00Z") });
  const result = await run();
  assert.equal(result.expired, 1);
  assert.equal(result.removed, 1);
  assert.deepEqual(cleaned, ["VOUCHER2"]);
  assert.ok(database.calls.some(call => call.sql.includes("status='expired'") && call.sql.includes("cleanup_status='pending'")));
  assert.ok(database.calls.some(call => call.sql.includes("cleanup_status='completed'")));
  assert.ok(!database.calls.some(call => /^DELETE/i.test(call.sql.trim())));
});

test("reconciles legacy expired vouchers that predate cleanup tracking", async () => {
  const rows = [{ id: 4, username: "LEGACY-EXPIRED", status: "expired", cleanup_status: "not_required" }];
  const database = mockDb(rows);
  const cleaned = [];
  const router = {
    async getHotspotExpirationSnapshot() { return { users: [], schedulerNames: [] }; },
    async cleanupExpiredHotspotUser(username) { cleaned.push(username); return { alreadyAbsent: true }; }
  };
  const run = createHotspotExpirationCleanup({ db: database, mikrotikService: router, logger: quietLogger() });
  const result = await run();
  assert.equal(result.removed, 1);
  assert.deepEqual(cleaned, ["LEGACY-EXPIRED"]);
  assert.ok(database.calls.some(call => call.sql.includes("cleanup_status='completed'")));
});

test("expires a used voucher from PostgreSQL expiry even if RouterOS user is already absent", async () => {
  const expiredAt = new Date("2026-10-11T10:00:00.000Z");
  const rows = [{
    id: 5, username: "VOUCHER-DB-EXPIRED", status: "active",
    first_login_at: new Date("2026-10-10T10:00:00.000Z"),
    expires_at: expiredAt, cleanup_status: "not_required"
  }];
  const database = mockDb(rows);
  const cleaned = [];
  const router = {
    async getHotspotExpirationSnapshot() { return { users: [], schedulerNames: [] }; },
    async cleanupExpiredHotspotUser(username) { cleaned.push(username); return { alreadyAbsent: true }; }
  };
  const run = createHotspotExpirationCleanup({
    db: database, mikrotikService: router, logger: quietLogger(),
    now: () => new Date("2026-10-11T12:00:00.000Z")
  });
  const result = await run();
  assert.equal(result.expired, 1);
  assert.equal(result.removed, 1);
  assert.deepEqual(cleaned, ["VOUCHER-DB-EXPIRED"]);
  const expireUpdate = database.calls.find(call => call.sql.includes("status='expired'"));
  assert.ok(expireUpdate);
  assert.equal(expireUpdate.params[1].toISOString(), expiredAt.toISOString());
  assert.ok(!database.calls.some(call => /^DELETE/i.test(call.sql.trim())));
});

test("does not expire an unused voucher solely because it was created long ago", async () => {
  const rows = [{
    id: 6, username: "UNUSED-OLD", status: "unused",
    created_at: new Date("2025-01-01T00:00:00.000Z"),
    expires_at: null, cleanup_status: "not_required"
  }];
  const database = mockDb(rows);
  const cleaned = [];
  const router = {
    async getHotspotExpirationSnapshot() { return { users: [], schedulerNames: [] }; },
    async cleanupExpiredHotspotUser(username) { cleaned.push(username); }
  };
  const run = createHotspotExpirationCleanup({
    db: database, mikrotikService: router, logger: quietLogger(),
    now: () => new Date("2026-10-11T12:00:00.000Z")
  });
  const result = await run();
  assert.equal(result.expired, 0);
  assert.equal(result.removed, 0);
  assert.deepEqual(cleaned, []);
  assert.ok(!database.calls.some(call => call.sql.includes("status='expired'")));
});

test("keeps cleanup pending and records the error when MikroTik removal fails", async () => {
  const rows = [{ id: 3, username: "VOUCHER3", status: "active", cleanup_status: "not_required" }];
  const database = mockDb(rows);
  const router = {
    async getHotspotExpirationSnapshot() {
      return { users: [{ username: "VOUCHER3", comment: "FAZ|EXPIRED", disabled: true }], schedulerNames: [] };
    },
    async cleanupExpiredHotspotUser() { throw new Error("Router API timeout"); }
  };
  const run = createHotspotExpirationCleanup({ db: database, mikrotikService: router, logger: quietLogger() });
  const result = await run();
  assert.equal(result.expired, 1);
  assert.equal(result.failed, 1);
  assert.ok(database.calls.some(call => call.sql.includes("cleanup_status='pending'") && call.params.includes("Router API timeout")));
});
