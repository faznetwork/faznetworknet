'use strict';
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const fs=require("node:fs");
const path=require("node:path");

function recorder(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

function loadController(fixture){
  const file=path.resolve(__dirname,"../controllers/ipPoolController.js");
  const original=Module._load;
  const f=fixture||{};
  const db={async query(sql){
    if(sql.includes("FROM ip_pools"))return{rows:f.savedPools||[]};
    return{rows:[]};
  }};
  const mikrotik={
    async getIpPools(){return f.livePools||[];},
    async getUsedIpPools(){return f.usedRows||[];},
    async getRouterIdentity(){return f.identity||"Tp-link";}
  };
  delete require.cache[file];
  Module._load=function(request,parent,isMain){
    if(parent&&parent.filename===file&&request==="../db")return db;
    if(parent&&parent.filename===file&&request==="../services/mikrotikService")return mikrotik;
    return original.call(this,request,parent,isMain);
  };
  try{return{controller:require(file)};}
  finally{Module._load=original;}
}

// Live router + panel state on 2026-11-26: the router pool "200 Mbps" was
// renamed to "PPPoE_Pool" outside the panel; the panel row still says
// "200 Mbps". The modal must still show the real subnet/gateway.
const LIVE_POOLS=[
  {id:"*1",name:"EXPIRED-PROFILE",ranges:"100.65.96.2-100.65.111.254"},
  {id:"*9",name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254"},
  {id:"*12",name:"PPPoE_Pool",ranges:"10.20.0.2-10.20.0.254"},
  {id:"*10",name:"PC_Pool",ranges:"10.10.0.2"},
  {id:"*13",name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254"}
];
const SAVED_POOLS=[
  {name:"200 Mbps",ranges:"10.20.0.2-10.20.0.254",local_address:"10.20.0.1",subnet:"10.20.0.0/24",device_name:"Tp-link",next_pool:"none"},
  {name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254",local_address:"10.71.0.1",subnet:"10.71.0.1/24",device_name:"Tp-link",next_pool:"none"},
  {name:"Expire_Pool",ranges:"100.65.96.2-100.65.111.254",local_address:"100.65.96.1",subnet:"100.65.96.1/20",device_name:"Tp-link",next_pool:"none"}
];
function usedRows(){
  const rows=[];
  for(let i=0;i<21;i++)rows.push({pool:"PPPoE_Pool",address:"10.20.0."+(10+i)});
  for(let i=0;i<10;i++)rows.push({pool:"400_Hotspot",address:"10.71.0."+(10+i)});
  rows.push({pool:"PC_Pool",address:"10.10.0.2"});
  return rows;
}

test("deriveSubnetAndGateway derives subnet+gateway from a usable range",()=>{
  const {controller}=loadController();
  assert.deepEqual(controller.deriveSubnetAndGateway("10.20.0.2-10.20.0.254"),{subnet:"10.20.0.0/24",localAddress:"10.20.0.1"});
  assert.deepEqual(controller.deriveSubnetAndGateway("100.65.96.2-100.65.111.254"),{subnet:"100.65.96.0/20",localAddress:"100.65.96.1"});
  assert.deepEqual(controller.deriveSubnetAndGateway("10.82.0.2-10.82.0.254"),{subnet:"10.82.0.0/24",localAddress:"10.82.0.1"});
  assert.deepEqual(controller.deriveSubnetAndGateway("10.71.0.0/24"),{subnet:"10.71.0.0/24",localAddress:"10.71.0.1"});
});

test("deriveSubnetAndGateway never invents an address it cannot know",()=>{
  const {controller}=loadController();
  assert.equal(controller.deriveSubnetAndGateway("10.10.0.2"),null);
  assert.equal(controller.deriveSubnetAndGateway("10.10.0.2/31"),null);
  assert.equal(controller.deriveSubnetAndGateway("10.20.0.2-10.20.0.254, 10.20.1.2-10.20.1.254"),null);
  assert.equal(controller.deriveSubnetAndGateway("10.20.0.254-10.20.0.2"),null);
  assert.equal(controller.deriveSubnetAndGateway(""),null);
  assert.equal(controller.deriveSubnetAndGateway(null),null);
});

// One-way sync (2026-11-27): the list is the panel's saved ip_pools rows
// ONLY. A pool renamed on the router (here "200 Mbps" -> "PPPoE_Pool")
// no longer changes the list: the saved row shows under its saved name
// with its saved subnet/gateway, and the live name never appears.
test("list() shows the saved pool under its saved name even when the router renamed it",async()=>{
  const {controller}=loadController({livePools:LIVE_POOLS,savedPools:SAVED_POOLS,usedRows:usedRows()});
  const res=recorder();
  await controller.list({},res);
  assert.equal(res.statusCode,200);
  const byName=new Map(res.body.map(p=>[p.name,p]));
  const saved=byName.get("200 Mbps");
  assert.ok(saved);
  assert.equal(saved.subnet,"10.20.0.0/24");
  assert.equal(saved.localAddress,"10.20.0.1");
  assert.equal(saved.metaSource,"name");
  assert.equal(saved.ranges,"10.20.0.2-10.20.0.254");
  assert.equal(saved.allocations.length,0,"usage is keyed by the saved name; the renamed live pool's usage does not attach");
  assert.ok(!byName.has("PPPoE_Pool"),"the live renamed pool must not appear; the list is panel data only");
  const expired=byName.get("Expire_Pool");
  assert.ok(expired);
  assert.equal(expired.subnet,"100.65.96.1/20");
  assert.equal(expired.localAddress,"100.65.96.1");
  assert.equal(expired.metaSource,"name");
});

// One-way sync (2026-11-27): the list is exactly the saved rows. Live-only
// pools (no panel row) never appear, even when the router answers.
test("list() returns exactly the saved pools; live-only pools never appear",async()=>{
  const {controller}=loadController({livePools:LIVE_POOLS,savedPools:SAVED_POOLS,usedRows:usedRows()});
  const res=recorder();
  await controller.list({},res);
  const byName=new Map(res.body.map(p=>[p.name,p]));
  assert.equal(res.body.length,SAVED_POOLS.length);
  const hotspot=byName.get("400_Hotspot");
  assert.equal(hotspot.subnet,"10.71.0.1/24");
  assert.equal(hotspot.localAddress,"10.71.0.1");
  assert.equal(hotspot.metaSource,"name");
  assert.equal(hotspot.allocations.length,10);
  for(const liveOnly of ["PPPoE_Pool","150 Mbps","PC_Pool","EXPIRED-PROFILE"]){
    assert.ok(!byName.has(liveOnly),liveOnly+" has no saved row and must not appear");
  }
});

test("list() never returns the stale 10.81 placeholder values",async()=>{
  const {controller}=loadController({livePools:LIVE_POOLS,savedPools:SAVED_POOLS,usedRows:usedRows()});
  const res=recorder();
  await controller.list({},res);
  for(const pool of res.body){
    assert.ok(!String(pool.subnet||"").includes("10.81"),pool.name+" subnet must not be 10.81");
    assert.ok(!String(pool.localAddress||"").includes("10.81"),pool.name+" localAddress must not be 10.81");
    assert.ok(SAVED_POOLS.some(saved=>saved.name===pool.name),pool.name+" must be a real saved pool");
  }
});

// The Edit modal reads its fields from the list() response (ipPoolCache),
// and the card totals use the frontend countRange() in views/admin.ejs.
// Extract both helpers from the shipped file and test them for real.
function loadCountRange(){
  const adminSrc=fs.readFileSync(path.resolve(__dirname,"../views/admin.ejs"),"utf8");
  const lines=adminSrc.split("\n");
  const ipNumLine=lines.find(l=>l.includes("const ipNum=function"));
  const countRangeLine=lines.find(l=>l.includes("const countRange=function"));
  assert.ok(ipNumLine,"ipNum helper must exist in admin.ejs");
  assert.ok(countRangeLine,"countRange helper must exist in admin.ejs");
  const fn=new Function(ipNumLine+"\n"+countRangeLine+"\nreturn countRange;");
  return {countRange:fn(),adminSrc};
}

test("countRange counts a bare single IP as 1 (PC_Pool total is 1, not 0)",()=>{
  const {countRange}=loadCountRange();
  assert.equal(countRange("10.10.0.2"),1);
  assert.equal(countRange("10.20.0.2-10.20.0.254"),253);
  assert.equal(countRange("10.10.0.2/31"),2);
  assert.equal(countRange("100.65.96.2-100.65.111.254"),4093);
  assert.equal(countRange("10.71.0.2-10.71.0.254"),253);
  assert.equal(countRange("10.82.0.2-10.82.0.254"),253);
});

test("countRange total capacity over the live pools is 4853",()=>{
  const {countRange}=loadCountRange();
  const total=LIVE_POOLS.reduce((sum,p)=>sum+countRange(p.ranges),0);
  assert.equal(total,4853);
  const pcTotal=countRange("10.10.0.2");
  const pcUsed=1;
  assert.equal(pcTotal-pcUsed,0);
  assert.equal(Math.round(pcUsed/pcTotal*100),100);
});

test("the Edit modal template has no 10.81 placeholder left",()=>{
  const {adminSrc}=loadCountRange();
  assert.ok(!adminSrc.includes("10.81"),"admin.ejs must not contain 10.81 anywhere");
  assert.ok(adminSrc.includes('placeholder="10.0.0.1/24"'),"subnet placeholder must be the neutral 10.0.0.1/24");
  assert.ok(adminSrc.includes('placeholder="10.0.0.2-10.0.0.254"'),"range placeholder must be the neutral 10.0.0.2-10.0.0.254");
  for(const id of ["ipPoolName","ipPoolSubnet","ipPoolLocalAddress","ipPoolRanges","ipPoolNext"]){
    assert.ok(adminSrc.includes('id="'+id+'"'),"modal field "+id+" must exist");
  }
});
