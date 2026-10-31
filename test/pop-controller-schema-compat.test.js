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

test('POP update returns explicit schema readiness error instead of querying a missing Hotspot binding table', async t => {
  const schema={hotspot_bindings_available:false,
    pop_columns:['id','name','area_zone','reseller_id','vlan_id','pppoe_enabled','pppoe_ip_pool','commission_type','commission_rate','status'],
    binding_columns:[]};
  const calls=[];
  const client={async query(sql,values=[]){
    calls.push({sql,values});
    if(sql.includes('information_schema.columns')) return {rows:[schema]};
    if(sql.startsWith('SELECT * FROM public.pops')) return {rows:[{id:4,name:'Old POP',pppoe_enabled:true,pppoe_ip_pool:'OldPool',status:'active'}]};
    return {rows:[]};
  }};
  t.mock.method(db,'withTransaction',async callback=>callback(client));
  const res=responseRecorder();
  await controller.update({params:{id:'4'},body:{hotspot_enabled:true,hotspot_server:'server',hotspot_ip_pool:'pool'}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.payload.code,'POP_SCHEMA_NOT_READY');
  assert.match(res.payload.message,/Hotspot binding storage is not ready/i);
  assert.equal(calls.some(call=>/FROM public\\.pop_hotspot_bindings|INTO public\\.pop_hotspot_bindings|UPDATE public\\.pop_hotspot_bindings/.test(call.sql)),false);
});
