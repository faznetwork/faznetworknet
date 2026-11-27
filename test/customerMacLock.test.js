"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const mikrotik = require("../services/mikrotikService");
const routerStatusProber = require("../services/routerStatusProber");
const deviceCredentials = require("../services/deviceCredentials");
const customerController = require("../controllers/customerController");
const { normalizeMacAddress } = require("../utils/macAddress");

function responseRecorder() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function auditInsertsSeen(calls) {
  return calls
    .filter((call) => call.sql.includes("INSERT INTO audit_logs"))
    .map((call) => ({ customerId: call.params[0], adminId: call.params[1], action: call.params[2], details: JSON.parse(call.params[3] || "{}") }));
}

const CUSTOMER = { id: 29, username: "10019", full_name: "Test Customer", phone: "01711111111", password: "secret", package_name: "45 Mbps", profile: "45 Mbps", monthly_bill: 500, expiration_date: "2027-12-19", billing_cycle: "monthly", billing_duration_days: null, status: "active", router_mac: "AA:BB:CC:DD:EE:FF", pop_id: null, billing_expiry_override: false, router_id: null };
const PPPOE_ROW = { username: "10019", profile: "45 Mbps", password: "secret", disabled: false, remote_address: null, caller_id: "AA:BB:CC:DD:EE:FF", service: "pppoe", comment: "EXP: 2027-12-19" };
const FAKE_ROUTER = { id: 1, router_name: "Test", host: "127.0.0.1", api_type: "native_api", api_port: 1, username: "admin", password_encrypted: "x", is_active: true, use_ssl: false };

// db stub for resolveCustomer360 / profile(): answers the customer + PPPoE
// lookups, package/transaction lists, and (when routerRows is set) the
// router_devices lookup. UPDATE/INSERT calls are recorded, never executed.
function installDbStub(calls, { routerRows = [], callerId = "AA:BB:CC:DD:EE:FF", routerMac = "AA:BB:CC:DD:EE:FF" } = {}) {
  const originalQuery = db.query;
  const customer = { ...CUSTOMER, router_mac: routerMac };
  const pppoeRow = { ...PPPOE_ROW, caller_id: callerId };
  db.query = async (sql, params = []) => {
    calls.push({ sql, params });
    if (sql.includes("FROM router_devices")) return { rows: routerRows };
    if (sql.includes("FROM customers WHERE (id::text")) return { rows: [customer] };
    if (sql.includes("FROM customers WHERE LOWER(BTRIM(username))")) return { rows: [customer] };
    if (sql.includes("SELECT * FROM pppoe_users WHERE LOWER(username)")) return { rows: [pppoeRow] };
    if (sql.includes("SELECT * FROM pppoe_users WHERE LOWER(BTRIM(username))")) return { rows: [pppoeRow] };
    if (sql.includes("FROM pppoe_live_sessions")) return { rows: [] };
    if (sql.includes("FROM packages ORDER BY")) return { rows: [{ id: 40, plan_name: "45 Mbps", profile_name: "45 Mbps", pool_name: "PPPoE_Pool", price: 500, duration_months: 1, rate_limit: "45M/45M", remote_address: "PPPoE_Pool" }] };
    if (sql.includes("FROM transactions WHERE")) return { rows: [] };
    if (sql.includes("SELECT caller_id FROM pppoe_users")) return { rows: [{ caller_id: callerId }] };
    if (sql.includes("SELECT id,plan_name AS name")) return { rows: [{ id: 40, name: "45 Mbps", profileName: "45 Mbps", poolName: "PPPoE_Pool", price: 500, durationMonths: 1, rateLimit: "45M/45M", remoteAddress: "PPPoE_Pool" }] };
    if (sql.includes("SELECT trx_id,amount,channel AS method")) return { rows: [] };
    if (sql.includes("SELECT trx_id,amount,channel AS gateway")) return { rows: [] };
    return { rows: [], rowCount: 1 };
  };
  return () => { db.query = originalQuery; };
}

// Stub the pooled runtime behind getCustomerRouterService()/getActiveSessions
// (resolveCustomer360 + profile() reach the router through it).
function installRuntimeStub({ sessions = [], secret = null } = {}) {
  const pool = mikrotik.runtimePool;
  const originalGetRuntime = pool.getRuntime;
  const fakeRuntime = {
    getActiveSessionsSafe: async () => ({ live_sync: sessions.length ? "ok" : "unavailable", sessions, reachable: sessions.length > 0, latencyMs: 1, checkedAt: new Date().toISOString() }),
    getPppoeSecret: async () => secret,
    getActiveSessions: async () => sessions
  };
  pool.getRuntime = async () => fakeRuntime;
  return () => { pool.getRuntime = originalGetRuntime; };
}

