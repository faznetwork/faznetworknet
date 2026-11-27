'use strict';
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");

// The router's pools drifted from the panel: "400_Hotspot" was renamed /
// widened to "hs-pool-14" on the router and PC_Pool was deleted there, so
// the panel still holds stale rows for both. Deleting a stale row used to
// fail with 'MikroTik IP pool "400_Hotspot" was not found.' because the
// delete went router-first and errored out before the DB row was removed.
// A pool that is not on MikroTik must now delete from the database only;
// a pool that IS on the router still deletes from both; an unreachable
// router must not delete anything. The IP Pools list must also render the
// saved rows without waiting on the slow router (its allocations call is
// capped at 2s), and the plan modal's pool dropdown must offer the panel's
// saved pools, not the router's live ones.

function recorder(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
const delay=ms=>new Promise(r=>setTimeout(r,ms));

function loadIpPool(fixture){
  const file=path.resolve(__dirname,"../controllers/ipPoolController.js");
  const original=Module._load;
  const f=fixture||{};
  const calls={deleteIpPool:[],dbDelete:[],getUsedIpPools:[],identity:[]};
  const deleteRowCounts=[...(f.dbDeleteRowCounts||[1])];
  const db={async query(sql,params){
    if(/DELETE FROM ip_pools/i.test(sql)){calls.dbDelete.push({sql,params});return{rowCount:deleteRowCounts.length?deleteRowCounts.shift():1};}
    if(/INSERT INTO ip_pools/i.test(sql))return{rowCount:1};
    if(sql.includes("FROM ip_pools"))return{rows:f.savedPools||[]};
    return{rows:[]};
  }};
  const mikrotik={
    async getIpPools(){return f.livePools||[];},
    async getUsedIpPools(){calls.getUsedIpPools.push(true);await delay(f.usedDelayMs||0);return f.usedRows||[];},
    async getRouterIdentity(){calls.identity.push(true);return f.identity||"Tp-link";},
    async deleteIpPool(name){calls.deleteIpPool.push({name});if(f.deleteError)throw f.deleteError;return{name};}
  };
  delete require.cache[file];
  Module._load=function(request,parent,isMain){
    if(parent&&parent.filename===file&&request==="../db")return db;
    if(parent&&parent.filename===file&&request==="../services/mikrotikService")return mikrotik;
    return original.call(this,request,parent,isMain);
  };
  try{return{controller:require(file),calls};}
  finally{Module._load=original;}
}

function loadPackage(fixture){
  const file=path.resolve(__dirname,"../controllers/packageController.js");
  const original=Module._load;
  const f=fixture||{};
  const calls={getIpPools:[],fetchProfiles:[],removeProfile:[],isProfileInUse:[],dbDelete:[],db:[]};
  const db={async query(sql,params){
    calls.db.push({sql,params});
    if(/DELETE FROM packages/i.test(sql)){calls.dbDelete.push({sql,params});return{rows:[f.existingPackage||{id:40,plan_name:"45 Mbps"}]};}
    if(/SELECT \* FROM packages WHERE id=/i.test(sql))return{rows:f.existingPackage?[f.existingPackage]:[]};
    if(/FROM packages/i.test(sql))return{rows:f.packages||[]};
    if(/FROM ip_pools/i.test(sql))return{rows:f.savedPools||[]};
    if(/INSERT INTO packages/i.test(sql))return{rows:[{id:40,plan_name:"45 Mbps"}]};
    if(/UPDATE packages/i.test(sql))return{rows:[{id:40,plan_name:"45 Mbps"}]};
    return{rows:[]};
  }};
  const mikrotik={
    async getIpPools(){calls.getIpPools.push(true);return f.livePools||[];},
    async fetchExistingProfiles(){calls.fetchProfiles.push(true);return f.liveProfiles||[];},
    async getRouterIdentity(){return f.identity||"Tp-link";},
    async isProfileInUse(name){calls.isProfileInUse.push({name});return !!f.isInUse;},
    async removeProfile(id){calls.removeProfile.push({id});return{id,removed:true};}
  };
  delete require.cache[file];
  Module._load=function(request,parent,isMain){
    if(parent&&parent.filename===file&&request==="../db")return db;
    if(parent&&parent.filename===file&&request==="../services/mikrotikService")return mikrotik;
    return original.call(this,request,parent,isMain);
  };
  try{return{controller:require(file),calls};}
  finally{Module._load=original;}
}

const SAVED_POOLS=[
  {name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254",local_address:"10.20.0.1",subnet:"10.20.0.0/24",device_name:"Tp-link",next_pool:"none"},
  {name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254",local_address:"10.71.0.1",subnet:"10.71.0.1/24",device_name:"Tp-link",next_pool:"none"}
];

test("(a) delete of a DB-only pool succeeds and the row is gone from the database",async()=>{
  const notFound=new Error('MikroTik IP pool "400_Hotspot" was not found.');
  const {controller,calls}=loadIpPool({savedPools:SAVED_POOLS,deleteError:notFound});
  const res=recorder();
  await controller.remove({params:{id:"400_Hotspot"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.deletedFrom,"database");
  assert.match(res.body.message,/database only/i);
  assert.match(res.body.message,/400_Hotspot/);
  assert.match(res.body.message,/not on MikroTik/i);
  assert.equal(calls.deleteIpPool.length,1);
  assert.equal(calls.dbDelete.length,1);
  assert.deepEqual(calls.dbDelete[0].params,["Tp-link","400_Hotspot"]);
});

test("(a2) DB-only delete falls back to a name-only delete when the device-scoped delete removes nothing",async()=>{
  const notFound=new Error('MikroTik IP pool "400_Hotspot" was not found.');
  const {controller,calls}=loadIpPool({savedPools:SAVED_POOLS,deleteError:notFound,dbDeleteRowCounts:[0,1]});
  const res=recorder();
  await controller.remove({params:{id:"400_Hotspot"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.deletedFrom,"database");
  assert.equal(calls.dbDelete.length,2);
  assert.deepEqual(calls.dbDelete[0].params,["Tp-link","400_Hotspot"]);
  assert.deepEqual(calls.dbDelete[1].params,["400_Hotspot"]);
});

test("(b) delete of a router pool still deletes from both",async()=>{
  const {controller,calls}=loadIpPool({savedPools:SAVED_POOLS});
  const res=recorder();
  await controller.remove({params:{id:"100 Mbps"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.deletedFrom,"both");
  assert.match(res.body.message,/MikroTik/);
  assert.equal(calls.deleteIpPool.length,1);
  assert.equal(calls.dbDelete.length,1);
  assert.deepEqual(calls.dbDelete[0].params,["Tp-link","100 Mbps"]);
});

test("(c) delete when the router is unreachable errors and does NOT delete the DB row",async()=>{
  const timeout=new Error("MikroTik socket timeout: MikroTik connection handshake");
  const {controller,calls}=loadIpPool({savedPools:SAVED_POOLS,deleteError:timeout});
  const res=recorder();
  await controller.remove({params:{id:"100 Mbps"}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.success,false);
  assert.equal(calls.deleteIpPool.length,1);
  assert.equal(calls.dbDelete.length,0);
});

test("(c2) a 'router was not found' config error is unreachable, not a missing pool",async()=>{
  const cfg=new Error("Selected router was not found, inactive, or is not a native API router.");
  const {controller,calls}=loadIpPool({savedPools:SAVED_POOLS,deleteError:cfg});
  const res=recorder();
  await controller.remove({params:{id:"100 Mbps"}},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.success,false);
  assert.equal(calls.dbDelete.length,0);
});

test("(d) IP Pools list returns DB rows immediately without waiting on a slow router",async()=>{
  const {controller,calls}=loadIpPool({savedPools:SAVED_POOLS,usedDelayMs:8000,usedRows:[{pool:"100 Mbps",address:"10.20.0.5",owner:"10015",info:""}]});
  const res=recorder();
  const started=Date.now();
  await controller.list({},res);
  const elapsed=Date.now()-started;
  assert.ok(Array.isArray(res.body), "list returns an array");
  assert.equal(res.body.length,2);
  assert.deepEqual(res.body.map(p=>p.name).sort(),["100 Mbps","400_Hotspot"]);
  // The slow allocations call was cut off at the 2s cap: the rows render
  // with empty allocations instead of waiting ~8s for the router.
  assert.ok(elapsed<6000,"list returned in "+elapsed+"ms despite an 8s router call");
  assert.deepEqual(res.body.find(p=>p.name==="100 Mbps").allocations,[]);
  assert.equal(calls.getUsedIpPools.length,1);
});

test("(e) Plans list renders DB rows with no router call",async()=>{
  const pkgs=[
    {id:40,plan_name:"45 Mbps",profile_name:"45 Mbps",pool_name:"100 Mbps",local_address:"10.20.0.1",remote_address:"100 Mbps",price:"500.00"},
    {id:41,plan_name:"80 Mbps",profile_name:"80 Mbps",pool_name:"150 Mbps",local_address:"10.82.0.1",remote_address:"150 Mbps",price:"650.00"}
  ];
  const {controller,calls}=loadPackage({packages:pkgs,savedPools:SAVED_POOLS,livePools:[{name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254"}]});
  const res=recorder();
  await controller.list({},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.packages.length,2);
  assert.equal(res.body.packages[0].poolRanges,"10.20.0.2-10.20.0.254");
  assert.equal(calls.getIpPools.length,0);
});

test("(f) plan delete with a missing router profile still deletes the DB row",async()=>{
  const {controller,calls}=loadPackage({existingPackage:{id:40,plan_name:"45 Mbps",profile_name:"45 Mbps"},liveProfiles:[],isInUse:false});
  const res=recorder();
  await controller.remove({params:{id:"40"},body:{}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.match(res.body.message,/deleted successfully/);
  assert.equal(calls.removeProfile.length,0);
  assert.equal(calls.dbDelete.length,1);
});

test("(g) plan modal pool dropdown returns the panel's saved pools, not the router's live pools",async()=>{
  const {controller,calls}=loadPackage({savedPools:SAVED_POOLS,livePools:[{name:"hs-pool-14",ranges:"10.71.0.2-10.71.255.254"}]});
  const res=recorder();
  await controller.pools({},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.deepEqual(res.body.pools,[
    {name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254"},
    {name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254"}
  ]);
  assert.equal(calls.getIpPools.length,0);
});

test("isPoolNotFoundError distinguishes a missing pool from an unreachable router",()=>{
  const {controller}=loadIpPool({});
  assert.equal(controller.isPoolNotFoundError(new Error('MikroTik IP pool "400_Hotspot" was not found.')),true);
  assert.equal(controller.isPoolNotFoundError(new Error("no such item")),true);
  assert.equal(controller.isPoolNotFoundError(new Error("MikroTik socket timeout: MikroTik connection handshake")),false);
  assert.equal(controller.isPoolNotFoundError(new Error("Selected router was not found, inactive, or is not a native API router.")),false);
  assert.equal(controller.isPoolNotFoundError(new Error("MikroTik rejected the IP pool operation.")),false);
});
