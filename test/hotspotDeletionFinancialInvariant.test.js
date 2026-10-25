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
    assert.doesNotMatch(source, /DELETE\\s+FROM\\s+(?:public\\.)?(?:hotspot_vouchers|hotspot_voucher_payments|transactions)\\b/i, name + " must preserve all voucher and financial rows");
  }
  assert.match(service, /SET status='deleted'/);
  assert.match(service, /last_known_mac=COALESCE/);
  assert.match(service, /mac_address=NULL/);
  assert.match(retention, /UPDATE hotspot_vouchers SET status='archived'/);
});

test("RouterOS purge requires fresh reads of all four resource layers before verified success", () => {
  const source = read("services/mikrotikService.js");
  assert.match(source, /connection\\.write\\("\/ip\/hotspot\/active\/print"\)/);
  assert.match(source, /connection\\.write\\("\/ip\/hotspot\/cookie\/print"\)/);
  assert.match(source, /connection\\.write\\("\/ip\/hotspot\/host\/print"\)/);
  assert.match(source, /connection\\.write\\("\/ip\/hotspot\/user\/print"\)/);
  assert.match(source, /HOTSPOT_PURGE_VERIFICATION_FAILED/);
  assert.match(source, /verified: true/);
});

test("schema and migration retain last-known MAC and allow the deleted lifecycle state", () => {
  const schema = read("db/schema.sql");
  const migration = read("db/migrations/20261025_unified_hotspot_deletion_purge.sql");
  assert.match(schema, /ADD COLUMN IF NOT EXISTS last_known_mac VARCHAR\\(32\\)/);
  assert.match(schema, /'archived','deleted'/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS last_known_mac VARCHAR\\(32\\)/);
  assert.match(migration, /'archived','deleted'/);
  assert.match(migration, /NOT VALID/);
  assert.doesNotMatch(migration, /DELETE\\s+FROM/i);
});
