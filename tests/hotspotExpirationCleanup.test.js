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

test("expires marked users, hard-purges RouterOS credentials, and retains rows for 30-day visibility", async () => {
  const rows = [{ id: 2, username: "VOUCHER2", status: "active", expires_at: new Date("2026-10-10T10:00:00.000Z"), cleanup_status: "not_required" }];
  const database = mockDb(rows);
  const cleaned = [];
  const router = {
    async getHotspotExpirationSnapshot() {
      return { users: [{ username: "VOUCHER2", comment: "FAZ|EXPIRED", disabled: true }], schedulerNames: [] };
    },
    async cleanupExpiredHotspotUser(username) { cleaned.push(username); return { verified: true, usersRemoved: 1 }; }
  };
  const run = createHotspotExpirationCleanup({ db: database, mikrotikService: router, logger: quietLogger(), now: () => new Date("2026-10-11T12:00:00Z") });
  const result = await run();
  assert.equal(result.expired, 1);
  assert.equal(result.removed, 1);
  assert.deepEqual(cleaned, ["VOUCHER2"]);
  assert.ok(database.calls.some(call => call.sql.includes("status='expired'") && call.sql.includes("cleanup_status='pending'")));
  assert.ok(database.calls.some(call => call.sql.includes("cleanup_status='completed'")));
  assert.ok(!database.calls.some(call => /^DELETE FROM hotspot_vouchers/i.test(call.sql.trim())), "expired subscriber remains visible until 30-day retention");
  assert.ok(!database.calls.some(call => call.sql.includes("profile='expired_profile'")), "expiry must not trap users in expired_profile");
  assert.ok(!database.calls.some(call => /^DELETE FROM transactions/i.test(call.sql.trim())));
});

