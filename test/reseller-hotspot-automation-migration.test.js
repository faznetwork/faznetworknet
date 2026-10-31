'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('POP binding compatibility migration is forward-only, idempotent, and preserves binding rows', () => {
  const sql = fs.readFileSync(path.join(root, 'db/migrations/20261031_pop_hotspot_bindings_contract_compat.sql'), 'utf8');
  assert.match(sql, /^BEGIN;/m);
  assert.match(sql, /^COMMIT;/m);
  assert.match(sql, /UNIQUE \(pop_id\)/);
  assert.match(sql, /ALTER COLUMN vlan_id DROP NOT NULL/);
  assert.match(sql, /ALTER COLUMN is_active DROP NOT NULL/);
  assert.match(sql, /ALTER COLUMN is_active SET DEFAULT TRUE/);
  assert.match(sql, /duplicate pop_id rows prevent UNIQUE\(pop_id\)/);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b|\bTRUNCATE\b/i);
});

test('billing and package backfill uses canonical account columns and never overwrites existing POP package pricing', () => {
  const sql = fs.readFileSync(path.join(root, 'db/migrations/20261031_reseller_hotspot_automation.sql'), 'utf8');
  assert.match(sql, /account_status/);
  assert.match(sql, /billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status/);
  assert.match(sql, /ON CONFLICT \(reseller_id\) DO NOTHING/);
  assert.match(sql, /WHERE NOT EXISTS/);
  assert.match(sql, /wholesale_price,status/);
  assert.match(sql, /cp\.retail_price,cp\.retail_price,'active'/);
  assert.match(sql, /ON CONFLICT \(pop_id,profile_key\) DO NOTHING/);
  assert.doesNotMatch(sql, /\bUPDATE\s+public\.pop_hotspot_packages\b|\bDELETE\s+FROM\s+public\.pop_hotspot_packages\b/i);
});
