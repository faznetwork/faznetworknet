"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const mikrotik = require("../services/mikrotikService");
const customerController = require("../controllers/customerController");
const pppoeController = require("../controllers/pppoeController");
const notificationDispatcher = require("../services/notificationDispatcher");

function responseRecorder() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}
function auditInsertsSeen(calls) {
  return calls
    .filter((call) => call.sql.includes("INSERT INTO audit_logs"))
    .map((call) => ({ customerId: call.params[0], adminId: call.params[1], action: call.params[2], details: JSON.parse(call.params[3] || "{}") }));
}
function mockDispatcher() {
  const original = notificationDispatcher.dispatchNotification;
  notificationDispatcher.dispatchNotification = () => ({ accepted: true, task: Promise.resolve({ success: true, results: [] }) });
  return () => { notificationDispatcher.dispatchNotification = original; };
}

test("F1: effectiveProfile falls back to EXPIRED-PROFILE (never EXPIRED) for expired customers", async () => {
  const originalEnv = process.env.EXPIRED_PROFILE_NAME;
  try {
    delete process.env.EXPIRED_PROFILE_NAME;
    assert.equal(customerController.effectiveProfile("45 Mbps", "2020-01-01"), "EXPIRED-PROFILE");
    assert.equal(customerController.effectiveProfile("", "2020-01-01"), "EXPIRED-PROFILE");
    assert.equal(customerController.effectiveProfile("45 Mbps", "2099-01-01"), "45 Mbps");
    process.env.EXPIRED_PROFILE_NAME = "QUARANTINE";
    assert.equal(customerController.effectiveProfile("45 Mbps", "2020-01-01"), "QUARANTINE");
  } finally {
    if (originalEnv === undefined) delete process.env.EXPIRED_PROFILE_NAME;
    else process.env.EXPIRED_PROFILE_NAME = originalEnv;
  }
});

test("F1: renew updates pppoe_users.profile to the restored package profile", async () => {
  const originalQuery = db.query;
  const originalUpdate = mikrotik.updateSecret, originalKick = mikrotik.kickActiveUser;
  const restoreDispatcher = mockDispatcher();
  const calls = [];
  try {
    mikrotik.updateSecret = async () => ({ username: "10019" });
    mikrotik.kickActiveUser = async () => ({ username: "10019", kicked: true, count: 1, message: "Active PPPoE session disconnected." });
    db.query = async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("SELECT * FROM customers WHERE LOWER(username)")) return { rows: [{ id: 29, username: "10019", full_name: "Stale Mirror", phone: "01711111111", password: "secret", package_name: "45 Mbps", profile: "45 Mbps", monthly_bill: 500, expiration_date: "2027-12-19", billing_cycle: "monthly", billing_duration_days: null }] };
      if (sql.includes("SELECT * FROM pppoe_users WHERE LOWER(username)")) return { rows: [{ username: "10019", profile: "EXPIRED", password: "secret", phone: "01711111111" }] };
      if (sql.includes("SELECT profile_name FROM packages")) return { rows: [{ profile_name: "45 Mbps" }] };
      return { rows: [] };
    };
    const res = responseRecorder();
    await customerController.renew({ body: { username: "10019" }, session: { adminUser: "rabbi" }, ip: "test" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const pppoeUpdate = calls.find((call) => call.sql.includes("UPDATE pppoe_users SET profile=$1"));
    assert.ok(pppoeUpdate, "renew must update pppoe_users.profile");
    assert.equal(pppoeUpdate.params[0], "45 Mbps", "stale EXPIRED mirror must be restored to the package profile");
    assert.equal(pppoeUpdate.params[3], "10019");
  } finally {
    db.query = originalQuery;
    mikrotik.updateSecret = originalUpdate;
    mikrotik.kickActiveUser = originalKick;
    restoreDispatcher();
  }
});

