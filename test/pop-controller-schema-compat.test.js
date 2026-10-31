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
