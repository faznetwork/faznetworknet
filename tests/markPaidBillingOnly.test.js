"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const mikrotikService = require("../services/mikrotikService");
const customerController = require("../controllers/customerController");

test("markPaid changes billing state only and never renews or writes to MikroTik", async () => {
  const originals = {
    withTransaction: db.withTransaction,
    query: db.query,
    updateSecret: mikrotikService.updateSecret,
    kickActiveUser: mikrotikService.kickActiveUser
  };
  const statements = [];
  let routerWrites = 0;
  const customer = {
    id: 41,
    username: "fiber-user-41",
    expiration_date: "2026-11-02",
    package_name: "Home 50"
  };
  const pppoeUser = {
    id: 901,
    username: "fiber-user-41",
    expiry_date: "2026-11-02"
  };
  db.withTransaction = async callback => callback({
    query: async (sql, params = []) => {
      statements.push({ sql: String(sql), params });
      if (/SELECT \* FROM customers/i.test(sql)) return { rows: [customer], rowCount: 1 };
      if (/SELECT \* FROM pppoe_users/i.test(sql)) return { rows: [pppoeUser], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    }
  });
  db.query = async (sql, params = []) => {
    statements.push({ sql: String(sql), params });
    return { rows: [], rowCount: 1 };
  };
  mikrotikService.updateSecret = async () => { routerWrites++; };
  mikrotikService.kickActiveUser = async () => { routerWrites++; };

  const res = {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };

  try {
    await customerController.markPaid(
      { body: { username: "fiber-user-41" }, session: { adminUser: "test-admin" }, ip: "127.0.0.1" },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload?.success, true);
    assert.equal(res.payload?.paidUntil, "2026-11-02");
    assert.match(res.payload?.message || "", /expiry date and MikroTik settings were not changed/i);

    const updates = statements.filter(entry => /^\s*UPDATE\s+(customers|pppoe_users)/i.test(entry.sql));
    assert.equal(updates.length, 2, "both billing records should be updated");
    for (const { sql } of updates) {
      assert.match(sql, /billing_status\s*=\s*'paid'/i);
      assert.doesNotMatch(sql, /\b(?:expiration_date|expiry_date|profile|disabled|status)\s*=/i);
    }
    assert.equal(routerWrites, 0, "mark-paid must not call MikroTik write/kick methods");
    assert.ok(statements.some(entry => entry.sql.includes("INSERT INTO audit_logs") && entry.params[2] === "MARK_PAID"));
  } finally {
    db.withTransaction = originals.withTransaction;
    db.query = originals.query;
    mikrotikService.updateSecret = originals.updateSecret;
    mikrotikService.kickActiveUser = originals.kickActiveUser;
  }
});