test("F1: renewCustomerById updates pppoe_users.profile to the restored package profile", async () => {
  const originalQuery = db.query;
  const originalUpdate = mikrotik.updateSecret, originalKick = mikrotik.kickActiveUser;
  const originalGetRuntime = mikrotik.runtimePool.getRuntime, originalSessions = mikrotik.getActiveSessionsSafe;
  const restoreDispatcher = mockDispatcher();
  const calls = [];
  try {
    mikrotik.runtimePool.getRuntime = () => mikrotik;
    mikrotik.getActiveSessionsSafe = async () => ({ live_sync: "unavailable", sessions: [] });
    mikrotik.updateSecret = async () => ({ username: "10019" });
    mikrotik.kickActiveUser = async () => ({ username: "10019", kicked: true, count: 1, message: "Active PPPoE session disconnected." });
    const customerRow = { id: 29, username: "10019", full_name: "Stale Mirror", phone: "01711111111", password: "secret", package_name: "45 Mbps", profile: "45 Mbps", monthly_bill: 500, expiration_date: "2027-12-19", billing_cycle: "monthly", billing_duration_days: null, billing_expiry_override: false, status: "active" };
    db.query = async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("FROM router_devices")) return { rows: [{ id: 3, router_name: "Test Router", host: "127.0.0.1", api_type: "native_api", api_port: 8728, is_active: true }] };
      if (sql.startsWith("SELECT * FROM customers WHERE (id::text=$1")) return { rows: [customerRow] };
      if (sql.includes("FROM pppoe_users WHERE LOWER(username)")) return { rows: [{ username: "10019", profile: "EXPIRED", password: "secret" }] };
      if (sql.includes("FROM pppoe_live_sessions")) return { rows: [] };
      if (sql.includes("FROM packages ORDER BY price")) return { rows: [{ id: 1, name: "45 Mbps", profileName: "45 Mbps", poolName: "", price: 500, durationMonths: 1, rateLimit: "", remoteAddress: "" }] };
      if (sql.includes("FROM transactions WHERE LOWER")) return { rows: [] };
      return { rows: [] };
    };
    const res = responseRecorder();
    await customerController.renewCustomerById({ params: { id: "29" }, tenantScope: { global: true }, body: { amount: 500, paymentMethod: "cash" }, session: { adminUser: "rabbi" }, ip: "test" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const pppoeUpdate = calls.find((call) => call.sql.includes("UPDATE pppoe_users SET profile=$1"));
    assert.ok(pppoeUpdate, "renewCustomerById must update pppoe_users.profile");
    assert.equal(pppoeUpdate.params[0], "45 Mbps", "stale EXPIRED mirror must be restored to the package profile");
    assert.equal(pppoeUpdate.params[3], "10019");
  } finally {
    db.query = originalQuery;
    mikrotik.updateSecret = originalUpdate;
    mikrotik.kickActiveUser = originalKick;
    mikrotik.runtimePool.getRuntime = originalGetRuntime;
    mikrotik.getActiveSessionsSafe = originalSessions;
    restoreDispatcher();
  }
});

test("F2: POST /kick handler writes a KICK audit row when a session was kicked", async () => {
  const originalQuery = db.query;
  const originalKick = mikrotik.kickActiveUser;
  const calls = [];
  try {
    mikrotik.kickActiveUser = async () => ({ username: "10019", kicked: true, count: 1, message: "Active PPPoE session disconnected." });
    db.query = async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("SELECT id,router_id FROM customers")) return { rows: [{ id: 29, router_id: 3 }] };
      return { rows: [] };
    };
    const res = responseRecorder();
    await customerController.kickActiveUserByUsername({ body: { username: "10019" }, session: { adminUser: "rabbi" }, ip: "10.0.0.1" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.kicked, true);
    const audits = auditInsertsSeen(calls);
    assert.equal(audits.length, 1, "exactly one audit row must be written");
    assert.equal(audits[0].action, "KICK");
    assert.equal(audits[0].adminId, "rabbi");
    assert.equal(audits[0].customerId, 29);
    assert.equal(audits[0].details.username, "10019");
    assert.equal(audits[0].details.sessions, 1);
  } finally {
    db.query = originalQuery;
    mikrotik.kickActiveUser = originalKick;
  }
});

