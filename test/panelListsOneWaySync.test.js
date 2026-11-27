'use strict';
// Panel lists are one-way sync: panel records come ONLY from the database.
// The router/VPN/IP must never hide the panel's own saved data. These tests
// pin that rule for the three list pages that used to fail the whole response
// on a slow/failed live router call (Render reaches the router through a
// slow VPN-tunnel path, so the live call timed out and the pages showed
// empty even though the database rows were right there).
// Live status is different: the online/offline badge must reflect real live
// session state from MikroTik — which is why the customer list reads the
// background prober's cached router sessions, never the database.
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");

function recorder(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

function loadModule(file,intercepts){
  const original=Module._load;
  delete require.cache[file];
  Module._load=function(request,parent,isMain){
    if(parent&&parent.filename===file&&Object.prototype.hasOwnProperty.call(intercepts,request))return intercepts[request];
    return original.call(this,request,parent,isMain);
  };
  try{return require(file);}
  finally{Module._load=original;}
}

// ---------------- packageController.list ----------------
const PACKAGES=[
  {id:40,plan_name:"45 Mbps",profile_name:"45 Mbps",pool_name:"100 Mbps",local_address:"10.20.0.1",remote_address:"100 Mbps",dns_server:"8.8.8.8,1.1.1.1",change_tcp_mss:"yes",price:"500.00",duration_months:1},
  {id:41,plan_name:"80 Mbps",profile_name:"80 Mbps",pool_name:"150 Mbps",local_address:"10.82.0.1",remote_address:"150 Mbps",dns_server:"8.8.8.8,1.1.1.1",change_tcp_mss:"yes",price:"650.00",duration_months:1}
];
const PANEL_POOLS=[
  {name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254"},
  {name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254"}
];
function loadPackageController(fixture){
  const f=fixture||{};
  const calls={getIpPools:0};
  const db={async query(sql){
    if(sql.includes("FROM ip_pools")){if(f.poolsQueryFails)throw new Error("ip_pools read failed");return{rows:f.pools||[]};}
    if(sql.includes("FROM packages"))return{rows:f.packages||[]};
    return{rows:[]};
  }};
  const mikrotik={async getIpPools(){calls.getIpPools++;if(f.routerDown)throw new Error("Router unreachable");return f.livePools||[];}};
  const file=path.resolve(__dirname,"../controllers/packageController.js");
  return{controller:loadModule(file,{"../db":db,"../services/mikrotikService":mikrotik}),calls};
}

test("package list returns DB plans with pool ranges from DB ip_pools when the router is unreachable",async()=>{
  const {controller,calls}=loadPackageController({packages:PACKAGES,pools:PANEL_POOLS,routerDown:true});
  const res=recorder();
  await controller.list({},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(calls.getIpPools,0,"list() must not call the router at all");
  const byName=new Map(res.body.packages.map(p=>[p.name,p]));
  assert.equal(byName.get("45 Mbps").poolRanges,"10.20.0.2-10.20.0.254");
  assert.equal(byName.get("80 Mbps").poolRanges,"10.82.0.2-10.82.0.254");
});

test("package list still returns DB plans when the ip_pools lookup fails",async()=>{
  const {controller}=loadPackageController({packages:PACKAGES,pools:[],poolsQueryFails:true});
  const res=recorder();
  await controller.list({},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.packages.length,2);
  assert.equal(res.body.packages[0].poolRanges,"");
});

// ---------------- ipPoolController.list ----------------
const SAVED_POOLS=[
  {name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254",local_address:"10.71.0.1",subnet:"10.71.0.1/24",device_name:"Tp-link",next_pool:"none"},
  {name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254",local_address:"10.20.0.1",subnet:"10.20.0.0/24",device_name:"Tp-link",next_pool:"none"}
];
function loadIpPoolController(fixture){
  const f=fixture||{};
  const db={async query(sql){
    if(sql.includes("FROM ip_pools"))return{rows:f.savedPools||[]};
    return{rows:[]};
  }};
  const mikrotik={
    async getIpPools(){if(f.routerDown)throw new Error("Router unreachable");return f.livePools||[];},
    async getUsedIpPools(){if(f.routerDown)throw new Error("Router unreachable");return f.usedRows||[];},
    async getRouterIdentity(){return "Tp-link";}
  };
  const file=path.resolve(__dirname,"../controllers/ipPoolController.js");
  return{controller:loadModule(file,{"../db":db,"../services/mikrotikService":mikrotik})};
}

test("ipPool list returns the saved DB pools when the live router fetch fails",async()=>{
  const {controller}=loadIpPoolController({savedPools:SAVED_POOLS,routerDown:true});
  const res=recorder();
  await controller.list({},res);
  assert.equal(res.statusCode,200);
  assert.ok(Array.isArray(res.body));
  assert.equal(res.body.length,2);
  const byName=new Map(res.body.map(p=>[p.name,p]));
  const pppoe=byName.get("100 Mbps");
  assert.equal(pppoe.ranges,"10.20.0.2-10.20.0.254");
  assert.equal(pppoe.subnet,"10.20.0.0/24");
  assert.equal(pppoe.localAddress,"10.20.0.1");
  assert.equal(pppoe.metaSource,"name");
  assert.equal(pppoe.id,"100 Mbps");
  assert.deepEqual(pppoe.allocations,[]);
});

test("ipPool list still enriches allocations from the router when it answers",async()=>{
  const {controller}=loadIpPoolController({savedPools:SAVED_POOLS,usedRows:[{pool:"100 Mbps",address:"10.20.0.5"},{pool:"100 Mbps",address:"10.20.0.6"}]});
  const res=recorder();
  await controller.list({},res);
  assert.equal(res.statusCode,200);
  const byName=new Map(res.body.map(p=>[p.name,p]));
  assert.equal(byName.get("100 Mbps").allocations.length,2);
  assert.equal(byName.get("400_Hotspot").allocations.length,0);
});

test("ipPool list derives subnet/gateway from the saved ranges when the row lacks them",async()=>{
  const {controller}=loadIpPoolController({savedPools:[{name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254",local_address:"",subnet:"",device_name:"Tp-link",next_pool:"none"}],routerDown:true});
  const res=recorder();
  await controller.list({},res);
  assert.equal(res.body.length,1);
  assert.equal(res.body[0].subnet,"10.82.0.0/24");
  assert.equal(res.body[0].localAddress,"10.82.0.1");
});

// ---------------- customerController.listCustomers ----------------
const CUSTOMERS=[
  {id:7,username:"10001",full_name:"Muslim Uddin",phone:"01723250330",expiration_date:"2026-12-25",status:"active",profile:"45 Mbps",pppoe_profile:"45 Mbps",pppoe_comment:"",remarks:""},
  {id:8,username:"10002",full_name:"Test User",phone:"01800000000",expiration_date:"2026-12-25",status:"active",profile:"45 Mbps",pppoe_profile:"45 Mbps",pppoe_comment:"",remarks:""}
];
function loadCustomerController(fixture){
  const f=fixture||{};
  const calls={liveSessions:0};
  const db={async query(sql){
    if(sql.includes("FROM customers"))return{rows:f.customers||[]};
    return{rows:[]};
  }};
  const mikrotik={async getAllActiveSessionsWithStatus(){calls.liveSessions++;throw new Error("listCustomers must not make a live session lookup");}};
  const prober={getRouterStatusSnapshot(){return f.snapshot||{state:"checking",online:null,lastSeenAt:null,data:null};}};
  const file=path.resolve(__dirname,"../controllers/customerController.js");
  return{controller:loadModule(file,{"../db":db,"../services/mikrotikService":mikrotik,"../services/routerStatusProber":prober}),calls};
}
function customerReq(){return{query:{status:"all"},tenantScope:{global:true}};}

test("customer list marks customers online from the prober snapshot without a live lookup",async()=>{
  const snapshot={state:"online",online:true,lastSeenAt:new Date().toISOString(),data:{sessions:[{username:"10001",address:"10.20.0.5",uptime:"1h2m",callerId:"AA:BB:CC:DD:EE:FF"}]}};
  const {controller,calls}=loadCustomerController({customers:CUSTOMERS,snapshot});
  const res=recorder();
  await controller.listCustomers(customerReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(calls.liveSessions,0,"listCustomers must not call the live session lookup");
  assert.equal(res.body.liveSync,"ok");
  assert.equal(res.body.statusSource,"mikrotik-live");
  const byUsername=new Map(res.body.users.map(u=>[u.username,u]));
  assert.equal(byUsername.get("10001").online,true);
  assert.equal(byUsername.get("10001").session_ip,"10.20.0.5");
  assert.equal(byUsername.get("10002").online,false);
});

test("customer list still renders DB rows as Offline when the prober has no sessions",async()=>{
  const {controller,calls}=loadCustomerController({customers:CUSTOMERS,snapshot:{state:"checking",online:null,lastSeenAt:null,data:null}});
  const res=recorder();
  await controller.listCustomers(customerReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(calls.liveSessions,0,"listCustomers must not call the live session lookup");
  assert.equal(res.body.liveSync,"unavailable");
  assert.equal(res.body.users.length,2);
  assert.ok(res.body.users.every(u=>u.online===false));
});

test("customer list never trusts a stale prober snapshot as live",async()=>{
  const stale={state:"offline",online:false,lastSeenAt:new Date(Date.now()-600000).toISOString(),data:{sessions:[{username:"10001",address:"10.20.0.5",uptime:"1h2m",callerId:"AA:BB:CC:DD:EE:FF"}]}};
  const {controller,calls}=loadCustomerController({customers:CUSTOMERS,snapshot:stale});
  const res=recorder();
  await controller.listCustomers(customerReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(calls.liveSessions,0);
  assert.equal(res.body.liveSync,"unavailable");
  assert.ok(res.body.users.every(u=>u.online===false));
});