// Stub a proxy-level mikrotik method (own property on the proxy target;
// the get trap returns own properties directly). Restores by delete.
function installProxyStub(name, fn) {
  const hadOwn = Object.prototype.hasOwnProperty.call(mikrotik, name);
  const original = mikrotik[name];
  mikrotik[name] = fn;
  return () => { if (hadOwn) mikrotik[name] = original; else delete mikrotik[name]; };
}

// Stub the background prober snapshot the 360 display paths read live
// sessions from (resolveCustomer360 / profile() / getCustomerLiveSession
// never call the router directly any more). Restores by reassignment.
function installProberStub(snapshot) {
  const original = routerStatusProber.getRouterStatusSnapshot;
  routerStatusProber.getRouterStatusSnapshot = () => snapshot;
  return () => { routerStatusProber.getRouterStatusSnapshot = original; };
}

function handlerReq(id, body = {}) {
  return { params: { id }, body, query: {}, tenantScope: { global: true }, session: { adminUser: "rabbi" }, ip: "test" };
}

test("normalizeMacAddress: accepts colon/dash/lowercase/compact forms, rejects the rest", () => {
  assert.equal(normalizeMacAddress("AA:BB:CC:DD:EE:FF"), "AA:BB:CC:DD:EE:FF");
  assert.equal(normalizeMacAddress("aa:bb:cc:dd:ee:ff"), "AA:BB:CC:DD:EE:FF");
  assert.equal(normalizeMacAddress("AA-BB-CC-DD-EE-FF"), "AA:BB:CC:DD:EE:FF");
  assert.equal(normalizeMacAddress("aabbccddeeff"), "AA:BB:CC:DD:EE:FF");
  assert.equal(normalizeMacAddress(""), null);
  assert.equal(normalizeMacAddress(null), null);
  assert.equal(normalizeMacAddress("not-a-mac"), null);
  assert.equal(normalizeMacAddress("AA:BB:CC:DD:EE"), null);
  assert.equal(normalizeMacAddress("GG:BB:CC:DD:EE:FF"), null);
});

test("setSecretCallerId: clearing sends an explicit empty caller-id param", async () => {
  const ServiceClass = mikrotik.MikroTikService;
  const svc = new ServiceClass();
  const writes = [];
  const originalWithConnection = svc._withConnection;
  svc._withConnection = async (_name, fn) => fn({
    write: async (command, params = []) => {
      writes.push({ command, params });
      if (command === "/ppp/secret/print") return [{ ".id": "*1", name: "10019", "caller-id": "AA:BB:CC:DD:EE:FF" }];
      return [];
    }
  });
  try {
    const cleared = await svc.setSecretCallerId("10019", "");
    assert.equal(cleared.callerId, "");
    const setCall = writes.find((w) => w.command === "/ppp/secret/set");
    assert.ok(setCall, "must issue /ppp/secret/set");
    assert.ok(setCall.params.includes("=caller-id="), "clearing must send an explicit empty caller-id, not omit it: " + JSON.stringify(setCall.params));
    writes.length = 0;
    const locked = await svc.setSecretCallerId("10019", "aa-bb-cc-dd-ee-ff");
    assert.equal(locked.callerId, "AA:BB:CC:DD:EE:FF");
    const setCall2 = writes.find((w) => w.command === "/ppp/secret/set");
    assert.ok(setCall2.params.includes("=caller-id=AA:BB:CC:DD:EE:FF"), "setting must send the normalized MAC");
    await assert.rejects(() => svc.setSecretCallerId("10019", "not-a-mac"), /Invalid MAC address/);
  } finally {
    svc._withConnection = originalWithConnection;
  }
});

