"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("canonical Hotspot deletion has no financial or voucher hard-delete SQL", () => {
  const service = read("services/hotspotDeletionService.js");
  const controller = read("controllers/hotspotController.js");
  const subscriberController = read("controllers/hotspotUserController.js");
  const retention = read("jobs/hotspotExpirationCleanup.js");
  for (const [name, source] of Object.entries({ service, controller, subscriberController, retention })) {
    assert.equal(["DELETE FROM hotspot_vouchers","DELETE FROM hotspot_voucher_payments","DELETE FROM transactions"].some(sql => source.toLowerCase().includes(sql.toLowerCase())), false, name + " must preserve voucher and financial rows");
  }
  assert.ok(service.includes("SET status='deleted'"));
  assert.ok(service.includes("last_known_mac=COALESCE"));
  assert.ok(service.includes("mac_audit_history=COALESCE(v.mac_audit_history"));
  assert.ok(service.includes("jsonb_agg(mac_value ORDER BY ordinal"));
  assert.ok(retention.includes("mac_audit_history=COALESCE(v.mac_audit_history"));
  assert.ok(retention.includes("jsonb_agg(mac_value ORDER BY ordinal"));
  assert.ok(service.includes("mac_address=NULL"));
  assert.ok(retention.includes("UPDATE hotspot_vouchers AS v SET status='archived'"));
});

test("RouterOS purge requires fresh reads of all four resource layers before verified success", () => {
  const source = read("services/mikrotikService.js");
  for (const path of [
    '/ip/hotspot/active/print',
    '/ip/hotspot/cookie/print',
    '/ip/hotspot/host/print',
    '/ip/hotspot/user/print'
  ]) assert.ok(source.includes('connection.write("' + path + '")'), "missing fresh read: " + path);
  assert.ok(source.includes("HOTSPOT_PURGE_VERIFICATION_FAILED"));
  assert.ok(source.includes("verified: true"));
});

test("schema and migration retain last-known MAC and allow the deleted lifecycle state", () => {
  const schema = read("db/schema.sql");
  const migration = read("db/migrations/20261025_unified_hotspot_deletion_purge.sql");
  assert.ok(schema.includes("ADD COLUMN IF NOT EXISTS last_known_mac VARCHAR(32)"));
  assert.ok(schema.includes("ADD COLUMN IF NOT EXISTS mac_audit_history JSONB"));
  assert.ok(schema.includes("'archived','deleted'"));
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS last_known_mac VARCHAR(32)"));
  assert.ok(migration.includes("ADD COLUMN IF NOT EXISTS mac_audit_history JSONB"));
  assert.ok(migration.includes("'archived','deleted'"));
  assert.ok(migration.includes("NOT VALID"));
  assert.equal(migration.toUpperCase().includes("DELETE FROM"), false);
});
