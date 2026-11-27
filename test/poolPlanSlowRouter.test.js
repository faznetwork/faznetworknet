'use strict';
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");

// The tunnel path to the router is slow: the RouterOS handshake alone can
// take ~3.5s and has been seen to exceed the service's 10s defaults (a live
// probe of getIpPools() failed at ~10.9s with "MikroTik socket timeout:
// MikroTik connection handshake", while a 30s-handshake probe succeeded in
// 3.5s). Pool/plan saves and syncs therefore pass a 30s handshake + 30s
// operation budget to the router. Display paths never pass it.
const SLOW={operationTimeoutMs:30000,handshakeTimeoutMs:30000};

function recorder(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

function load(file,fixture){
  const resolved=path.resolve(__dirname,"../"+file);
  const original=Module._load;
  const f=fixture||{};
  const calls={getIpPools:[],fetchProfiles:[],createPool:[],updatePool:[],deletePool:[],createProfile:[],updateProfile:[],removeProfile:[],isProfileInUse:[],identity:[],getUsedIpPools:[],db:[]};
  const delay=ms=>new Promise(r=>setTimeout(r,ms));
  const slow=async(v)=>{await delay(f.delayMs??0);return v;};
  const db={async query(sql,params){
    calls.db.push({sql,params});
    if(/SELECT \* FROM packages WHERE id=/i.test(sql))return{rows:f.existingPackage?[f.existingPackage]:[]};
    if(/SELECT \* FROM packages/i.test(sql))return{rows:f.packages||[]};
    if(/SELECT name,ranges,next_pool FROM ip_pools/i.test(sql))return{rows:f.savedPools||[]};
    if(/SELECT name,ranges,local_address,subnet,device_name,next_pool FROM ip_pools/i.test(sql))return{rows:f.savedPools||[]};
    if(/SELECT name, ranges FROM ip_pools/i.test(sql))return{rows:f.savedPools||[]};
    if(/UPDATE ip_pools SET ranges=/i.test(sql))return{rowCount:1};
    if(/UPDATE ip_pools SET name=/i.test(sql))return{rowCount:1};
    if(/INSERT INTO ip_pools/i.test(sql))return{rowCount:1};
    if(/DELETE FROM ip_pools/i.test(sql))return{rowCount:1};
    if(/INSERT INTO packages/i.test(sql))return{rows:[{id:40,plan_name:"45 Mbps"}]};
    if(/UPDATE packages/i.test(sql))return{rows:[{id:40,plan_name:"45 Mbps"}]};
    return{rows:[]};
  }};
  const mikrotik={
    async getIpPools(options){calls.getIpPools.push(options);return slow(f.livePools||[]);},
    async fetchExistingProfiles(options){calls.fetchProfiles.push(options);return slow(f.liveProfiles||[]);},
    async getRouterIdentity(options){calls.identity.push(options);return slow(f.identity||"Tp-link");},
    async getUsedIpPools(options){calls.getUsedIpPools.push(options);return slow([]);},
    async createIpPool(data,options){calls.createPool.push({data,options});return slow(data);},
    async updateIpPool(id,data,options){calls.updatePool.push({id,data,options});return slow({id,...data});},
    async deleteIpPool(name,options){calls.deletePool.push({name,options});return slow({name});},
    async createProfile(data,options){calls.createProfile.push({data,options});return slow({name:data.name});},
    async updateProfile(id,data,options){calls.updateProfile.push({id,data,options});return slow({id,name:data.name});},
    async removeProfile(id,options){calls.removeProfile.push({id,options});return slow({id,removed:true});},
    async isProfileInUse(name,options){calls.isProfileInUse.push({name,options});return slow(false);}
  };
  delete require.cache[resolved];
  Module._load=function(request,parent,isMain){
    if(parent&&parent.filename===resolved&&request==="../db")return db;
    if(parent&&parent.filename===resolved&&request==="../services/mikrotikService")return mikrotik;
    return original.call(this,request,parent,isMain);
  };
  try{return{controller:require(resolved),calls};}
  finally{Module._load=original;}
}

const LIVE_POOLS=[
  {id:"*1",name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254",nextPool:"none"},
  {id:"*2",name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254",nextPool:"none"}
];
const LIVE_PROFILES=[
  {id:"*10",name:"45 Mbps",rateLimit:"",localAddress:"10.20.0.1",remoteAddress:"100 Mbps",dnsServer:"",changeTcpMss:"default",raw:{"remote-address":"100 Mbps"}}
];
const SAVED_POOLS=[
  {name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254",local_address:"10.20.0.1",subnet:"10.20.0.0/24",device_name:"Tp-link",next_pool:"none"}
];

test("pool save succeeds on a slow router (3.5s) and passes the 30s budget",async()=>{
  const {controller,calls}=load("controllers/ipPoolController.js",{livePools:LIVE_POOLS,delayMs:3500});
  const res=recorder();
  await controller.saveOrUpdateIpPool({body:{name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254",localAddress:"10.20.0.1",subnet:"10.20.0.0/24",nextPool:"none"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.match(res.body.message,/saved and synced/);
  // Every router call in the save path carries the slow budget.
  assert.equal(calls.getIpPools.length,1);
  assert.deepEqual(calls.getIpPools[0],SLOW);
  assert.equal(calls.createPool.length,1);
  assert.deepEqual(calls.createPool[0].options,SLOW);
  assert.equal(calls.identity.length,1);
  assert.deepEqual(calls.identity[0],SLOW);
  // The DB row is still written after the slow router calls.
  assert.equal(calls.db.some(x=>/INSERT INTO ip_pools/i.test(x.sql)),true);
});

test("pool save updates an existing pool on a slow router",async()=>{
  const {controller,calls}=load("controllers/ipPoolController.js",{livePools:LIVE_POOLS,delayMs:100});
  const res=recorder();
  await controller.saveOrUpdateIpPool({body:{originalName:"100 Mbps",name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254",localAddress:"10.20.0.1",subnet:"10.20.0.0/24",nextPool:"none"}},res);
  assert.equal(res.body.success,true);
  assert.equal(calls.updatePool.length,1);
  assert.equal(calls.updatePool[0].id,"*1");
  assert.deepEqual(calls.updatePool[0].options,SLOW);
  assert.deepEqual(calls.getIpPools[0],SLOW);
});

test("pool panel-to-MikroTik sync passes the 30s budget to every router call",async()=>{
  const {controller,calls}=load("controllers/ipPoolController.js",{livePools:LIVE_POOLS,savedPools:SAVED_POOLS,delayMs:100});
  const res=recorder();
  await controller.syncPanelToMikrotik({},res);
  assert.equal(res.body.success,true);
  assert.equal(res.body.updated,1);
  assert.equal(res.body.failed,0);
  assert.deepEqual(calls.getIpPools[0],SLOW);
  assert.deepEqual(calls.identity[0],SLOW);
  assert.equal(calls.updatePool.length,1);
  assert.deepEqual(calls.updatePool[0].options,SLOW);
});

test("pool sync from MikroTik passes the 30s budget",async()=>{
  const {controller,calls}=load("controllers/ipPoolController.js",{livePools:LIVE_POOLS,savedPools:SAVED_POOLS,delayMs:100});
  const res=recorder();
  await controller.syncFromMikrotik({},res);
  assert.equal(res.body.success,true);
  assert.equal(res.body.updated,1);
  assert.equal(res.body.created,1);
  assert.deepEqual(calls.getIpPools[0],SLOW);
  assert.deepEqual(calls.identity[0],SLOW);
  assert.equal(calls.createPool.length,0);
});

test("plan save succeeds on a slow router (3.5s) and passes the 30s budget",async()=>{
  const {controller,calls}=load("controllers/packageController.js",{livePools:LIVE_POOLS,liveProfiles:LIVE_PROFILES,existingPackage:{id:40,plan_name:"45 Mbps",profile_name:"45 Mbps"},delayMs:3500});
  const res=recorder();
  await controller.savePlan({body:{id:"40",planName:"45 Mbps",price:"500",durationMonths:"1",rateLimit:"",localAddress:"10.20.0.1",remoteAddress:"100 Mbps",dnsServer:"",changeTcpMss:"default"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.match(res.body.message,/successfully saved/);
  // normalize (pool check) + profile lookup + profile update all carry it.
  assert.ok(calls.getIpPools.length>=1);
  assert.ok(calls.getIpPools.every(o=>o&&o.operationTimeoutMs===30000&&o.handshakeTimeoutMs===30000));
  assert.equal(calls.fetchProfiles.length,1);
  assert.deepEqual(calls.fetchProfiles[0],SLOW);
  assert.equal(calls.updateProfile.length,1);
  assert.deepEqual(calls.updateProfile[0].options,SLOW);
  // The save still writes the DB row, via the INSERT ... ON CONFLICT
  // upsert path: normalizePlanId's digit check is written with a doubled
  // backslash, so a numeric id returns null and the save takes the insert
  // path. That is a pre-existing quirk (out of scope here); the upsert
  // still saves the plan correctly.
  assert.equal(calls.db.some(x=>/INSERT INTO packages/i.test(x.sql)),true);
});

test("plan panel-to-MikroTik sync passes the 30s budget",async()=>{
  const {controller,calls}=load("controllers/packageController.js",{livePools:LIVE_POOLS,liveProfiles:LIVE_PROFILES,packages:[{id:40,plan_name:"45 Mbps",profile_name:"45 Mbps",pool_name:"100 Mbps",local_address:"10.20.0.1",remote_address:"100 Mbps",dns_server:"",change_tcp_mss:"default",rate_limit:""}],savedPools:SAVED_POOLS,delayMs:100});
  const res=recorder();
  await controller.syncPanelToMikrotik({},res);
  assert.equal(res.body.success,true);
  assert.equal(res.body.updated,1);
  assert.equal(res.body.failed,0);
  assert.ok(calls.getIpPools.length>=1);
  assert.ok(calls.getIpPools.every(o=>o&&o.operationTimeoutMs===30000&&o.handshakeTimeoutMs===30000));
  assert.ok(calls.fetchProfiles.length>=1);
  assert.ok(calls.fetchProfiles.every(o=>o&&o.operationTimeoutMs===30000&&o.handshakeTimeoutMs===30000));
});

test("plan delete passes the 30s budget to the usage check and profile removal",async()=>{
  const {controller,calls}=load("controllers/packageController.js",{livePools:LIVE_POOLS,liveProfiles:LIVE_PROFILES,existingPackage:{id:40,plan_name:"45 Mbps",profile_name:"45 Mbps"},delayMs:0});
  const res=recorder();
  await controller.remove({params:{id:"40"},body:{}},res);
  assert.equal(res.body.success,true);
  assert.equal(calls.isProfileInUse.length,1);
  assert.deepEqual(calls.isProfileInUse[0].options,SLOW);
  assert.equal(calls.removeProfile.length,1);
  assert.deepEqual(calls.removeProfile[0].options,SLOW);
});

test("display paths do not pass the slow budget",async()=>{
  const poolCtl=load("controllers/ipPoolController.js",{savedPools:SAVED_POOLS,delayMs:0});
  const listRes=recorder();
  await poolCtl.controller.list({},listRes);
  assert.equal(Array.isArray(listRes.body),true);
  assert.equal(poolCtl.calls.getUsedIpPools.length,1);
  assert.equal(poolCtl.calls.getUsedIpPools[0],undefined);
  // The plan modal's pool dropdown reads the panel's saved pools, not the
  // router's live pools: it must make no router call at all.
  const pkgCtl=load("controllers/packageController.js",{livePools:LIVE_POOLS,savedPools:SAVED_POOLS,delayMs:0});
  const poolsRes=recorder();
  await pkgCtl.controller.pools({},poolsRes);
  assert.equal(poolsRes.body.success,true);
  assert.deepEqual(poolsRes.body.pools,[{name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254"}]);
  assert.equal(pkgCtl.calls.getIpPools.length,0);
});

test("fast router still works for pool and plan saves",async()=>{
  const poolCtl=load("controllers/ipPoolController.js",{livePools:LIVE_POOLS,delayMs:0});
  const poolRes=recorder();
  await poolCtl.controller.saveOrUpdateIpPool({body:{name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254",localAddress:"10.82.0.1",subnet:"10.82.0.0/24",nextPool:"none"}},poolRes);
  assert.equal(poolRes.body.success,true);
  const pkgCtl=load("controllers/packageController.js",{livePools:LIVE_POOLS,liveProfiles:LIVE_PROFILES,existingPackage:{id:40,plan_name:"45 Mbps",profile_name:"45 Mbps"},delayMs:0});
  const planRes=recorder();
  await pkgCtl.controller.savePlan({body:{id:"40",planName:"45 Mbps",price:"500",durationMonths:"1",rateLimit:"",localAddress:"10.20.0.1",remoteAddress:"100 Mbps",dnsServer:"",changeTcpMss:"default"}},planRes);
  assert.equal(planRes.body.success,true);
});
