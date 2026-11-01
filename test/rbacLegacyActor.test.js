"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const { requireRole } = require("../middleware/rbac");

test("legacy shared-admin session falls back to the configured active super-admin identity", async () => {
  const originalQuery = db.query;
  const originalUsername = process.env.ADMIN_USERNAME;
  const statements = [];
  process.env.ADMIN_USERNAME = "rabbi";
  db.query = async (sql, args) => {
    statements.push({ sql, args });
    if (args[0] === "admin") return { rows: [] };
    if (args[0] === "rabbi") return { rows: [{ id: 11 }] };
    throw new Error("Unexpected username lookup");
  };

  const req = {
    session: { isAdmin: true, role: "super_admin", adminUser: "admin" },
    originalUrl: "/api/admin/reseller-finance/accounts/2/wallet-topups",
    method: "POST"
  };
  let continued = false;
  const res = { status() { return this; }, json(body) { this.body = body; return this; } };
  try {
    await requireRole(["super_admin"])(req, res, () => { continued = true; });
    assert.equal(continued, true);
    assert.equal(req.session.userId, 11);
    assert.equal(req.auth.userId, 11);
    assert.deepEqual(statements.map(statement => statement.args[0]), ["admin", "rabbi"]);
  } finally {
    db.query = originalQuery;
    if (originalUsername === undefined) delete process.env.ADMIN_USERNAME;
    else process.env.ADMIN_USERNAME = originalUsername;
  }
});
