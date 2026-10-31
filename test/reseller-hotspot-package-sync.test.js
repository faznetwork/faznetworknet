'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { syncPopPackages, resolveCatalogEntry } = require('../services/resellerHotspotPackageSyncService');

test('core Hotspot metadata is materialized as durable POP package rows at retail-equals-wholesale pricing', async () => {
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
  assert.deepEqual(result, { created: 2, skipped: 1, reason: null });
  const inserts = statements.filter(entry => entry.sql.includes('INSERT INTO public.pop_hotspot_packages'));
  assert.equal(inserts.length, 2);
  assert.match(inserts[0].sql, /ON CONFLICT \(pop_id,profile_key\) DO NOTHING/);
  assert.match(inserts[0].sql, /retail_price,wholesale_price,status\)\s*VALUES[\s\S]*\$7::numeric,'active'/);
  assert.equal(inserts[0].values[0], 71);
  assert.equal(inserts[0].values[1], '1-Hour');
  assert.equal(inserts[0].values[2], '1-Hour');
  assert.equal(inserts[0].values[3], '1 Hour');
  assert.equal(inserts[0].values[6], '10.00');
  assert.equal(inserts[1].values[6], '20.00');
  assert.equal(statements.some(entry => /^UPDATE\s+public\.pop_hotspot_packages/i.test(entry.sql)), false);
});

test('legacy profile metadata with a validity label remains mappable without rewriting core metadata', () => {
  const entry = resolveCatalogEntry('Legacy 30-Day', { price: 100, validityLabel: '30 days' });
  assert.deepEqual(entry, {
    profileKey: 'Legacy 30-Day', packageName: 'Legacy 30-Day', validity: '30 days',
    timeLimit: null, dataLimit: null, retailPrice: '100.00'
  });
});

test('missing core metadata is reported without creating phantom POP packages', async () => {
  const result = await syncPopPackages({ query: async () => ({ rows: [] }) }, 71);
  assert.deepEqual(result, { created: 0, skipped: 0, reason: 'core_profile_metadata_not_configured' });
});

test('malformed core metadata fails the enclosing POP transaction explicitly', async () => {
  await assert.rejects(
    syncPopPackages({ query: async () => ({ rows: [{ value: '{not-json' }] }) }, 71),
    /not valid JSON/
  );
});
