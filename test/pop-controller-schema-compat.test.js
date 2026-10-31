'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');
const controller = require('../controllers/popController');

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

test('POP directory remains readable when the optional Hotspot binding table is not installed', async t => {
  const calls = [];
  t.mock.method(db, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('to_regclass')) return { rows: [{ available: false }] };
    return { rows: [{ id: 7, name: 'Legacy POP', pppoe_enabled: true, pppoe_ip_pool: 'legacy-pool', hotspot_enabled: false, hotspot_ip_pool: null, customer_count: 3 }] };
  });
  const res = responseRecorder();
  await controller.list({ auth: { role: 'super_admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.pops[0].id, 7);
  const directorySql = calls[1].sql;
  assert.match(directorySql, /to_jsonb\(p\)->>'pppoe_enabled'/);
  assert.match(directorySql, /to_jsonb\(p\)->>'pppoe_ip_pool'/);
  assert.doesNotMatch(directorySql, /LEFT JOIN public\.pop_hotspot_bindings/);
});

test('POP directory reads dual-pool and Hotspot fields safely when the binding table exists', async t => {
  const calls = [];
  t.mock.method(db, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('to_regclass')) return { rows: [{ available: true }] };
    return { rows: [{ id: 8, name: 'Dual Service POP', pppoe_enabled: true, pppoe_ip_pool: 'pppoe-pool', hotspot_enabled: true, hotspot_ip_pool: 'hotspot-pool', customer_count: 5 }] };
  });
  const res = responseRecorder();
  await controller.list({ auth: { role: 'admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.pops[0].hotspot_ip_pool, 'hotspot-pool');
  const directorySql = calls[1].sql;
  assert.match(directorySql, /LEFT JOIN LATERAL/);
  assert.match(directorySql, /to_jsonb\(hb\)->>'pop_id'/);
  assert.match(directorySql, /hb\.data->>'ip_pool' AS hotspot_ip_pool/);
  assert.doesNotMatch(directorySql, /hb\.status/);
});

test('POP directory keeps reseller scoping on the schema-compatible projection', async t => {
  let captured;
  t.mock.method(db, 'query', async (sql, values) => {
    if (sql.includes('to_regclass')) return { rows: [{ available: false }] };
    captured = { sql, values };
    return { rows: [] };
  });
  const res = responseRecorder();
  await controller.list({ auth: { role: 'reseller', resellerId: 42 } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(captured.sql, /WHERE p\.reseller_id=\$1/);
  assert.deepEqual(captured.values, [42]);
});




test('admin POP directory includes only reseller-owned POPs and returns reseller-only customer totals', async t => {
  const calls = [];
  t.mock.method(db, 'query', async (sql, values) => {
    calls.push({ sql, values });
    if (sql.includes('to_regclass')) return { rows: [{ available: false }] };
    return { rows: [{ id: 4, name: 'Kader', reseller_id: 2, reseller_name: 'Faz Network', customer_count: 1 }] };
  });
  const res = responseRecorder();
  await controller.list({ auth: { role: 'super_admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.pops.map(pop => pop.id), [4]);
  assert.equal(res.payload.pops.reduce((sum, pop) => sum + pop.customer_count, 0), 1);
  const directorySql = calls[1].sql;
  assert.match(directorySql, /INNER JOIN public\.resellers r ON r\.id=p\.reseller_id/);
  assert.match(directorySql, /WHERE p\.reseller_id IS NOT NULL/);
  assert.doesNotMatch(directorySql, /LEFT JOIN public\.resellers/);
});

test('admin customer POP options expose only active reseller-owned PPPoE POPs', async t => {
  let captured;
  t.mock.method(db, 'query', async (sql, values) => {
    captured = { sql, values };
    return { rows: [{ id: 4, name: 'Kader', area_zone: 'North', reseller_id: 2 }] };
  });
  const res = responseRecorder();
  await controller.options({ auth: { role: 'admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.payload.pops.map(pop => pop.id), [4]);
  assert.match(captured.sql, /INNER JOIN public\.resellers r ON r\.id=p\.reseller_id/);
  assert.match(captured.sql, /p\.reseller_id IS NOT NULL/);
  assert.match(captured.sql, /p\.status='active'/);
  assert.match(captured.sql, /p\.pppoe_enabled=TRUE/);
  assert.deepEqual(captured.values, []);
});

test('POP Hotspot enablement materializes core profiles before the POP transaction commits', async t => {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.startsWith('INSERT INTO public.pops')) return { rows: [{ id: 71 }] };
      if (sql.startsWith('SELECT p.id,p.reseller_id')) {
        return { rows: [{ id: 71, name: 'New Hotspot POP', hotspot_enabled: true, hotspot_ip_pool: 'hs-pool' }] };
      }
      return { rows: [] };
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const res = responseRecorder();
  await controller.create({
    body: {
      name: 'New Hotspot POP', area_zone: 'North', reseller_id: null,
      pppoe_enabled: false, hotspot_enabled: true, hotspot_server: 'hs1',
      hotspot_interface: 'bridge-hotspot', hotspot_ip_pool: 'hs-pool'
    }
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.hotspot_persisted, true);
  const bindingIndex = calls.findIndex(call => call.sql.includes('INSERT INTO public.pop_hotspot_bindings'));
  const metadataIndex = calls.findIndex(call => call.sql.includes("key='hotspot_profile_metadata'"));
  assert.ok(bindingIndex >= 0);
  assert.ok(metadataIndex > bindingIndex);
});

test('POP update executes the deterministic Hotspot upsert and returns the associated binding', async t => {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT * FROM public.pops')) {
        return { rows: [{ id: 4, name: 'Old POP', area_zone: 'North', reseller_id: null, vlan_id: 10, pppoe_enabled: true, pppoe_ip_pool: 'PPPoEPool', status: 'active' }] };
      }
      if (sql.startsWith('SELECT to_jsonb(hb) AS data')) return { rows: [] };
      if (sql.startsWith('SELECT p.id,p.reseller_id')) {
        return { rows: [{ id: 4, name: 'Updated POP', pppoe_enabled: true, pppoe_ip_pool: 'PPPoEPool', hotspot_enabled: true, hotspot_server: 'hs1', hotspot_ip_pool: 'HotspotPool', hotspot_binding_status: 'active' }] };
      }
      return { rows: [] };
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const res = responseRecorder();

  await controller.update({
    params: { id: '4' },
    body: {
      name: 'Updated POP',
      hotspot_enabled: true,
      hotspot_server: 'hs1',
      hotspot_interface: 'ether3',
      hotspot_vlan_id: 30,
      hotspot_ip_pool: 'HotspotPool'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.hotspot_persisted, true);
  assert.equal(res.payload.pop.hotspot_enabled, true);
  assert.equal(res.payload.pop.hotspot_ip_pool, 'HotspotPool');

  const upsert = calls.find(call => call.sql.includes('INSERT INTO public.pop_hotspot_bindings'));
  assert.ok(upsert, 'direct binding upsert must execute');
  assert.match(upsert.sql, /COALESCE\(\$2, 'core_mikrotik'\)/);
  assert.match(upsert.sql, /ON CONFLICT \(pop_id\) DO UPDATE SET/);
  assert.deepEqual(upsert.values, [4, null, 'hs1', 'ether3', 30, 'HotspotPool', null]);
  assert.equal(calls.some(call => /information_schema\.columns|inspectHotspotBindingSchema/.test(call.sql)), false);
  assert.ok(calls.some(call => call.sql === 'SAVEPOINT pop_hotspot_optional'));
  assert.ok(calls.some(call => call.sql === 'RELEASE SAVEPOINT pop_hotspot_optional'));
});

test('POP update reports genuine Hotspot database constraint failures without hiding the failure', async t => {
  const calls = [];
  const errors = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT * FROM public.pops')) {
        return { rows: [{ id: 9, name: 'Before', area_zone: 'North', reseller_id: null, vlan_id: 10, pppoe_enabled: true, pppoe_ip_pool: 'Pool', status: 'active' }] };
      }
      if (sql.startsWith('SELECT to_jsonb(hb) AS data')) return { rows: [] };
      if (sql.includes('INSERT INTO public.pop_hotspot_bindings')) {
        const error = new Error('hotspot binding violates check constraint');
        error.code = '23514';
        error.constraint = 'pop_hotspot_bindings_status_check';
        throw error;
      }
      if (sql.startsWith('SELECT p.id,p.reseller_id')) {
        return { rows: [{ id: 9, name: 'Updated POP', hotspot_enabled: false, hotspot_ip_pool: null }] };
      }
      return { rows: [] };
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  t.mock.method(console, 'error', (...args) => errors.push(args));
  const res = responseRecorder();

  await controller.update({
    params: { id: '9' },
    body: { name: 'Updated POP', hotspot_enabled: true, hotspot_server: 'bad-server', hotspot_ip_pool: 'bad-pool' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.pop.name, 'Updated POP');
  assert.equal(res.payload.hotspot_persisted, false);
  assert.ok(calls.some(call => call.sql === 'ROLLBACK TO SAVEPOINT pop_hotspot_optional'));
  assert.ok(calls.some(call => call.sql === 'RELEASE SAVEPOINT pop_hotspot_optional'));
  assert.ok(errors.some(args => args[1]?.event === 'pop.hotspot_binding.persistence_failed' && args[1]?.databaseCode === '23514' && args[1]?.constraint === 'pop_hotspot_bindings_status_check'));
});

test('POP update disables an existing Hotspot binding with a direct parameterized update', async t => {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT * FROM public.pops')) {
        return { rows: [{ id: 11, name: 'POP', area_zone: 'West', reseller_id: null, pppoe_enabled: true, pppoe_ip_pool: 'Pool', status: 'active' }] };
      }
      if (sql.startsWith('SELECT to_jsonb(hb) AS data')) {
        return { rows: [{ data: { status: null, is_active: true, router_key: 'core_mikrotik', hotspot_server: 'hs1', ip_pool: 'Pool1' } }] };
      }
      if (sql.startsWith('SELECT p.id,p.reseller_id')) return { rows: [{ id: 11, name: 'POP', hotspot_enabled: false }] };
      return { rows: [] };
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const res = responseRecorder();

  await controller.update({ params: { id: '11' }, body: { hotspot_enabled: false } }, res);

  assert.equal(res.payload.hotspot_persisted, true);
  const disable = calls.find(call => call.sql.startsWith("UPDATE public.pop_hotspot_bindings SET status='inactive'"));
  assert.ok(disable);
  assert.deepEqual(disable.values, [11]);
  assert.equal(calls.some(call => call.sql.includes('INSERT INTO public.pop_hotspot_bindings')), false);
});

test('POP directory resolves a legacy is_active binding when status is absent', async t => {
  let captured;
  t.mock.method(db, 'query', async sql => {
    if (sql.includes('to_regclass')) return { rows: [{ available: true }] };
    captured = sql;
    return { rows: [{ id: 18, name: 'Legacy binding POP', hotspot_enabled: true }] };
  });
  const res = responseRecorder();
  await controller.list({ auth: { role: 'admin' } }, res);
  assert.equal(res.statusCode, 200);
  assert.match(captured, /COALESCE\(NULLIF\(hb\.data->>'status',''\)='active',\(hb\.data->>'is_active'\)::boolean,FALSE\)/);
});

test('unrelated POP edits never write or deactivate an established Hotspot binding', async t => {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT * FROM public.pops')) {
        return { rows: [{ id: 25, name: 'Before', area_zone: 'North', reseller_id: null, pppoe_enabled: true, pppoe_ip_pool: 'pool-pppoe', status: 'active' }] };
      }
      if (sql.startsWith('SELECT p.id,p.reseller_id')) {
        return { rows: [{ id: 25, name: 'After', hotspot_enabled: true, hotspot_server: 'hs1', hotspot_interface: 'bridge-hotspot', hotspot_ip_pool: 'pool-hotspot' }] };
      }
      return { rows: [] };
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const res = responseRecorder();
  await controller.update({ params: { id: '25' }, body: { name: 'After' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(calls.some(call => call.sql.includes('SELECT to_jsonb(hb) AS data') && call.sql.includes('FOR UPDATE')), false);
  assert.equal(calls.some(call => call.sql.includes('INSERT INTO public.pop_hotspot_bindings')), false);
  assert.equal(calls.some(call => call.sql.startsWith("UPDATE public.pop_hotspot_bindings SET status='inactive'")), false);
});

test('editing fields on a legacy is_active binding preserves its enabled state', async t => {
  const calls = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.startsWith('SELECT * FROM public.pops')) {
        return { rows: [{ id: 26, name: 'Legacy POP', area_zone: 'West', reseller_id: null, status: 'active' }] };
      }
      if (sql.startsWith('SELECT to_jsonb(hb) AS data')) {
        return { rows: [{ data: { status: null, is_active: true, router_key: 'core_mikrotik', hotspot_server: 'hs-old', hotspot_interface: 'bridge-old', ip_pool: 'pool-old' } }] };
      }
      if (sql.startsWith('SELECT p.id,p.reseller_id')) {
        return { rows: [{ id: 26, name: 'Legacy POP', hotspot_enabled: true }] };
      }
      return { rows: [] };
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const res = responseRecorder();
  await controller.update({ params: { id: '26' }, body: { hotspot_server: 'hs-new' } }, res);
  assert.equal(res.statusCode, 200);
  const upsert = calls.find(call => call.sql.includes('INSERT INTO public.pop_hotspot_bindings'));
  assert.ok(upsert);
  assert.equal(upsert.values[2], 'hs-new');
  assert.equal(upsert.values[5], 'pool-old');
  assert.equal(calls.some(call => call.sql.startsWith("UPDATE public.pop_hotspot_bindings SET status='inactive'")), false);
});

test('startup schema bootstrap accepts reseller_voucher subscriber type', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  assert.match(schema, /hotspot_vouchers_subscriber_type_check[\s\S]*?reseller_voucher/);
});
