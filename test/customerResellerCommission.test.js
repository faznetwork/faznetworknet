"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const mikrotik = require("../services/mikrotikService");
const customerController = require("../controllers/customerController");

function responseRecorder() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function baseCustomer() {
  return {
    id: 42, full_name: "Reseller Test Customer", phone: "01712345678", username: "01712345678",
    password: "secret", package_name: "Home 30", profile: "HOME30", monthly_bill: 500,
    expiration_date: "2026-11-30", billing_cycle: "monthly", billing_duration_days: null,
    billing_expiry_override: false, connection_date: "2025-01-01", billing_status: "unpaid",
    status: "active", remarks: "existing note", area_zone: "North POP",
    reseller_commission_type: "percentage", reseller_commission_rate: "0.00"
  };
}

function installMocks() {
  const originalQuery = db.query;
  const originalTest = mikrotik.testConnection;
  const sqlSeen = [];
  const paramsSeen = [];
  mikrotik.testConnection = async () => false;
  db.query = async (sql, params = []) => {
    sqlSeen.push(sql);
    paramsSeen.push(params);
    if (sql.includes("SELECT * FROM customers WHERE id::text=$1")) return { rows: [baseCustomer()] };
    if (sql.startsWith("SELECT id FROM customers WHERE id<>")) return { rows: [] };
    if (sql.includes("SELECT id,plan_name,pool_name,rate_limit,price,duration_months,profile_name FROM packages")) {
      return { rows: [{ id: 7, plan_name: "Home 30", profile_name: "HOME30", price: 500, duration_months: 1, pool_name: "", rate_limit: "30M" }] };
    }
    if (sql.startsWith("UPDATE customers SET")) return { rows: [{ ...baseCustomer(), reseller_commission_type: params[30], reseller_commission_rate: params[31] }] };
    return { rows: [] };
  };
  return {
    sqlSeen, paramsSeen,
    restore() { db.query = originalQuery; mikrotik.testConnection = originalTest; }
  };
}

test("updateCustomer persists fixed reseller commission without changing billing amount", async () => {
  const mock = installMocks();
  try {
    const res = responseRecorder();
    await customerController.updateCustomer({
      params: { id: "42" },
      body: { id: "42", username: "01712345678", resellerCommissionType: "fixed", resellerCommissionRate: "75.25" },
      ip: "test"
    }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    const index = mock.sqlSeen.findIndex(sql => sql.startsWith("UPDATE customers SET"));
    assert.notEqual(index, -1);
    assert.match(mock.sqlSeen[index], /reseller_commission_type=\$31,reseller_commission_rate=\$32/);
    assert.equal(mock.paramsSeen[index][30], "fixed");
    assert.equal(mock.paramsSeen[index][31], 75.25);
    assert.equal(mock.paramsSeen[index][6], 500, "monthly bill must remain the package price");
  } finally {
    mock.restore();
  }
});

test("updateCustomer rejects percentage commission above 100 before writing", async () => {
  const mock = installMocks();
  try {
    const res = responseRecorder();
    await customerController.updateCustomer({
      params: { id: "42" },
      body: { id: "42", username: "01712345678", resellerCommissionType: "percentage", resellerCommissionRate: "100.01" },
      ip: "test"
    }, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /between 0 and 100/i);
    assert.equal(mock.sqlSeen.some(sql => sql.startsWith("UPDATE customers SET")), false);
  } finally {
    mock.restore();
  }
});


test("listCustomers filters by zone server-side and returns all-zone counts", async () => {
  const originalQuery = db.query;
  const originalSessions = mikrotik.getActiveSessions;
  const rows = [
    { id: 1, full_name: "North Customer", phone: "01711111111", username: "north-user", area_zone: "North POP", expiration_date: "2099-12-31", billing_status: "paid", status: "active", created_at: "2026-01-01" },
    { id: 2, full_name: "South Customer", phone: "01722222222", username: "south-user", area_zone: "South POP", expiration_date: "2099-12-31", billing_status: "paid", status: "active", created_at: "2026-01-02" },
    { id: 3, full_name: "Direct Customer", phone: "01733333333", username: "direct-user", area_zone: null, expiration_date: "2099-12-31", billing_status: "unpaid", status: "active", created_at: "2026-01-03" }
  ];
  try {
    db.query = async sql => sql.includes("FROM customers c") ? { rows } : { rows: [] };
    mikrotik.getActiveSessions = async () => [];
    const res = responseRecorder();
    await customerController.listCustomers({ query: { status: "all", zone: "North POP" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.count, 1);
    assert.equal(res.body.total, 3);
    assert.equal(res.body.zone, "North POP");
    assert.deepEqual(res.body.users.map(user => user.username), ["north-user"]);
    assert.equal(res.body.zoneCounts.all, 3);
    assert.equal(res.body.zoneCounts["North POP"], 1);
    assert.equal(res.body.zoneCounts["South POP"], 1);
    assert.equal(res.body.zoneCounts["FAZ Main"], 1);
  } finally {
    db.query = originalQuery;
    mikrotik.getActiveSessions = originalSessions;
  }
});