test("syncPanelCustomerSecrets: an empty callerId is omitted (never re-applies a stale MAC)", async () => {
  const ServiceClass = mikrotik.MikroTikService;
  const svc = new ServiceClass();
  const writes = [];
  svc._withConnection = async (_name, fn) => fn({
    write: async (command, params = []) => {
      writes.push({ command, params });
      if (command === "/ppp/secret/print") return [{ ".id": "*1", name: "10019", service: "pppoe", password: "secret", profile: "45 Mbps", "caller-id": "" }];
      if (command === "/ppp/profile/print") return [{ name: "45 Mbps" }];
      return [];
    }
  });
  const result = await svc.syncPanelCustomerSecrets([{ username: "10019", password: "secret", profile: "45 Mbps", callerId: "" }]);
  assert.equal(result.updated, 1);
  // syncPanelCustomerSecrets issues /ppp/secret/set as a single ARRAY arg
  // (connection.write(command)), unlike setSecretCallerId (string + params).
  const isSet = (w) => (Array.isArray(w.command) ? w.command[0] : w.command) === "/ppp/secret/set";
  const setParams = (w) => Array.isArray(w.command) ? w.command.slice(1) : w.params;
  const setCall = writes.find(isSet);
  assert.ok(setCall, "must issue /ppp/secret/set");
  assert.ok(!setParams(setCall).some((p) => String(p).startsWith("=caller-id=")), "an unlocked customer must not get a caller-id re-applied by sync: " + JSON.stringify(setParams(setCall)));
  writes.length = 0;
  const locked = await svc.syncPanelCustomerSecrets([{ username: "10019", password: "secret", profile: "45 Mbps", callerId: "AA:BB:CC:DD:EE:FF" }]);
  assert.equal(locked.updated, 1);
  const setCall2 = writes.find(isSet);
  assert.ok(setCall2.params.includes("=caller-id=AA:BB:CC:DD:EE:FF") || setParams(setCall2).includes("=caller-id=AA:BB:CC:DD:EE:FF"), "a locked customer keeps its caller-id on sync");
});

test("lockCustomerMac: online customer locks to the live session MAC, updates DB + audit", async () => {
  const calls = [];
  const restoreDb = installDbStub(calls, { routerRows: [] });
  const restoreRuntime = installRuntimeStub({ sessions: [{ username: "10019", address: "10.20.0.9", callerId: "11:22:33:44:55:66", service: "pppoe" }], secret: { name: "10019", callerId: "AA:BB:CC:DD:EE:FF" } });
  const setCalls = [];
  const restoreGetSecret = installProxyStub("getPppoeSecret", async (username) => (setCalls.length ? { name: username, callerId: "11:22:33:44:55:66" } : { name: username, callerId: "AA:BB:CC:DD:EE:FF" }));
  const restoreSetCaller = installProxyStub("setSecretCallerId", async (username, callerId) => { setCalls.push({ username, callerId }); return { username, callerId }; });
  const restoreSessions = installProxyStub("getActiveSessionsSafe", async () => ({ live_sync: "ok", sessions: [{ username: "10019", address: "10.20.0.9", callerId: "11:22:33:44:55:66", service: "pppoe" }] }));
  const kickCalls = [];
  const restoreKick = installProxyStub("kickActiveUser", async (username) => { kickCalls.push(username); return { username, kicked: true, count: 1 }; });
  try {
    const res = responseRecorder();
    await customerController.lockCustomerMac(handlerReq("10019"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.locked, true);
    assert.equal(res.body.lockedMac, "11:22:33:44:55:66");
    assert.equal(setCalls.length, 1);
    assert.equal(setCalls[0].callerId, "11:22:33:44:55:66");
    // Session MAC == locked MAC, so no kick is needed.
    assert.equal(kickCalls.length, 0);
    const customerUpdate = calls.find((c) => c.sql.includes("UPDATE customers SET router_mac=$1"));
    assert.ok(customerUpdate, "must save the new MAC on customers.router_mac");
    assert.equal(customerUpdate.params[0], "11:22:33:44:55:66");
    const pppoeUpdate = calls.find((c) => c.sql.includes("UPDATE pppoe_users SET caller_id=$1"));
    assert.ok(pppoeUpdate, "must save the new MAC on pppoe_users.caller_id");
    assert.equal(pppoeUpdate.params[0], "11:22:33:44:55:66");
    const audits = auditInsertsSeen(calls);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "MAC_LOCK");
    assert.equal(audits[0].details.mac, "11:22:33:44:55:66");
    assert.equal(audits[0].details.previousMac, "AA:BB:CC:DD:EE:FF");
  } finally {
    restoreDb(); restoreRuntime(); restoreGetSecret(); restoreSetCaller(); restoreSessions(); restoreKick();
  }
});

