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


test('POP update persists dual-service fields and Hotspot binding when the complete schema exists', async t => {
  const calls=[];
  const schema={hotspot_bindings_available:true,
    pop_columns:['id','name','area_zone','reseller_id','vlan_id','pppoe_enabled','pppoe_ip_pool','mikrotik_ip_pool','commission_type','commission_rate','status','created_at','updated_at'],
    binding_columns:['id','pop_id','router_key','hotspot_server','hotspot_interface','vlan_id','ip_pool','status','updated_at']};
  const client={async query(sql,values=[]){
    calls.push({sql,values});
    if(sql.includes('information_schema.columns')) return {rows:[schema]};
    if(sql.startsWith('SELECT * FROM public.pops')) return {rows:[{id:4,name:'Old POP',area_zone:'North',reseller_id:null,pppoe_enabled:true,pppoe_ip_pool:'OldPool',status:'active'}]};
    if(sql.startsWith('SELECT to_jsonb(hb) AS data')) return {rows:[{data:{status:'active',hotspot_server:'old-server',hotspot_interface:'ether2',vlan_id:20,ip_pool:'OldHotspotPool'}}]};
    if(sql.startsWith('SELECT p.id,p.reseller_id')) return {rows:[{id:4,name:'Updated POP',pppoe_enabled:true,pppoe_ip_pool:'NewPPPoEPool',hotspot_enabled:true,hotspot_ip_pool:'NewHotspotPool'}]};
    return {rows:[]};
  }};
  t.mock.method(db,'withTransaction',async callback=>callback(client));
  const res=responseRecorder();
  await controller.update({params:{id:'4'},body:{name:'Updated POP',pppoe_ip_pool:'NewPPPoEPool',hotspot_enabled:true,hotspot_server:'new-server',hotspot_interface:'ether3',hotspot_vlan_id:30,hotspot_ip_pool:'NewHotspotPool'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.payload.success,true);
  const popUpdate=calls.find(call=>call.sql.startsWith('UPDATE public.pops'));
  assert.match(popUpdate.sql,/pppoe_ip_pool/);
  assert.deepEqual(popUpdate.values,['Updated POP','NewPPPoEPool',4]);
  assert.ok(calls.some(call=>call.sql.includes('INSERT INTO public.pop_hotspot_bindings')));
});

for (const scenario of [
  {
    name: 'missing Hotspot binding table',
    schema: { hotspot_bindings_available: false, binding_columns: [] },
    reason: 'table_missing'
  },
  {
    name: 'malformed Hotspot binding schema',
    schema: { hotspot_bindings_available: true, binding_columns: ['id', 'router_key'] },
    reason: 'incompatible_schema'
  }
]) {
  test('POP update succeeds when optional Hotspot binding storage is ' + scenario.name, async t => {
    const calls = [];
    const warnings = [];
    const client = {
      async query(sql, values = []) {
        calls.push({ sql, values });
        if (sql.includes('information_schema.columns')) return { rows: [scenario.schema] };
        if (sql.startsWith('SELECT * FROM public.pops')) {
          return { rows: [{ id: 4, name: 'Old POP', area_zone: 'North', reseller_id: null, vlan_id: 10, pppoe_enabled: true, pppoe_ip_pool: 'OldPool', status: 'active' }] };
        }
        if (sql.startsWith('SELECT p.id,p.reseller_id')) {
          return { rows: [{ id: 4, name: 'Updated POP', area_zone: 'South', vlan_id: 30, pppoe_enabled: true, pppoe_ip_pool: 'NewPool', hotspot_enabled: false }] };
        }
        return { rows: [] };
      }
    };
    t.mock.method(db, 'withTransaction', async callback => callback(client));
    t.mock.method(console, 'warn', (...args) => warnings.push(args));
    const res = responseRecorder();

    await controller.update({
      params: { id: '4' },
      body: {
        name: 'Updated POP',
        area_zone: 'South',
        vlan_id: 30,
        hotspot_enabled: true,
        hotspot_server: 'server',
        hotspot_ip_pool: 'pool'
      }
    }, res);

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.success, true);
    assert.equal(res.payload.pop.name, 'Updated POP');
    const primaryUpdate = calls.find(call => call.sql.startsWith('UPDATE public.pops'));
    assert.ok(primaryUpdate, 'primary POP UPDATE must execute');
    assert.match(primaryUpdate.sql, /name/);
    assert.ok(calls.some(call => call.sql === 'SAVEPOINT pop_hotspot_optional'));
    assert.ok(calls.some(call => call.sql === 'RELEASE SAVEPOINT pop_hotspot_optional'));
    assert.equal(calls.some(call => call.sql.includes('SELECT to_jsonb(hb) AS data')), false);
    assert.ok(warnings.some(args => args[1]?.event === 'pop.hotspot_binding.skipped' && args[1]?.reason === scenario.reason));
    assert.equal(calls.some(call => call.sql.includes('ROLLBACK TO SAVEPOINT')), false);
  });
}

test('POP update rolls back an optional binding schema mismatch and commits the primary POP save', async t => {
  const calls = [];
  const warnings = [];
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('information_schema.columns')) {
        return { rows: [{
          hotspot_bindings_available: true,
          binding_columns: ['id','pop_id','router_key','hotspot_server','hotspot_interface','vlan_id','ip_pool','status','updated_at']
        }] };
      }
      if (sql.startsWith('SELECT * FROM public.pops')) {
        return { rows: [{ id: 9, name: 'Old POP', area_zone: 'North', reseller_id: null, vlan_id: 10, pppoe_enabled: true, pppoe_ip_pool: 'Pool' }] };
      }
      if (sql.startsWith('SELECT to_jsonb(hb) AS data')) {
        const error = new Error('column hb.status does not exist');
        error.code = '42703';
        throw error;
      }
      if (sql.startsWith('SELECT p.id,p.reseller_id')) {
        return { rows: [{ id: 9, name: 'Updated POP', area_zone: 'South', vlan_id: 20, hotspot_enabled: false }] };
      }
      return { rows: [] };
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  const res = responseRecorder();

  await controller.update({
    params: { id: '9' },
    body: { name: 'Updated POP', area_zone: 'South', hotspot_enabled: true, hotspot_server: 'server', hotspot_ip_pool: 'pool' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.ok(calls.some(call => call.sql.startsWith('UPDATE public.pops')));
  assert.ok(calls.some(call => call.sql === 'ROLLBACK TO SAVEPOINT pop_hotspot_optional'));
  assert.ok(calls.some(call => call.sql === 'RELEASE SAVEPOINT pop_hotspot_optional'));
  assert.ok(warnings.some(args => args[1]?.event === 'pop.hotspot_binding.persistence_failed' && args[1]?.databaseCode === '42703'));
  assert.equal(calls.some(call => call.sql.includes('FROM public.pop_hotspot_bindings hb') && call.sql.startsWith('SELECT p.id')), false);
});

test('POP update uses the locked row and saves PPPoE, pool, and VLAN fields without inspecting POP columns', async t => {
  const calls = [];
  const schema = {
    hotspot_bindings_available: false,
    binding_columns: []
  };
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('information_schema.columns')) return { rows: [schema] };
      if (sql.startsWith('SELECT * FROM public.pops')) {
        return { rows: [{ id: 14, name: 'Schema POP', area_zone: 'North', reseller_id: null, vlan_id: 10, pppoe_enabled: false, pppoe_ip_pool: null, status: 'active' }] };
      }
      if (sql.startsWith('SELECT p.id,p.reseller_id')) {
        return { rows: [{ id: 14, name: 'Schema POP', vlan_id: 33, pppoe_enabled: true, pppoe_ip_pool: 'ResidentialPool' }] };
      }
      return { rows: [] };
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const res = responseRecorder();

  await controller.update({
    params: { id: '14' },
    body: { pppoe_enabled: true, pppoe_ip_pool: 'ResidentialPool', vlan_id: 33 }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  const inspection = calls.find(call => call.sql.includes('information_schema.columns'));
  assert.match(inspection.sql, /to_regclass\('public\.pop_hotspot_bindings'\)/);
  assert.match(inspection.sql, /table_schema\s*=\s*'public'/);
  assert.match(inspection.sql, /table_name\s*=\s*'pop_hotspot_bindings'/);
  assert.doesNotMatch(inspection.sql, /table_name\s*=\s*'pops'/);
  assert.doesNotMatch(inspection.sql, /table_schema\s*=\s*CURRENT_SCHEMA/);
  const update = calls.find(call => call.sql.startsWith('UPDATE public.pops'));
  assert.ok(update, 'POP UPDATE statement should execute');
  assert.deepEqual(update.values, [33, true, 'ResidentialPool', 14]);
});


test('POP update saves standard fields and maps legacy pool without a POP schema metadata gate', async t => {
  const calls = [];
  const schema = {
    hotspot_bindings_available: false,
    binding_columns: []
  };
  const client = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('information_schema.columns')) return { rows: [schema] };
      if (sql.startsWith('SELECT * FROM public.pops')) {
        return { rows: [{ id: 22, name: 'Legacy POP', area_zone: 'North', reseller_id: null, vlan_id: 10, mikrotik_ip_pool: 'OldPool', status: 'active' }] };
      }
      if (sql.startsWith('SELECT p.id,p.reseller_id')) {
        return { rows: [{ id: 22, name: 'Updated Legacy POP', vlan_id: 33, pppoe_ip_pool: 'NewPool' }] };
      }
      return { rows: [] };
    }
  };
  t.mock.method(db, 'withTransaction', async callback => callback(client));
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args));
  const res = responseRecorder();

  await controller.update({
    params: { id: '22' },
    body: { name: 'Updated Legacy POP', area_zone: 'South', reseller_id: null, pppoe_enabled: true, pppoe_ip_pool: 'NewPool', vlan_id: 33 }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  const update = calls.find(call => call.sql.startsWith('UPDATE public.pops'));
  assert.ok(update);
  assert.match(update.sql, /mikrotik_ip_pool/);
  assert.doesNotMatch(update.sql, /pppoe_enabled/);
  assert.deepEqual(update.values, ['Updated Legacy POP', 'South', null, 33, 'NewPool', 22]);
  assert.equal(warnings.length, 1);
  assert.equal(calls.some(call => call.sql.includes("table_name = 'pops'")), false);
});