test("F2: POST /kick handler writes no audit row when the user was already offline", async () => {
  const originalQuery = db.query;
  const originalKick = mikrotik.kickActiveUser;
  const calls = [];
  try {
    mikrotik.kickActiveUser = async () => ({ username: "10019", kicked: false, count: 0, message: "Customer is already offline; no active PPPoE session was found." });
    db.query = async (sql, params = []) => { calls.push({ sql, params }); return { rows: [] }; };
    const res = responseRecorder();
    await customerController.kickActiveUserByUsername({ body: { username: "10019" }, session: { adminUser: "rabbi" }, ip: "10.0.0.1" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.kicked, false);
    assert.equal(auditInsertsSeen(calls).length, 0, "no kick happened, so no KICK audit row");
  } finally {
    db.query = originalQuery;
    mikrotik.kickActiveUser = originalKick;
  }
});

test("F2: pppoeController.kickUser writes a KICK audit row when a session was kicked", async () => {
  const originalQuery = db.query;
  const originalKick = mikrotik.kickActiveUser;
  const calls = [];
  try {
    mikrotik.kickActiveUser = async () => ({ username: "10019", kicked: true, count: 1, message: "Active PPPoE session disconnected." });
    db.query = async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("SELECT id,router_id FROM customers")) return { rows: [{ id: 29, router_id: 3 }] };
      return { rows: [] };
    };
    const res = responseRecorder();
    await pppoeController.kickUser({ body: { username: "10019" }, session: { adminUser: "rabbi" }, ip: "10.0.0.1" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.kicked, true);
    const audits = auditInsertsSeen(calls);
    assert.equal(audits.length, 1, "exactly one audit row must be written");
    assert.equal(audits[0].action, "KICK");
    assert.equal(audits[0].adminId, "rabbi");
    assert.equal(audits[0].customerId, 29);
    assert.equal(audits[0].details.username, "10019");
    assert.equal(audits[0].details.sessions, 1);
  } finally {
    db.query = originalQuery;
    mikrotik.kickActiveUser = originalKick;
  }
});

test("F3: bulk sync writes a BULK_SYNC_MIKROTIK audit row with real counts", async () => {
  const originalQuery = db.query;
  const originalSync = mikrotik.syncPanelCustomerSecrets;
  const calls = [];
  try {
    mikrotik.syncPanelCustomerSecrets = async () => ({ results: [{ username: "10019", status: "updated" }, { username: "10013", status: "created" }], updated: 1, created: 1, skipped: 0, failed: 0 });
    db.query = async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes("FROM customers c")) return { rows: [
        { id: 29, username: "10019", password: "secret", profile: "45 Mbps", full_name: "Active", phone: "01711111111", router_mac: null, expiration_date: "2027-12-19", remarks: "", status: "active", billing_expiry_override: false, router_disabled: false, stored_caller_id: null },
        { id: 30, username: "10013", password: "secret", profile: "45 Mbps", full_name: "Expired", phone: "01722222222", router_mac: null, expiration_date: "2020-01-01", remarks: "", status: "expired", billing_expiry_override: false, router_disabled: false, stored_caller_id: null }
      ] };
      return { rows: [] };
    };
    const res = responseRecorder();
    await customerController.syncPanelCustomersToMikroTik({ session: { adminUser: "rabbi" }, ip: "10.0.0.1" }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.updated, 1);
    assert.equal(res.body.created, 1);
    const audits = auditInsertsSeen(calls);
    assert.equal(audits.length, 1, "exactly one bulk-sync audit row must be written");
    assert.equal(audits[0].action, "BULK_SYNC_MIKROTIK");
    assert.equal(audits[0].adminId, "rabbi");
    assert.equal(audits[0].details.total, 2);
    assert.equal(audits[0].details.updated, 1);
    assert.equal(audits[0].details.created, 1);
    assert.equal(audits[0].details.skipped, 0);
    assert.equal(audits[0].details.failed, 0);
    const expiredUpsert = calls.find((call) => call.sql.includes("INSERT INTO pppoe_users") && call.params[0] === "10013");
    assert.ok(expiredUpsert, "expired customer must still be mirrored to pppoe_users");
    assert.equal(expiredUpsert.params[2], "EXPIRED-PROFILE", "bulk sync must apply EXPIRED-PROFILE, never EXPIRED");
  } finally {
    db.query = originalQuery;
    mikrotik.syncPanelCustomerSecrets = originalSync;
  }
});
