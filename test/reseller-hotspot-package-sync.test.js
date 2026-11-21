'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { syncPopPackages, resolveCatalogEntry } = require('../services/resellerHotspotPackageSyncService');

test('core Hotspot metadata is materialized with a 30 percent reseller margin', async () => {
  const statements = [];
  const client = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes("key='hotspot_profile_metadata'")) {
        return { rows: [{ value: JSON.stringify({
          '1-Hour': { price: 10, validityValue: 1, validityUnit: 'hours', validityLabel: '1 Hour' },
          '2 GB': { price: 20, validityValue: 2, validityUnit: 'gb', validityLabel: '2 GB', limitBytesTotal: 2147483648 },
          default: { price: 0, validityValue: 1, validityUnit: 'days', validityLabel: '1 Day' }
        }) }] };
      }
      return { rows: [{ id: '91' }] };
    }
  };
  const result = await syncPopPackages(client, 71);
  assert.deepEqual(result, { created: 2, updated: 0, deactivated: 0, skipped: 1, reason: null });
  const inserts = statements.filter(entry => entry.sql.includes('INSERT INTO public.pop_hotspot_packages'));
  assert.equal(inserts.length, 2);
  assert.match(inserts[0].sql, /ON CONFLICT \(pop_id,profile_key\) DO UPDATE SET/);
  assert.doesNotMatch(inserts[0].sql, /ON CONFLICT \(pop_id,profile_key\) DO NOTHING/);
  assert.match(inserts[0].sql, /validity_seconds,data_limit_bytes,retail_price,wholesale_price,is_active/);
  assert.match(inserts[0].sql, /\$6::numeric,\$7::numeric/);
  assert.equal(inserts[0].values[0], 71);
  assert.equal(inserts[0].values[1], '1-Hour');
  assert.equal(inserts[0].values[2], '1-Hour');
  assert.equal(inserts[0].values[3], '3600');
  assert.equal(inserts[0].values[4], null);
  assert.equal(inserts[0].values[5], '10.00');
  assert.equal(inserts[0].values[6], '7.00');
  assert.equal(inserts[1].values[3], '0');
  assert.equal(inserts[1].values[4], 2147483648);
  assert.equal(inserts[1].values[5], '20.00');
  assert.equal(inserts[1].values[6], '14.00');
  // The only UPDATE to the package table is the guarded deactivation of
  // rows whose profile left core metadata; no package field is overwritten
  // by any other statement.
  const updates = statements.filter(entry => /^UPDATE\s+public\.pop_hotspot_packages/i.test(entry.sql));
  assert.equal(updates.length, 1);
  assert.match(updates[0].sql, /SET is_active=FALSE/);
  assert.match(updates[0].sql, /NOT \(profile_key = ANY\(\$2::text\[\]\)\)/);
});

test('legacy profile metadata with a validity label remains mappable without rewriting core metadata', () => {
  const entry = resolveCatalogEntry('Legacy 30-Day', { price: 100, validityValue: 30, validityUnit: 'days', validityLabel: '30 days' });
  assert.deepEqual(entry, {
    profileKey: 'Legacy 30-Day', packageName: 'Legacy 30-Day', validitySeconds: '2592000',
    dataLimitBytes: null,
    retailPrice: '100.00',
    wholesalePrice: '70.00'
  });
});

test('missing core metadata is reported without creating phantom POP packages', async () => {
  const result = await syncPopPackages({ query: async () => ({ rows: [] }) }, 71);
  assert.deepEqual(result, { created: 0, updated: 0, deactivated: 0, skipped: 0, reason: 'core_profile_metadata_not_configured' });
});

test('malformed core metadata fails the enclosing POP transaction explicitly', async () => {
  await assert.rejects(
    syncPopPackages({ query: async () => ({ rows: [{ value: '{not-json' }] }) }, 71),
    /not valid JSON/
  );
});

