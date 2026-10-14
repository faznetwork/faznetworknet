"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createHotspotExpirationCleanup,
  parseRouterOsDuration,
  parseFirstLoginAt,
  routerUserExpired,
  runHotspotRetentionCleanup
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
  const run = createHotspotExpirationCleanup({ db: database, mikrotikService: router, logger: quietLogger(), now: () => new Date("2026-10-11T12:00:00.000Z") });
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
  const expireUpdate = database.calls.find(call => call.sql.startsWith("UPDATE hotspot_vouchers SET status='expired'"));
  assert.ok(expireUpdate);
  assert.equal(expireUpdate.params[1].toISOString(), expiredAt.toISOString());
  assert.ok(!database.calls.some(call => /^DELETE/i.test(call.sql.trim())));
});

test("marks due database vouchers expired and retains retry state when RouterOS snapshot is unavailable", async () => {
  const rows = [{
    id: 7, username: "API-OFFLINE-EXPIRED", status: "active",
    expires_at: new Date("2026-10-11T10:00:00.000Z"), cleanup_status: "not_required"
  }];
  const database = mockDb(rows);
  const router = {
    async getHotspotExpirationSnapshot() { throw new Error("Router API timeout"); },
    async cleanupExpiredHotspotUser() { throw new Error("Router API timeout"); }
  };
  const run = createHotspotExpirationCleanup({
    db: database, mikrotikService: router, logger: quietLogger(),
    now: () => new Date("2026-10-11T12:00:00.000Z")
  });
  const result = await run();
  assert.equal(result.expired, 1);
  assert.equal(result.failed, 1);
  assert.ok(database.calls.some(call => call.sql.includes("status='expired'") && call.sql.includes("cleanup_status='pending'")));
  assert.ok(database.calls.some(call => call.sql.includes("cleanup_status='pending'") && call.params.includes("Router API timeout")));
  assert.ok(!database.calls.some(call => /^DELETE/i.test(call.sql.trim())));
});

test("reconciles an expired MAC voucher after the RouterOS one-shot scheduler removed the user", async () => {
  const rows = [{ id: 18, username: "AA:BB:CC:DD:EE:FF", status: "unused", comment: "Exp: 2026-10-10", cleanup_status: "not_required" }];
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
  assert.deepEqual(cleaned, ["AA:BB:CC:DD:EE:FF"]);
  assert.ok(database.calls.some(call => call.sql.includes("status='expired'") && call.sql.includes("cleanup_status='pending'")));
  assert.ok(database.calls.some(call => call.sql.includes("cleanup_status='completed'")));
  assert.ok(!database.calls.some(call => /^DELETE/i.test(call.sql.trim())), "voucher/payment audit rows must be retained");
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
  assert.ok(!database.calls.some(call => call.sql.startsWith("UPDATE hotspot_vouchers SET status='expired'")));
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

test("does not expire calendar-validity users based on cumulative uptime", () => {
  assert.equal(routerUserExpired({
    username: "CALENDAR-USER",
    disabled: false,
    comment: "FAZ|EXP=PENDING|PROF=Gold|PROFILE=Gold|VALIDITY=1h|FIRST_LOGIN=oct/14/2026 10:00:00",
    uptime: "1h",
    limitUptime: "1h",
    limitBytesTotal: 0,
    bytesIn: 0,
    bytesOut: 0
  }, new Set(["faz-exp-CALENDAR-USER"])), false);
});

test("recognizes UNIX epoch expiry metadata and ignores initial zero marker", () => {
  const expired = Math.floor((Date.now() - 60000) / 1000);
  assert.equal(routerUserExpired({username:"EPOCH-USER",disabled:false,comment:"FAZ|EXP="+expired+"|PROF=Gold|INIT=1|PROFILE=Gold"},new Set()),true);
  assert.equal(routerUserExpired({username:"UNSTARTED",disabled:false,comment:"FAZ|EXP=0|PROF=Gold|INIT=1|PROFILE=Gold"},new Set()),false);
  const dhakaExpiry = new Date(Date.now() - 6 * 60 * 60 * 1000 - 60000).toISOString().slice(0, 19).replace("T", " ");
  assert.equal(routerUserExpired({username:"DHAKA-EXP",disabled:false,comment:"FAZ|EXP: "+dhakaExpiry+"|PROF=Gold|INIT=1|PROFILE=Gold"},new Set()),true);
});

test("retention archives transaction history before purging expired vouchers", async () => {
  const calls=[];
  const database={async query(sql){
    calls.push(sql);
    if(sql.startsWith("INSERT INTO hotspot_voucher_sales_archive")) return {rows:[{transaction_id:1}]};
    if(sql.startsWith("DELETE FROM hotspot_vouchers")) return {rows:[{id:9}]};
    return {rows:[]};
  }};
  const result=await runHotspotRetentionCleanup({db:database,logger:quietLogger()});
  assert.equal(result.archivedTransactions,1);
  assert.equal(result.deletedVouchers,1);
  assert.ok(calls[0].includes("ON CONFLICT(transaction_id) DO NOTHING"));
  assert.ok(calls[1].includes("INTERVAL '3 days'"));
});