test("lockCustomerMac: offline customer with no supplied MAC is refused", async () => {
  const calls = [];
  const restoreDb = installDbStub(calls, { routerRows: [] });
  const restoreRuntime = installRuntimeStub({ sessions: [], secret: { name: "10019", callerId: "" } });
  const restoreSessions = installProxyStub("getActiveSessionsSafe", async () => ({ live_sync: "unavailable", sessions: [] }));
  const setCalls = [];
  const restoreSetCaller = installProxyStub("setSecretCallerId", async (username, callerId) => { setCalls.push({ username, callerId }); return { username, callerId }; });
  try {
    const res = responseRecorder();
    await customerController.lockCustomerMac(handlerReq("10019"), res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.match(res.body.message, /offline/i);
    assert.equal(setCalls.length, 0, "must not touch the router when there is no MAC to lock");
  } finally {
    restoreDb(); restoreRuntime(); restoreSessions(); restoreSetCaller();
  }
});

test("lockCustomerMac: offline customer locks to an admin-supplied MAC", async () => {
  const calls = [];
  const restoreDb = installDbStub(calls, { routerRows: [] });
  const restoreRuntime = installRuntimeStub({ sessions: [], secret: { name: "10019", callerId: "" } });
  const restoreSessions = installProxyStub("getActiveSessionsSafe", async () => ({ live_sync: "unavailable", sessions: [] }));
  let secretNow = "";
  const restoreGetSecret = installProxyStub("getPppoeSecret", async () => ({ name: "10019", callerId: secretNow }));
  const setCalls = [];
  const restoreSetCaller = installProxyStub("setSecretCallerId", async (username, callerId) => { setCalls.push({ username, callerId }); secretNow = callerId; return { username, callerId }; });
  try {
    const res = responseRecorder();
    await customerController.lockCustomerMac(handlerReq("10019", { mac: "aa-bb-cc-dd-ee-01" }), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.lockedMac, "AA:BB:CC:DD:EE:01");
    assert.equal(setCalls[0].callerId, "AA:BB:CC:DD:EE:01");
  } finally {
    restoreDb(); restoreRuntime(); restoreSessions(); restoreGetSecret(); restoreSetCaller();
  }
});

test("lockCustomerMac: already locked to the same MAC is a no-op", async () => {
  const calls = [];
  const restoreDb = installDbStub(calls, { routerRows: [] });
  const restoreRuntime = installRuntimeStub({ sessions: [{ username: "10019", callerId: "AA:BB:CC:DD:EE:FF", service: "pppoe" }], secret: { name: "10019", callerId: "AA:BB:CC:DD:EE:FF" } });
  const restoreGetSecret = installProxyStub("getPppoeSecret", async () => ({ name: "10019", callerId: "AA:BB:CC:DD:EE:FF" }));
  const restoreSessions = installProxyStub("getActiveSessionsSafe", async () => ({ live_sync: "ok", sessions: [{ username: "10019", callerId: "AA:BB:CC:DD:EE:FF", service: "pppoe" }] }));
  const setCalls = [];
  const restoreSetCaller = installProxyStub("setSecretCallerId", async (username, callerId) => { setCalls.push({ username, callerId }); return { username, callerId }; });
  try {
    const res = responseRecorder();
    await customerController.lockCustomerMac(handlerReq("10019"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.alreadyLocked, true);
    assert.equal(setCalls.length, 0, "must not rewrite the router secret when already locked");
    assert.equal(auditInsertsSeen(calls).length, 0, "no audit row for a no-op");
  } finally {
    restoreDb(); restoreRuntime(); restoreGetSecret(); restoreSessions(); restoreSetCaller();
  }
});

test("unlockCustomerMac: clears the router caller-id and both stored MACs, audits MAC_UNLOCK", async () => {
  const calls = [];
  const restoreDb = installDbStub(calls, { routerRows: [] });
  const restoreRuntime = installRuntimeStub({ sessions: [], secret: { name: "10019", callerId: "AA:BB:CC:DD:EE:FF" } });
  let secretNow = "AA:BB:CC:DD:EE:FF";
  const restoreGetSecret = installProxyStub("getPppoeSecret", async () => ({ name: "10019", callerId: secretNow }));
  const setCalls = [];
  const restoreSetCaller = installProxyStub("setSecretCallerId", async (username, callerId) => { setCalls.push({ username, callerId }); if (callerId === "") secretNow = ""; return { username, callerId }; });
  try {
    const res = responseRecorder();
    await customerController.unlockCustomerMac(handlerReq("10019"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.locked, false);
    assert.equal(res.body.previousMac, "AA:BB:CC:DD:EE:FF");
    assert.equal(setCalls.length, 1);
    assert.equal(setCalls[0].callerId, "", "unlock must send an explicit empty caller-id");
    const customerUpdate = calls.find((c) => c.sql.includes("UPDATE customers SET router_mac=NULL"));
    assert.ok(customerUpdate, "must clear customers.router_mac so the next sync cannot re-apply the old MAC");
    const pppoeUpdate = calls.find((c) => c.sql.includes("UPDATE pppoe_users SET caller_id=NULL"));
    assert.ok(pppoeUpdate, "must clear pppoe_users.caller_id");
    const audits = auditInsertsSeen(calls);
    assert.equal(audits.length, 1);
    assert.equal(audits[0].action, "MAC_UNLOCK");
    assert.equal(audits[0].details.previousMac, "AA:BB:CC:DD:EE:FF");
  } finally {
    restoreDb(); restoreRuntime(); restoreGetSecret(); restoreSetCaller();
  }
});

test("unlockCustomerMac: already unlocked is a no-op", async () => {
  const calls = [];
  const restoreDb = installDbStub(calls, { routerRows: [], callerId: null, routerMac: null });
  const restoreRuntime = installRuntimeStub({ sessions: [], secret: { name: "10019", callerId: "" } });
  const restoreGetSecret = installProxyStub("getPppoeSecret", async () => ({ name: "10019", callerId: "" }));
  const setCalls = [];
  const restoreSetCaller = installProxyStub("setSecretCallerId", async (username, callerId) => { setCalls.push({ username, callerId }); return { username, callerId }; });
  try {
    const res = responseRecorder();
    await customerController.unlockCustomerMac(handlerReq("10019"), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.alreadyUnlocked, true);
    assert.equal(setCalls.length, 0, "must not touch the router when already unlocked");
  } finally {
    restoreDb(); restoreRuntime(); restoreGetSecret(); restoreSetCaller();
  }
});

test("profile(): macLock shows the enforced lock, the live session MAC, and the stored MAC separately", async () => {
  const calls = [];
  const restoreDb = installDbStub(calls, { routerRows: [FAKE_ROUTER] });
  // profile() reads the live session from the background prober snapshot,
  // never from a per-request router call.
  const restoreProber = installProberStub({ state: "online", online: true, lastSeenAt: new Date().toISOString(), data: { sessions: [{ username: "10019", address: "10.20.0.9", callerId: "11:22:33:44:55:66", service: "pppoe", uptime: "1h", bytesIn: "10", bytesOut: "20" }] } });
  try {
    const res = responseRecorder();
    await customerController.profile({ query: { username: "10019" }, tenantScope: { global: true } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.deepEqual(res.body.macLock, {
      locked: true,
      lockedMac: "AA:BB:CC:DD:EE:FF",
      liveMac: "11:22:33:44:55:66",
      storedMac: "AA:BB:CC:DD:EE:FF"
    });
  } finally {
    restoreDb(); restoreProber();
  }
});

test("profile(): router unreachable falls back to the stored MAC for the lock", async () => {
  const calls = [];
  const restoreDb = installDbStub(calls, { routerRows: [] });
  // "Router unreachable" is an offline prober snapshot now: profile()
  // never calls the router directly, so no router stub is needed.
  const restoreProber = installProberStub({ state: "offline", online: false, lastSeenAt: new Date(Date.now() - 600000).toISOString(), data: { sessions: [{ username: "10019", address: "10.20.0.9", callerId: "11:22:33:44:55:66", service: "pppoe" }] } });
  try {
    const res = responseRecorder();
    await customerController.profile({ query: { username: "10019" }, tenantScope: { global: true } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.macLock.locked, true);
    assert.equal(res.body.macLock.lockedMac, "AA:BB:CC:DD:EE:FF");
    assert.equal(res.body.macLock.liveMac, "");
    assert.equal(res.body.live.online, false);
  } finally {
    restoreDb(); restoreProber();
  }
});

test("getCustomerProfileById: macLock is present for the dedicated 360 page", async () => {
  const calls = [];
  const restoreDb = installDbStub(calls, { routerRows: [] });
  const restoreRuntime = installRuntimeStub({ sessions: [], secret: { name: "10019", callerId: "AA:BB:CC:DD:EE:FF" } });
  try {
    const res = responseRecorder();
    await customerController.getCustomerProfileById({ params: { id: "10019" }, tenantScope: { global: true } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.macLock.locked, true);
    assert.equal(res.body.macLock.lockedMac, "AA:BB:CC:DD:EE:FF");
    assert.equal(res.body.macLock.liveMac, "");
    assert.equal(res.body.macLock.storedMac, "AA:BB:CC:DD:EE:FF");
  } finally {
    restoreDb(); restoreRuntime();
  }
});
