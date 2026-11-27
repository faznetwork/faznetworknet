'use strict';
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");

function recorder(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

function loadController(fixture){
  const file=path.resolve(__dirname,"../controllers/ipPoolController.js");
  const original=Module._load;
  const f=fixture||{};
  const calls={dbUpdate:[],dbRename:[],dbInsert:[],dbDelete:[],routerWrites:[]};
  const db={async query(sql,params){
    // A faithful mock: an UPDATE only affects a row when the named row
    // exists in the fixture, so the handler's insert-fallback runs for
    // genuinely new pools (the production rowCount behaves the same way).
    if(/UPDATE ip_pools SET name=/i.test(sql)){const exists=(f.savedPools||[]).some(r=>String(r.name||"").toLowerCase()===String(params[6]||"").toLowerCase());const rowCount=(f.renameRowCount!==undefined?f.renameRowCount:(exists?1:0));calls.dbRename.push({sql,params,rowCount});return{rowCount};}
    if(/UPDATE ip_pools SET ranges=/i.test(sql)){const exists=(f.savedPools||[]).some(r=>String(r.name||"").toLowerCase()===String(params[5]||"").toLowerCase());const rowCount=(f.updateRowCount!==undefined?f.updateRowCount:(exists?1:0));calls.dbUpdate.push({sql,params,rowCount});return{rowCount};}
    if(/INSERT INTO ip_pools/i.test(sql)){calls.dbInsert.push({sql,params});return{rowCount:1};}
    if(/DELETE FROM ip_pools/i.test(sql)){calls.dbDelete.push({sql,params});return{rowCount:1};}
    if(sql.includes("FROM ip_pools"))return{rows:f.savedPools||[]};
    return{rows:[]};
  }};
  const mikrotik={
    async getIpPools(){if(f.failLive)throw new Error("router down");return f.livePools||[];},
    async getUsedIpPools(){return[];},
    async getRouterIdentity(){return f.identity||"Tp-link";},
    async createIpPool(data){calls.routerWrites.push({op:"create",data});return data;},
    async updateIpPool(id,data){calls.routerWrites.push({op:"update",id,data});return{id,...data};},
    async deleteIpPool(name){calls.routerWrites.push({op:"delete",name});return{name};}
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

// Live router state (verified 2026-11-27): 5 pools. The panel DB has only 2.
const LIVE_POOLS=[
  {id:"*1",name:"EXPIRED-PROFILE",ranges:"100.65.96.2-100.65.111.254",nextPool:"none"},
  {id:"*2",name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254",nextPool:"none"},
  {id:"*3",name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254",nextPool:"none"},
  {id:"*4",name:"PC_Pool",ranges:"10.10.0.2/31",nextPool:"none"},
  {id:"*5",name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254",nextPool:"none"}
];
const SAVED_POOLS=[
  {name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254",local_address:"10.71.0.1",subnet:"10.71.0.1/24",device_name:"Tp-link",next_pool:"none"},
  {name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254",local_address:"10.20.0.1",subnet:"10.20.0.0/24",device_name:"Tp-link",next_pool:"none"}
];

test("imports missing pools as new rows and updates the saved ones",async()=>{
  const {controller,calls}=loadController({livePools:LIVE_POOLS,savedPools:SAVED_POOLS});
  const res=recorder();
  await controller.syncFromMikrotik({},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.total,5);
  assert.equal(res.body.created,3);
  assert.equal(res.body.updated,2);
  assert.equal(res.body.failed,0);
  assert.equal(res.body.skipped,0);
  assert.deepEqual(calls.dbInsert.map(x=>x.params[0]).sort(),["150 Mbps","EXPIRED-PROFILE","PC_Pool"]);
  // savePoolRow tries the UPDATE first for every pool; only the 2 saved
  // rows are actually updated (rowCount>0), the 3 new ones fall to INSERT.
  assert.equal(calls.dbUpdate.filter(x=>x.rowCount>0).length,2);
  assert.deepEqual(calls.dbUpdate.filter(x=>x.rowCount>0).map(x=>x.params[5]).sort(),["100 Mbps","400_Hotspot"]);
  // No router writes: the import only reads the router.
  assert.equal(calls.routerWrites.length,0);
  assert.equal(calls.dbDelete.length,0);
  assert.match(res.body.message,/3 created, 2 updated, 0 failed/);
  // PC_Pool is a /31: no meaningful gateway, so subnet/localAddress stay null.
  const pc=calls.dbInsert.find(x=>x.params[0]==="PC_Pool");
  assert.equal(pc.params[2],null);
  assert.equal(pc.params[3],null);
  assert.equal(pc.params[4],"Tp-link");
  // EXPIRED-PROFILE derives its /20 subnet and gateway from the ranges.
  const exp=calls.dbInsert.find(x=>x.params[0]==="EXPIRED-PROFILE");
  assert.equal(exp.params[2],"100.65.96.1");
  assert.equal(exp.params[3],"100.65.96.0/20");
});

test("updates an existing pool by name when its ranges changed",async()=>{
  const saved=[{name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.200",local_address:"10.71.0.1",subnet:"10.71.0.1/24",device_name:"Tp-link",next_pool:"none"}];
  const live=[{id:"*2",name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254",nextPool:"none"}];
  const {controller,calls}=loadController({livePools:live,savedPools:saved});
  const res=recorder();
  await controller.syncFromMikrotik({},res);
  assert.equal(res.body.created,0);
  assert.equal(res.body.updated,1);
  assert.equal(calls.dbUpdate.length,1);
  assert.deepEqual(calls.dbUpdate[0].params,["10.71.0.2-10.71.0.254","10.71.0.1","10.71.0.1/24","Tp-link","none","400_Hotspot"]);
  assert.equal(calls.dbInsert.length,0);
  assert.equal(calls.routerWrites.length,0);
});

test("renames a saved pool by matching ranges instead of inserting a duplicate",async()=>{
  const saved=[{name:"PPPoE_Pool",ranges:"10.20.0.2-10.20.0.254",local_address:"10.20.0.1",subnet:"10.20.0.0/24",device_name:"Tp-link",next_pool:"none"}];
  const live=[{id:"*3",name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254",nextPool:"none"}];
  const {controller,calls}=loadController({livePools:live,savedPools:saved});
  const res=recorder();
  await controller.syncFromMikrotik({},res);
  assert.equal(res.body.created,0);
  assert.equal(res.body.updated,1);
  assert.equal(calls.dbRename.length,1);
  assert.deepEqual(calls.dbRename[0].params,["100 Mbps","10.20.0.2-10.20.0.254","10.20.0.1","10.20.0.0/24","Tp-link","none","PPPoE_Pool"]);
  assert.equal(calls.dbInsert.length,0);
  assert.match(res.body.results[0].message,/Renamed saved pool "PPPoE_Pool" to "100 Mbps"/);
  assert.equal(calls.routerWrites.length,0);
});

test("skips default system pools",async()=>{
  const live=[
    {id:"*0",name:"default",ranges:"10.0.0.2-10.0.0.254",nextPool:"none"},
    {id:"*0b",name:"default-encryption",ranges:"10.0.1.2-10.0.1.254",nextPool:"none"},
    {id:"*5",name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254",nextPool:"none"}
  ];
  const {controller,calls}=loadController({livePools:live,savedPools:[]});
  const res=recorder();
  await controller.syncFromMikrotik({},res);
  assert.equal(res.body.total,3);
  assert.equal(res.body.created,1);
  assert.equal(res.body.skipped,2);
  assert.equal(calls.dbInsert.length,1);
  assert.equal(calls.dbInsert[0].params[0],"150 Mbps");
});

test("does not delete panel-only rows",async()=>{
  const saved=[...SAVED_POOLS,{name:"Old_Pool",ranges:"10.99.0.2-10.99.0.254",local_address:"10.99.0.1",subnet:"10.99.0.0/24",device_name:"Tp-link",next_pool:"none"}];
  const {controller,calls}=loadController({livePools:LIVE_POOLS,savedPools:saved});
  const res=recorder();
  await controller.syncFromMikrotik({},res);
  assert.equal(res.body.success,true);
  assert.equal(calls.dbDelete.length,0);
  assert.equal(res.body.results.some(x=>x.name==="Old_Pool"),false);
});

test("returns correct summary counts for a mixed run",async()=>{
  const live=[
    {id:"*5",name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254",nextPool:"none"},
    {id:"*2",name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254",nextPool:"none"},
    {id:"*0",name:"default",ranges:"10.0.0.2-10.0.0.254",nextPool:"none"},
    {id:"*9",name:"Bad_Pool",ranges:"not-a-range",nextPool:"none"}
  ];
  const {controller}=loadController({livePools:live,savedPools:SAVED_POOLS});
  const res=recorder();
  await controller.syncFromMikrotik({},res);
  assert.equal(res.body.total,4);
  assert.equal(res.body.created,1);
  assert.equal(res.body.updated,1);
  assert.equal(res.body.failed,1);
  assert.equal(res.body.skipped,1);
  assert.match(res.body.message,/1 created, 1 updated, 1 failed\. 1 skipped\./);
  assert.match(res.body.message,/Bad_Pool/);
});

test("inserts when the by-name update affects no rows",async()=>{
  const live=[{id:"*2",name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254",nextPool:"none"}];
  const {controller,calls}=loadController({livePools:live,savedPools:SAVED_POOLS,updateRowCount:0});
  const res=recorder();
  await controller.syncFromMikrotik({},res);
  assert.equal(res.body.updated,1);
  assert.equal(calls.dbUpdate.length,1);
  assert.equal(calls.dbInsert.length,1);
  assert.equal(calls.dbInsert[0].params[0],"400_Hotspot");
});

test("returns an error when the router cannot be reached",async()=>{
  const {controller,calls}=loadController({failLive:true,savedPools:SAVED_POOLS});
  const res=recorder();
  await controller.syncFromMikrotik({},res);
  assert.equal(res.statusCode,503);
  assert.equal(res.body.success,false);
  assert.equal(calls.dbInsert.length,0);
  assert.equal(calls.dbUpdate.length,0);
});