test('wholesale rounding is performed at cent precision for fractional retail prices', () => {
  const entry = resolveCatalogEntry('Five-Cent', {
    price: 0.05, validityValue: 1, validityUnit: 'hours', validityLabel: '1 Hour'
  });
  assert.equal(entry.retailPrice, '0.05');
  assert.equal(entry.wholesalePrice, '0.04');
});

test('forward-only commission migration reconciles only existing equal-price rows', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const migration = fs.readFileSync(path.join(__dirname, '..', 'migrations', '20261031_reseller_hotspot_30_percent_commission.sql'), 'utf8');
  assert.match(migration, /SET wholesale_price\s*=\s*ROUND\(retail_price\s*\*\s*0\.70,\s*2\)/i);
  assert.match(migration, /WHERE wholesale_price\s*=\s*retail_price/i);
  assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|INDEX)/i);
});

test('upsert updates price, validity and quota on an existing POP row instead of ignoring it', async () => {
  const statements = [];
  const client = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes("key='hotspot_profile_metadata'")) {
        return { rows: [{ value: JSON.stringify({
          '30-Day': { price: 160, validityValue: 30, validityUnit: 'days', validityLabel: '30 Days' }
        }) }] };
      }
      if (sql.startsWith('INSERT INTO public.pop_hotspot_packages')) {
        // ON CONFLICT update path: xmax != 0, so inserted is false.
        return { rows: [{ id: '3', inserted: false }] };
      }
      if (sql.startsWith('UPDATE public.pop_hotspot_packages')) return { rowCount: 0, rows: [] };
      throw new Error('Unexpected SQL: ' + sql);
    }
  };
  const result = await syncPopPackages(client, 4);
  assert.deepEqual(result, { created: 0, updated: 1, deactivated: 0, skipped: 0, reason: null });
  const insert = statements.find(entry => entry.sql.includes('INSERT INTO public.pop_hotspot_packages'));
  assert.equal(insert.values[5], '160.00');
  assert.equal(insert.values[6], '112.00');
});

test('a profile removed from core metadata is deactivated on every POP row', async () => {
  const statements = [];
  const client = {
    async query(sql, values = []) {
      statements.push({ sql, values });
      if (sql.includes("key='hotspot_profile_metadata'")) {
        return { rows: [{ value: JSON.stringify({
          '30-Day': { price: 150, validityValue: 30, validityUnit: 'days', validityLabel: '30 Days' }
        }) }] };
      }
      if (sql.startsWith('INSERT INTO public.pop_hotspot_packages')) return { rows: [{ id: '3', inserted: true }] };
      if (sql.startsWith('UPDATE public.pop_hotspot_packages')) return { rowCount: 2, rows: [] };
      throw new Error('Unexpected SQL: ' + sql);
    }
  };
  const result = await syncPopPackages(client, 4);
  assert.equal(result.deactivated, 2);
  const deactivation = statements.find(entry => entry.sql.startsWith('UPDATE public.pop_hotspot_packages'));
  assert.deepEqual(deactivation.values, [4, ['30-Day']]);
});

test('GB profiles resolve to a byte quota with zero validity seconds', () => {
  const oneGb = resolveCatalogEntry('1GB', { price: 10, validityValue: 1, validityUnit: 'gb', validityLabel: '1 GB', limitBytesTotal: 1073741824 });
  assert.deepEqual(oneGb, {
    profileKey: '1GB', packageName: '1GB', validitySeconds: '0',
    dataLimitBytes: 1073741824, retailPrice: '10.00', wholesalePrice: '7.00'
  });
  const threeHundredGb = resolveCatalogEntry('300GB (Unlimited)', { price: 250, validityValue: 300, validityUnit: 'gb', validityLabel: '300 GB', limitBytesTotal: 322122547200 });
  assert.equal(threeHundredGb.validitySeconds, '0');
  assert.equal(threeHundredGb.dataLimitBytes, 322122547200);
  assert.equal(threeHundredGb.retailPrice, '250.00');
  assert.equal(threeHundredGb.wholesalePrice, '175.00');
});
