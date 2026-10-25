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
  assert.match(schema, /hotspot_vouchers_status_check CHECK \(status IN \([^;]*'archived'[^;]*'deleted'[^;]*\)\)/);\n  assert.ok(schema.includes("ADD COLUMN IF NOT EXISTS last_known_mac VARCHAR(32)"));
});

test("forward migration adds archived without validating unrelated legacy rows", () => {
  const migration = read("db/migrations/20261018_hotspot_archive_status.sql");
  assert.match(migration, /DROP CONSTRAINT IF EXISTS hotspot_vouchers_status_check/);
  assert.match(migration, /CHECK \(status IN \([^;]*'archived'[^;]*\)\)\s+NOT VALID/);
});

test("delete endpoint delegates to the canonical RouterOS-verified soft-delete service", async () => {
  const controllerPath = path.resolve(root, "controllers/hotspotUserController.js");
  let serviceArgs = null;
  const originalLoad = Module._load;
  delete require.cache[controllerPath];
  Module._load = function(request, parent, isMain) {
    if (parent && parent.filename === controllerPath && request === "../services/hotspotDeletionService") {
      return { deleteHotspotSubscriber: async args => {
        serviceArgs = args;
        return { success: true, deleted: true, softDeleted: true, username: "TEST-USER", voucher: { id: 42, status: "deleted", last_known_mac: "AA:BB:CC:DD:EE:FF" }, purge: { verified: true } };
      }};
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    const controller = require(controllerPath);
    const response = {
      statusCode: 200, body: null,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await controller.archive({ params: { id: "42" } }, response);
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.success, true);
    assert.equal(response.body.voucher.status, "deleted");
    assert.equal(serviceArgs.identifier, "42");
  } finally {
    Module._load = originalLoad;
    delete require.cache[controllerPath];
  }
});
