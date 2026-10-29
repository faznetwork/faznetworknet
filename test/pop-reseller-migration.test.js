'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(
  path.join(__dirname, '..', 'db/migrations/20261030_pop_reseller_architecture.sql'),
  'utf8'
);

test('migration is transactional and re-runnable without destructive customer operations', () => {
  assert.match(migration, /^BEGIN;/);
  assert.match(migration, /COMMIT;\s*$/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS resellers/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS pops/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS pop_id BIGINT/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_pops_primary_direct_name/);
  assert.match(migration, /ON CONFLICT \(name\)[\s\S]*?DO NOTHING/);
  assert.doesNotMatch(migration, /\b(DROP TABLE|TRUNCATE|DELETE FROM customers)\b/i);
});

test('canonical default POP is resolved by stable identity, never a hard-coded numeric ID', () => {
  assert.match(migration, /WHERE reseller_id IS NULL AND name = 'FAZ Main \(Direct\)'/);
  assert.match(migration, /SELECT id INTO STRICT primary_pop_id[\s\S]*?name = 'FAZ Main \(Direct\)'/);
  assert.doesNotMatch(migration, /(?:pop_id|primary_pop_id)\s*=\s*1\b/i);
});

test('customer backfill changes only pop_id and preserves existing area_zone values', () => {
  assert.match(migration, /UPDATE customers\s+SET pop_id = primary_pop_id\s+WHERE pop_id IS NULL/);
  assert.doesNotMatch(migration, /UPDATE customers[\s\S]{0,200}SET[\s\S]*area_zone\s*=/i);
  assert.match(migration, /WHERE pop_id IS NULL/);
});

test('lifecycle flags and foreign-key behavior avoid hard deletion cascades', () => {
  assert.match(migration, /status VARCHAR\(20\) NOT NULL DEFAULT 'inactive'/);
  assert.match(migration, /CHECK \(status IN \('active', 'inactive'\)\)/);
  assert.match(migration, /REFERENCES resellers\(id\) ON DELETE SET NULL/);
  assert.match(migration, /REFERENCES pops\(id\) ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /ON DELETE CASCADE/i);
});

test('duplicate canonical POPs abort explicitly instead of selecting an arbitrary row', () => {
  assert.match(migration, /IF canonical_count > 1 THEN[\s\S]*?RAISE EXCEPTION/);
  assert.match(migration, /SELECT id INTO STRICT primary_pop_id/);
});

test('rollback is non-destructive: this migration introduces no customer/payment deletion or rewrite', () => {
  // Rollback policy: roll back application code first and leave additive schema in place.
  // Dropping pop_id/tables would discard assignments and is deliberately not automated.
  assert.doesNotMatch(migration, /\b(DROP COLUMN|DROP TABLE|DELETE FROM|TRUNCATE)\b/i);
});
