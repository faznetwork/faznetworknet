'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const catalogService = require('../services/resellerHotspotCatalogService');

test('catalog automatically materializes core profiles only for an active Hotspot POP with no package rows', async t => {
  const statements = [];
  let packageRows = [];
  const client = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes('FROM public.reseller_billing_accounts')) return { rows: [] };
      if (sql.includes('FROM public.pops p')) return { rows: [{ id: 4, name: 'Kader', status: 'active', reseller_id: 41 }] };
      if (sql.includes('FROM public.pop_hotspot_bindings')) return { rows: [{ id: 50, pop_id: 4, status: 'active', ip_pool: null }] };
      if (sql.includes('FROM public.pop_hotspot_packages')) return { rows: packageRows };
      if (sql.includes("key='hotspot_profile_metadata'")) return { rows: [{ value: JSON.stringify({
        '30-Day': { price: 150, validityValue: 30, validityUnit: 'days', validityLabel: '30-Day' },
        '12-Hour': { price: 40, validityValue: 12, validityUnit: 'hours', validityLabel: '12-Hour' },
        '1GB': { price: 10, validityValue: 1, validityUnit: 'gb', validityLabel: '1 GB', limitBytesTotal: 1073741824 }
      }) }] };
      if (sql.startsWith('UPDATE public.pop_hotspot_packages')) return { rowCount: 0, rows: [] };
      if (sql.includes('INSERT INTO public.pop_hotspot_packages')) {
        const row = {
          id: String(100 + packageRows.length), pop_id: values[0], package_name: values[1],
          profile_key: values[2], validity_seconds: values[3], data_limit_bytes: values[4],
          retail_price: values[5], wholesale_price: values[6], is_active: true
        };
        packageRows = [...packageRows, row];
        return { rows: [{ id: row.id }], rowCount: 1 };
      }
      throw new Error('Unexpected catalog SQL: ' + sql);
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));

  const result = await catalogService.getCatalog(41);
  assert.equal(result.pops[0].name, 'Kader');
  assert.equal(result.pops[0].packages.length, 3);
  assert.deepEqual(result.pops[0].packages.map(pkg => pkg.profileKey), ['30-Day', '12-Hour', '1GB']);
  assert.equal(result.pops[0].packages[0].validitySeconds, '2592000');
  assert.equal(result.pops[0].packages[0].retailPrice, '150.00');
  assert.equal(result.pops[0].packages[0].wholesalePrice, '105.00');
  assert.equal(result.pops[0].packages[0].dataLimit, null);
  assert.equal(result.pops[0].packages[2].validity, 'Data / quota package');
  assert.equal(result.pops[0].packages[2].validitySeconds, '0');
  assert.equal(result.pops[0].packages[2].timeLimit, null);
  assert.equal(result.pops[0].packages[2].dataLimit, '1073741824');
  assert.equal(result.pops[0].packages[2].retailPrice, '10.00');
  assert.equal(result.pops[0].issuanceReady, false);
  assert.equal(result.pops[0].readinessReason, 'IP_POOL_NOT_CONFIGURED');
  const insertSql = statements.find(entry => entry.sql.includes('INSERT INTO public.pop_hotspot_packages')).sql;
  assert.match(insertSql, /validity_seconds/);
  assert.match(insertSql, /data_limit_bytes/);
  assert.match(insertSql, /is_active/);
  assert.match(insertSql, /ON CONFLICT \(pop_id,profile_key\) DO UPDATE SET/);
  assert.doesNotMatch(insertSql, /ON CONFLICT \(pop_id,profile_key\) DO NOTHING/);
  assert.equal(statements.filter(entry => entry.sql.includes("key='hotspot_profile_metadata'")).length, 1);
});

test('catalog preserves existing inactive POP package rows and does not overwrite them from core metadata', async t => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes('FROM public.reseller_billing_accounts')) return { rows: [] };
      if (sql.includes('FROM public.pops p')) return { rows: [{ id: 4, name: 'Kader', status: 'active', reseller_id: 41 }] };
      if (sql.includes('FROM public.pop_hotspot_bindings')) return { rows: [{ id: 50, pop_id: 4, status: 'active', ip_pool: 'pool-a' }] };
      if (sql.includes('FROM public.pop_hotspot_packages')) return { rows: [{ id: '77', pop_id: 4, package_name: 'Manual override', profile_key: '30-Day', validity_seconds: '2592000', retail_price: '170', wholesale_price: '150', is_active: false }] };
      throw new Error('Unexpected SQL: ' + sql);
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const result = await catalogService.getCatalog(41);
  assert.equal(result.pops[0].packages.length, 0);
  assert.equal(statements.some(sql => sql.includes("key='hotspot_profile_metadata'")), false);
});

test('POP package catalog contract migration is additive and maps legacy fields without dropping data', () => {
  const migration = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations', '20261031_reseller_hotspot_package_catalog_contract.sql'), 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS validity_seconds BIGINT/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS is_active BOOLEAN/);
  assert.match(migration, /UNIQUE\(pop_id,profile_key\)/);
  assert.match(migration, /Review legacy validity values before retrying/);
  assert.doesNotMatch(migration, /\bDROP\s+(TABLE|COLUMN|INDEX)\b/i);
});

test('catalog includes established legacy bindings when status is null and is_active is true', async t => {
  const statements = [];
  const client = {
    async query(sql) {
      statements.push(sql);
      if (sql.includes('FROM public.reseller_billing_accounts')) return { rows: [] };
      if (sql.includes('FROM public.pops p')) return { rows: [{ id: 14, name: 'Legacy POP', status: 'active', reseller_id: 41 }] };
      if (sql.includes('FROM public.pop_hotspot_bindings')) {
        return { rows: [{ id: 91, pop_id: 14, status: null, ip_pool: 'legacy-hotspot-pool', dns_name: null }] };
      }
      if (sql.includes('FROM public.pop_hotspot_packages')) {
        return { rows: [{ id: 92, pop_id: 14, package_name: '30-Day', profile_key: '30-Day', validity_seconds: '2592000', retail_price: '150.00', wholesale_price: '105.00', is_active: true }] };
      }
      throw new Error('Unexpected catalog SQL: ' + sql);
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const result = await catalogService.getCatalog(41);
  assert.equal(result.pops[0].bindingConfigured, true);
  assert.equal(result.pops[0].issuanceReady, true);
  assert.equal(result.pops[0].packages.length, 1);
  const bindingSql = statements.find(sql => sql.includes('FROM public.pop_hotspot_bindings'));
  assert.match(bindingSql, /to_jsonb\(b\)->>'is_active'/);
  assert.match(bindingSql, /to_jsonb\(b\)->>'status'/);
});