test("reconciles legacy expired vouchers that predate cleanup tracking", async () => {
  const rows = [{ id: 4, username: "LEGACY-EXPIRED", status: "expired", cleanup_status: "not_required" }];
  const database = mockDb(rows);
  const cleaned = [];
  const router = {
    async getHotspotExpirationSnapshot() { return { users: [], schedulerNames: [] }; },
    async cleanupExpiredHotspotUser(username) { cleaned.push(username); return { verified: true, alreadyAbsent: true }; }
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
    async cleanupExpiredHotspotUser(username) { cleaned.push(username); return { verified: true, alreadyAbsent: true }; }
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
  assert.ok(!database.calls.some(call => /^DELETE FROM hotspot_vouchers/i.test(call.sql.trim())), "expired subscriber remains visible until 30-day retention");
  assert.ok(!database.calls.some(call => call.sql.includes("profile='expired_profile'")), "expiry must not trap users in expired_profile");
  assert.ok(!database.calls.some(call => /^DELETE FROM transactions/i.test(call.sql.trim())));
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

test("preserves a staged future Hotspot renewal when the old RouterOS user has disappeared", async () => {
  const futureExpiry = new Date("2026-10-20T12:00:00.000Z");
  const rows = [{
    id: 52, username: "AA:BB:CC:DD:EE:FF", status: "pending_claim",
    comment: "Exp: 2026-10-20 18:00:00", validity: "1h",
    first_login_at: new Date("2026-10-16T08:00:00.000Z"),
    expires_at: futureExpiry, renewal_stacked: true, cleanup_status: "not_required",
    phone: "01712345678", price: 10, profile: "1-Hour"
  }];
  const database = mockDb(rows);
  let cleanupCalls = 0;
  const router = {
    async getHotspotExpirationSnapshot() { return { users: [], schedulerNames: [] }; },
    async cleanupExpiredHotspotUser() { cleanupCalls++; }
  };
  const run = createHotspotExpirationCleanup({
    db: database, mikrotikService: router, logger: quietLogger(),
    now: () => new Date("2026-10-16T10:00:00.000Z")
  });
  const result = await run();
  assert.equal(result.expired, 0);
  assert.equal(result.removed, 0);
  assert.equal(cleanupCalls, 0, "a missing old RouterOS user must not invalidate a staged renewal");
  assert.equal(database.calls.some(call => call.sql.includes("SET status='expired'")), false);
});

test("does not expire a future-valid MAC voucher when its RouterOS user is absent", async () => {
  const rows = [{
    id: 18, username: "AA:BB:CC:DD:EE:FF", status: "unused",
    comment: "Exp: 2026-10-20", expires_at: new Date("2026-10-20T12:00:00.000Z"),
    cleanup_status: "not_required"
  }];
  const database = mockDb(rows);
  let cleanupCalls = 0;
  const router = {
    async getHotspotExpirationSnapshot() { return { users: [], schedulerNames: [] }; },
    async cleanupExpiredHotspotUser() { cleanupCalls++; return { verified: true, alreadyAbsent: true }; }
  };
  const run = createHotspotExpirationCleanup({
    db: database, mikrotikService: router, logger: quietLogger(),
    now: () => new Date("2026-10-11T12:00:00.000Z")
  });
  const result = await run();
  assert.equal(result.expired, 0);
  assert.equal(result.removed, 0);
  assert.equal(cleanupCalls, 0);
  assert.equal(database.calls.some(call => call.sql.includes("SET status='expired'")), false);
});

test("does not let a RouterOS expired marker override a future PostgreSQL expiry", async () => {
  const rows = [{
    id: 19, username: "FUTURE-VALID", status: "active",
    expires_at: new Date("2026-10-20T12:00:00.000Z"), cleanup_status: "not_required"
  }];
  const database = mockDb(rows);
  let cleanupCalls = 0;
  const router = {
    async getHotspotExpirationSnapshot() {
      return { users: [{ username: "FUTURE-VALID", comment: "FAZ|EXPIRED", disabled: true, limitBytesTotal: 0, bytesIn: 0, bytesOut: 0 }], schedulerNames: [] };
    },
    async cleanupExpiredHotspotUser() { cleanupCalls++; return { verified: true }; }
  };
  const run = createHotspotExpirationCleanup({
    db: database, mikrotikService: router, logger: quietLogger(),
    now: () => new Date("2026-10-11T12:00:00.000Z")
  });
  const result = await run();
  assert.equal(result.expired, 0);
  assert.equal(cleanupCalls, 0);
  assert.equal(database.calls.some(call => call.sql.includes("SET status='expired'")), false);
});

test("expires a future-dated voucher only when RouterOS reports a verified exhausted byte quota", async () => {
  const rows = [{
    id: 20, username: "QUOTA-EXHAUSTED", status: "active",
    expires_at: new Date("2026-10-20T12:00:00.000Z"), cleanup_status: "not_required"
  }];
  const database = mockDb(rows);
  const cleaned = [];
  const router = {
    async getHotspotExpirationSnapshot() {
      return { users: [{ username: "QUOTA-EXHAUSTED", comment: "FAZ|PROFILE=Gold", limitBytesTotal: 1000, bytesIn: 600, bytesOut: 400 }], schedulerNames: [] };
    },
    async cleanupExpiredHotspotUser(username) { cleaned.push(username); return { verified: true, usersRemoved: 1 }; }
  };
  const run = createHotspotExpirationCleanup({
    db: database, mikrotikService: router, logger: quietLogger(),
    now: () => new Date("2026-10-11T12:00:00.000Z")
  });
  const result = await run();
  assert.equal(result.expired, 1);
  assert.equal(result.removed, 1);
  assert.deepEqual(cleaned, ["QUOTA-EXHAUSTED"]);
  const expireUpdate = database.calls.find(call => call.sql.startsWith("UPDATE hotspot_vouchers SET status='expired'"));
  assert.ok(expireUpdate);
  assert.equal(expireUpdate.params[3], true);
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
  const rows = [{ id: 3, username: "VOUCHER3", status: "active", expires_at: new Date("2026-10-10T10:00:00.000Z"), cleanup_status: "not_required" }];
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

test("retention purges RouterOS first, archives sales, then soft-archives 395-day expired vouchers", async () => {
  const calls=[],routerCalls=[];
  const database={async query(sql,params){
    calls.push({sql,params});
    if(sql.startsWith("SELECT id,username,mac_address")) return {rows:[{id:9,username:"AA:BB:CC:DD:EE:FF",mac_address:"AA:BB:CC:DD:EE:FF"}]};
    if(sql.startsWith("INSERT INTO hotspot_voucher_sales_archive")) return {rows:[{transaction_id:1}]};
    if(sql.startsWith("UPDATE hotspot_vouchers AS v SET status='archived'")) return {rows:[{id:9}]};
    return {rows:[]};
  }};
  const router={async cleanupExpiredHotspotUser(username){routerCalls.push(username);return {verified:true,usersRemoved:1};}};
  const result=await runHotspotRetentionCleanup({db:database,mikrotikService:router,logger:quietLogger()});
  assert.equal(result.archivedTransactions,1);
  assert.equal(result.archivedVouchers,1);
  assert.deepEqual(routerCalls,["AA:BB:CC:DD:EE:FF"]);
  assert.ok(calls[1].sql.includes("ON CONFLICT(transaction_id) DO NOTHING"));
  assert.ok(calls[2].sql.includes("expires_at < NOW() - INTERVAL '395 days'"));
  assert.deepEqual(calls[1].params,[[9]]);
  assert.deepEqual(calls[2].params,[[9]]);
});


test("does not let a legacy RouterOS scheduler suppress centralized expiry", () => {
  const expiredComment = "FAZ|PROFILE=Gold|EXP: 2020-01-01 00:00:00";
  assert.equal(routerUserExpired({ username: "OLD-SCHEDULER-USER", comment: expiredComment, disabled: false }, new Set(["faz-exp-OLD-SCHEDULER-USER"])), true);
});

test("expired profile config is permanently absent",()=>{const config=require("../services/hotspotProfileConfig");assert.equal("EXPIRED_HOTSPOT_PROFILE" in config,false);});

test("expiry worker uses scheduled execution rather than a fixed one-minute interval",()=>{
  const fs=require("node:fs");
  const source=fs.readFileSync(require.resolve("../jobs/hotspotExpirationCleanup"),"utf8");
  assert.doesNotMatch(source,/MINUTE_MS|setInterval\(\(\) => runHotspotExpirationCleanup/);
  assert.match(source,/expires_at - INTERVAL '5 minutes'/);
  assert.match(source,/Startup recovery sweep failed/);
});

test("voucher sales API supports validated inclusive custom date ranges",()=>{
  const fs=require("node:fs");
  const source=fs.readFileSync(require.resolve("../controllers/hotspotController"),"utf8");
  assert.match(source,/req\.query\?\.startDate/);
  assert.match(source,/req\.query\?\.endDate/);
  assert.match(source,/Dates must use YYYY-MM-DD format/);
  assert.match(source,/AT TIME ZONE 'Asia\/Dhaka'/);
  assert.match(source,/ORDER BY created_at DESC,transaction_id DESC LIMIT 500/);
});

test("expired cleanup delegates to hard purge and preserves transaction audit history", async () => {
  const rows = [{ id: 99, username: "AA:BB:CC:DD:EE:FF", mac_address: "AA:BB:CC:DD:EE:FF", status: "active", expires_at: new Date("2026-10-10T00:00:00Z"), cleanup_status: "not_required" }];
  const database = mockDb(rows);
  const purges = [];
  const router = {
    async getHotspotExpirationSnapshot() { return { users: [], schedulerNames: [] }; },
    async cleanupExpiredHotspotUser(username, mac) { purges.push({ username, mac }); return { verified: true, usersRemoved: 1, sessionsRemoved: 1, cookiesRemoved: 1 }; }
  };
  const run = createHotspotExpirationCleanup({ db: database, mikrotikService: router, logger: quietLogger(), now: () => new Date("2026-10-11T12:00:00Z") });
  const result = await run();
  assert.equal(result.expired, 1);
  assert.equal(result.removed, 1);
  assert.deepEqual(purges, [{ username: "AA:BB:CC:DD:EE:FF", mac: "AA:BB:CC:DD:EE:FF" }]);
  assert.ok(!database.calls.some(call => /DELETE\s+FROM\s+transactions/i.test(call.sql)));
  assert.ok(!database.calls.some(call => call.sql.includes("profile='expired_profile'")));
});


test("expiry cleanup processes no more than five vouchers per RouterOS batch", async () => {
  const expiredAt = new Date("2026-10-11T10:00:00.000Z");
  const rows = Array.from({ length: 12 }, (_, index) => ({ id:index+1, username:"BATCH-"+(index+1), status:"active", expires_at:expiredAt, cleanup_status:"not_required", mac_address:"AA:BB:CC:DD:EE:"+String(index+1).padStart(2,"0") }));
  const database = mockDb(rows), purged = [];
  const router = { async getHotspotExpirationSnapshot(){return {users:[],schedulerNames:[]};}, async cleanupExpiredHotspotUser(username){purged.push(username);return {verified:true,usersRemoved:1};} };
  const run = createHotspotExpirationCleanup({db:database,mikrotikService:router,logger:quietLogger(),now:()=>new Date("2026-10-11T12:00:00.000Z")});
  const result = await run();
  assert.equal(result.checked,5); assert.equal(result.expired,5); assert.equal(result.removed,5); assert.equal(purged.length,5);
  const selection=database.calls.find(call=>call.sql.startsWith("SELECT id,username,status"));
  assert.match(selection.sql,/LIMIT \$2/); assert.equal(selection.params[1],5);
});

test("manual delete retry confirmation uses actual line-break escapes", () => {
  const fs=require("node:fs"), source=fs.readFileSync(require.resolve("../public/js/hotspot-users-clean"),"utf8");
  assert.match(source,/message \+ "\\n\\nRetry the verified RouterOS purge now/);
  assert.doesNotMatch(source,/message \+ "\\\\n\\\\nRetry the verified RouterOS purge now/);
});

test("expiry purge requires verified RouterOS result before unbinding the MAC", async () => {
  const rows=[{id:301,username:"AA:BB:CC:DD:EE:FF",status:"active",expires_at:new Date("2026-10-11T10:00:00.000Z"),cleanup_status:"not_required",mac_address:"AA:BB:CC:DD:EE:FF"}];
  const database=mockDb(rows), router={async getHotspotExpirationSnapshot(){return {users:[],schedulerNames:[]};},async cleanupExpiredHotspotUser(){return {verified:false};}};
  const run=createHotspotExpirationCleanup({db:database,mikrotikService:router,logger:quietLogger(),now:()=>new Date("2026-10-11T12:00:00.000Z")});
  const result=await run(); assert.equal(result.failed,1); assert.equal(result.removed,0);
  assert.equal(database.calls.some(call=>call.sql.includes("mac_address=NULL")&&call.sql.includes("cleanup_status='completed'")),false);
});
