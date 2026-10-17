"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Hotspot schema permits the archived lifecycle state", () => {
  const schema = read("db/schema.sql");
  assert.match(schema, /hotspot_vouchers_status_check CHECK \(status IN \([^;]*'archived'[^;]*\)\)/);
});

test("forward migration adds archived without validating unrelated legacy rows", () => {
  const migration = read("db/migrations/20261018_hotspot_archive_status.sql");
  assert.match(migration, /DROP CONSTRAINT IF EXISTS hotspot_vouchers_status_check/);
  assert.match(migration, /CHECK \(status IN \([^;]*'archived'[^;]*\)\)\s+NOT VALID/);
});

test("archive endpoint targets the canonical PostgreSQL record and never mutates RouterOS", async () => {
  const controllerPath = path.resolve(root, "controllers/hotspotUserController.js");
  const calls = [];
  const db = {
    async query(sql, params = []) {
      calls.push({ sql, params });
      if (sql.startsWith("SELECT id FROM hotspot_vouchers")) return { rows: [{ id: 42 }] };
      if (sql.startsWith("UPDATE hotspot_vouchers SET status='archived'")) {
        return { rows: [{ id: 42, username: "TEST-USER", status: "archived" }] };
      }
      throw new Error("Unexpected SQL in archive test");
    }
  };
  const mikrotik = new Proxy({}, { get() { return async () => { throw new Error("RouterOS must not be called"); }; } });
  const originalLoad = Module._load;
  delete require.cache[controllerPath];
  Module._load = function(request, parent, isMain) {
    if (parent && parent.filename === controllerPath && request === "../db") return db;
    if (parent && parent.filename === controllerPath && request === "../services/mikrotikService") return mikrotik;
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const controller = require(controllerPath);
    const response = {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; },
      set() { return this; }
    };
    await controller.archive({ params: { id: "42" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.subscriber.status, "archived");
    assert.equal(calls.length, 2);
    assert.match(calls[1].sql, /SET status='archived'/);
    assert.deepEqual(calls[1].params, [42]);
  } finally {
    Module._load = originalLoad;
    delete require.cache[controllerPath];
  }
});
