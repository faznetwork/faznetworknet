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
  const calls={createIpPool:[],updateIpPool:[],deleteIpPool:[],dbDelete:[],dbInsert:[]};
  const db={async query(sql,params){
    if(/DELETE FROM ip_pools/i.test(sql)){
      if(f.failDbDelete)throw new Error("db down");
      calls.dbDelete.push({sql,params});
      return{rowCount:1};
    }
    if(/INSERT INTO ip_pools/i.test(sql)){calls.dbInsert.push({sql,params});return{rowCount:1};}
    if(sql.includes("FROM ip_pools"))return{rows:f.savedPools||[]};
    return{rows:[]};
  }};
  const mikrotik={
    async getIpPools(){return f.livePools||[];},
    async getUsedIpPools(){return[];},
    async getRouterIdentity(){return f.identity||"Tp-link";},
    async createIpPool(data){calls.createIpPool.push({data});return data;},
    async updateIpPool(id,data){calls.updateIpPool.push({id,data});return{id,...data};},
    async deleteIpPool(name){calls.deleteIpPool.push({name});return{name};}
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

// Live router state at the time of the bug: EXPIRED-PROFILE owns the CGNAT
// range, Expire_Pool is absent (deleted), the panel still has its stale row.
const LIVE_POOLS=[
  {id:"*1",name:"EXPIRED-PROFILE",ranges:"100.65.96.2-100.65.111.254"},
  {id:"*12",name:"200 Mbps",ranges:"10.20.0.2-10.20.0.254"},
  {id:"*9",name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254"}
];
const SAVED_POOLS=[
  {name:"200 Mbps",ranges:"10.20.0.2-10.20.0.254",next_pool:"none"},
  {name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254",next_pool:"none"},
  {name:"Expire_Pool",ranges:"100.65.96.2-100.65.111.254",next_pool:"none"}
];

test("normalizePoolRanges normalizes IPs and rejects bad ranges",()=>{
  const {controller}=loadController();
  assert.equal(controller.normalizePoolRanges("100.65.96.2-100.65.111.254"),"100.65.96.2-100.65.111.254");
  assert.equal(controller.normalizePoolRanges("100.065.096.002 - 100.65.111.254"),"100.65.96.2-100.65.111.254");
  assert.equal(controller.normalizePoolRanges("10.10.0.2/31"),"10.10.0.2/31");
  assert.equal(controller.normalizePoolRanges("10.20.0.2-10.20.0.254, 10.20.1.2-10.20.1.254"),"10.20.0.2-10.20.0.254,10.20.1.2-10.20.1.254");
  assert.equal(controller.normalizePoolRanges("not-a-range"),null);
  assert.equal(controller.normalizePoolRanges(""),null);
  assert.equal(controller.normalizePoolRanges("10.20.0.254-10.20.0.2"),null);
});

test("findPoolWithSameRanges finds the live pool holding identical ranges",()=>{
  const {controller}=loadController();
  const dup=controller.findPoolWithSameRanges("100.65.96.2-100.65.111.254",LIVE_POOLS);
  assert.ok(dup);
  assert.equal(dup.name,"EXPIRED-PROFILE");
  assert.equal(controller.findPoolWithSameRanges("10.82.0.2-10.82.0.254",LIVE_POOLS),null);
  assert.equal(controller.findPoolWithSameRanges("100.065.096.002-100.65.111.254",LIVE_POOLS).name,"EXPIRED-PROFILE");
});

test("sync does NOT resurrect Expire_Pool: duplicate ranges are skipped, others update",async()=>{
  const {controller,calls}=loadController({livePools:LIVE_POOLS,savedPools:SAVED_POOLS});
  const res=recorder();
  await controller.syncPanelToMikrotik({},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.created,0);
  assert.equal(res.body.updated,2);
  assert.equal(res.body.failed,0);
  assert.equal(res.body.skipped,1);
  const byName=new Map(res.body.results.map(x=>[x.name,x]));
  assert.equal(byName.get("200 Mbps").status,"updated");
  assert.equal(byName.get("400_Hotspot").status,"updated");
  assert.equal(byName.get("Expire_Pool").status,"skipped");
  assert.match(byName.get("Expire_Pool").message,/EXPIRED-PROFILE/);
  assert.match(byName.get("Expire_Pool").message,/already exist/);
  assert.match(res.body.message,/1 skipped/);
  assert.match(res.body.message,/Expire_Pool/);
  // Expire_Pool must never reach the router.
  assert.equal(calls.createIpPool.filter(x=>x.data.name==="Expire_Pool").length,0);
  assert.equal(calls.createIpPool.length,0);
});

test("sync still creates a genuinely missing pool with unique ranges",async()=>{
  const saved=[{name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254",next_pool:"none"}];
  const {controller,calls}=loadController({livePools:LIVE_POOLS,savedPools:saved});
  const res=recorder();
  await controller.syncPanelToMikrotik({},res);
  assert.equal(res.body.created,1);
  assert.equal(res.body.skipped,0);
  assert.equal(calls.createIpPool.length,1);
  assert.deepEqual(calls.createIpPool[0].data,{name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254",nextPool:"none"});
});

test("panel delete removes the router pool AND the saved panel record",async()=>{
  const {controller,calls}=loadController({livePools:LIVE_POOLS,savedPools:SAVED_POOLS});
  const res=recorder();
  await controller.remove({params:{id:"Expire_Pool"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(calls.deleteIpPool.length,1);
  assert.equal(calls.deleteIpPool[0].name,"Expire_Pool");
  assert.equal(calls.dbDelete.length,1);
  assert.deepEqual(calls.dbDelete[0].params,["Tp-link","Expire_Pool"]);
});

test("panel delete still succeeds when the panel-record cleanup fails",async()=>{
  const {controller,calls}=loadController({livePools:LIVE_POOLS,savedPools:SAVED_POOLS,failDbDelete:true});
  const res=recorder();
  await controller.remove({params:{id:"Expire_Pool"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(calls.deleteIpPool.length,1);
  assert.equal(calls.dbDelete.length,0);
});

test("panel delete refuses default system pools",async()=>{
  const {controller,calls}=loadController();
  const res=recorder();
  await controller.remove({params:{id:"default"}},res);
  assert.equal(res.statusCode,400);
  assert.equal(calls.deleteIpPool.length,0);
});
