'use strict';
// Customer 360 live session comes from the background prober's cached
// MikroTik sessions (same source as the dashboard and the customer list),
// never from a per-request router call. From Render the router handshake
// alone outlasts the old 2-3s caps, so the 360 always timed out and every
// customer showed "Router: Unavailable" + Offline — even a customer online
// for hours. These tests pin that rule for the three 360 display paths
// (resolveCustomer360 via /:id/profile, getCustomerLiveSession, and the
// older profile() used by the admin 360 modal), plus the plans alias-case
// bug that made the page show "Pool not resolved" (PostgreSQL folds the
// unquoted AS profileName / AS poolName aliases to lowercase, so reading
// the camelCase keys returned undefined).
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

// ---------------- fixtures (10015 / Prodip Debnath, ground truth) ----------------
const CUSTOMER_10015={
  id:25,username:"10015",full_name:"Prodip Debnath",phone:"01716675195",
  email:null,whatsapp_phone:null,telegram_link:null,facebook_link:null,
  alternative_phone:null,nid:null,installation_address:null,area_zone:null,
  connection_date:"2026-10-01",distribution_box:null,fiber_box:null,
  fiber_drop_core:null,onu_serial:null,remarks:null,password:"secret123",
  remote_address:null,billing_cycle:"monthly",billing_duration_days:null,
  billing_expiry_override:false,billing_status:"paid",
  last_disconnect_reason:null,pop_id:null,router_id:null,status:"active",
  expiration_date:"2026-12-05",package_name:"45 Mbps",profile:"45 Mbps",
  monthly_bill:"500.00",paid_until:"2026-12-05",router_mac:null,caller_id:null
};
const SECRET_10015={
  username:"10015",profile:"45 Mbps",password:"secret123",disabled:false,
  remote_address:null,caller_id:null,comment:"EXP: 2026-12-06",
  service:"pppoe",expiry_date:"2026-12-05",status:"active"
};
// Rows exactly as pg returns them for the resolveCustomer360 packages query:
// the unquoted AS profileName / AS poolName aliases are folded to lowercase.
const PACKAGES_PG=[
  {id:40,name:"45 Mbps",profilename:"45 Mbps",poolname:"100 Mbps",price:"500.00",durationmonths:1,ratelimit:null,remoteaddress:"100 Mbps"},
  {id:41,name:"80 Mbps",profilename:"80 Mbps",poolname:"150 Mbps",price:"650.00",durationmonths:1,ratelimit:null,remoteaddress:"150 Mbps"}
];
// Rows as pg returns them for the older profile() packages query (raw columns).
const PACKAGES_RAW=[
  {id:40,plan_name:"45 Mbps",profile_name:"45 Mbps",price:"500.00",duration_months:1,rate_limit:null,remote_address:"100 Mbps"},
  {id:41,plan_name:"80 Mbps",profile_name:"80 Mbps",price:"650.00",duration_months:1,rate_limit:null,remote_address:"150 Mbps"}
];
const PAYMENTS=[{trx_id:"TX123",amount:"500.00",method:"cash",created_at:new Date("2026-11-26T02:56:12Z"),status:"PAID"}];
const PAYMENTS_GATEWAY=[{trx_id:"TX123",amount:"500.00",gateway:"cash",created_at:new Date("2026-11-26T02:56:12Z"),status:"PAID"}];
const SAVED_POOLS=[
  {name:"100 Mbps",ranges:"10.20.0.2-10.20.0.254"},
  {name:"EXPIRED-PROFILE",ranges:"100.65.96.2-100.65.111.254"},
  {name:"PC_Pool",ranges:"10.10.0.2/31"},
  {name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254"},
  {name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254"}
];
const PROBER_SESSION_10015={username:"10015",address:"10.20.0.238",uptime:"2h40m10s",callerId:"BC:E0:01:AF:F7:C7",service:"pppoe",bytesIn:"1769565",bytesOut:"25468"};
function freshCandidate(minutesAgo){
  return {username:"10015",address:"10.20.0.238",uptime:"2h40m10s",service:"pppoe",bytesIn:"1769565",bytesOut:"25468",callerId:"BC:E0:01:AF:F7:C7",receivedAt:new Date(Date.now()-minutesAgo*60*1000)};
}
function onlineSnapshot(sessions){
  return {state:"online",online:true,lastSeenAt:new Date().toISOString(),data:{sessions:sessions||[PROBER_SESSION_10015]}};
}
function offlineSnapshot(sessions){
  return {state:"offline",online:false,lastSeenAt:new Date(Date.now()-600000).toISOString(),data:{sessions:sessions||[PROBER_SESSION_10015]}};
}
function checkingSnapshot(){
  return {state:"checking",online:null,lastSeenAt:null,data:null};
}

function loadCustomerController(fixture){
  const f=fixture||{};
  const calls={router:[]};
  const db={async query(sql){
    if(sql.includes("FROM pppoe_live_sessions"))return{rows:f.candidate?[f.candidate]:[]};
    if(sql.includes("FROM pppoe_users"))return{rows:f.secret?[f.secret]:[]};
    if(sql.includes("FROM customers"))return{rows:f.customer?[f.customer]:[]};
    if(sql.includes("FROM ip_pools"))return{rows:f.pools||[]};
    if(sql.includes("FROM packages"))return{rows:f.packages||[]};
    if(sql.includes("FROM transactions"))return{rows:f.payments||[]};
    if(sql.includes("FROM pops"))return{rows:[]};
    return{rows:[]};
  }};
  const mikrotik=new Proxy({},{get(target,prop){
    return (...args)=>{calls.router.push(String(prop));throw new Error("360 display path must not call the router ("+String(prop)+")");};
  }});
  const prober={getRouterStatusSnapshot(){return f.snapshot||checkingSnapshot();}};
  const file=path.resolve(__dirname,"../controllers/customerController.js");
  return{controller:loadModule(file,{"../db":db,"../services/mikrotikService":mikrotik,"../services/routerStatusProber":prober}),calls};
}
function profileReq(){return{params:{id:"10015"},tenantScope:{global:true}};}
function liveReq(){return{params:{id:"10015"},tenantScope:{global:true}};}
function oldProfileReq(){return{query:{username:"10015"},tenantScope:{global:true}};}

// ---------------- resolveCustomer360 (via getCustomerProfileById) ----------------
test("360 profile shows the customer online from the prober snapshot without a live router call",async()=>{
  const {controller,calls}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,packages:PACKAGES_PG,payments:PAYMENTS,candidate:null,snapshot:onlineSnapshot()});
  const res=recorder();
  await controller.getCustomerProfileById(profileReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.deepEqual(calls.router,[],"360 display must not call the router at all");
  assert.equal(res.body.customer.routerStatus,"reachable");
  assert.equal(res.body.live.status,"online");
  assert.equal(res.body.live.online,true);
  assert.equal(res.body.live.isLive,true);
  assert.equal(res.body.live.ip,"10.20.0.238");
  assert.equal(res.body.live.mac,"BC:E0:01:AF:F7:C7");
  assert.equal(res.body.live.uptime,"2h40m10s");
  assert.equal(res.body.live.router_status,"reachable");
});

test("360 profile resolves the pool to 100 Mbps for a 45 Mbps customer (pg lowercase aliases)",async()=>{
  const {controller}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,packages:PACKAGES_PG,payments:PAYMENTS,candidate:null,snapshot:onlineSnapshot()});
  const res=recorder();
  await controller.getCustomerProfileById(profileReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.customer.poolName,"100 Mbps");
  assert.equal(res.body.package.poolName,"100 Mbps");
  assert.equal(res.body.package.name,"45 Mbps");
  assert.equal(res.body.package.profileName,"45 Mbps");
});

test("360 profile shows Offline when the prober snapshot has no session for the customer, DB data still renders",async()=>{
  const {controller,calls}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,packages:PACKAGES_PG,payments:PAYMENTS,candidate:null,snapshot:onlineSnapshot([])});
  const res=recorder();
  await controller.getCustomerProfileById(profileReq(),res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(calls.router,[]);
  assert.equal(res.body.live.status,"offline");
  assert.equal(res.body.live.online,false);
  assert.equal(res.body.customer.routerStatus,"reachable");
  assert.equal(res.body.customer.poolName,"100 Mbps");
  assert.equal(res.body.customer.packageName,"45 Mbps");
  assert.equal(res.body.customer.status,"active");
  assert.equal(res.body.payments.length,1);
  assert.equal(res.body.payments[0].trxId,"TX123");
});

test("360 profile never trusts a stale offline-state snapshot, even with the session in it",async()=>{
  const {controller,calls}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,packages:PACKAGES_PG,payments:PAYMENTS,candidate:freshCandidate(10),snapshot:offlineSnapshot()});
  const res=recorder();
  await controller.getCustomerProfileById(profileReq(),res);
  assert.equal(res.statusCode,200);
  assert.deepEqual(calls.router,[]);
  assert.equal(res.body.customer.routerStatus,"unreachable");
  assert.equal(res.body.live.status,"offline");
  assert.equal(res.body.live.online,false);
  assert.equal(res.body.live.ip,"");
});

test("360 profile falls back to a fresh DB session candidate when the prober has no session data",async()=>{
  const {controller}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,packages:PACKAGES_PG,payments:PAYMENTS,candidate:freshCandidate(1),snapshot:checkingSnapshot()});
  const res=recorder();
  await controller.getCustomerProfileById(profileReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.live.status,"online");
  assert.equal(res.body.live.ip,"10.20.0.238");
  assert.equal(res.body.live.mac,"BC:E0:01:AF:F7:C7");
  assert.equal(res.body.customer.routerStatus,"unreachable");
});

test("360 profile never invents a locked MAC: NULL stored caller_id stays empty",async()=>{
  const {controller}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,packages:PACKAGES_PG,payments:PAYMENTS,candidate:null,snapshot:onlineSnapshot()});
  const res=recorder();
  await controller.getCustomerProfileById(profileReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.macLock.locked,false);
  assert.equal(res.body.macLock.lockedMac,"");
  assert.equal(res.body.macLock.storedMac,"");
  assert.equal(res.body.macLock.liveMac,"BC:E0:01:AF:F7:C7");
});

// ---------------- getCustomerLiveSession ----------------
test("live-session shows Online from the prober snapshot with the pool resolved from DB ip_pools",async()=>{
  const {controller,calls}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,pools:SAVED_POOLS,candidate:null,snapshot:onlineSnapshot()});
  const res=recorder();
  await controller.getCustomerLiveSession(liveReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.deepEqual(calls.router,[],"live-session must not call the router at all");
  assert.equal(res.body.liveStatusAvailable,true);
  assert.equal(res.body.live.status,"online");
  assert.equal(res.body.live.online,true);
  assert.equal(res.body.live.ip,"10.20.0.238");
  assert.equal(res.body.live.mac,"BC:E0:01:AF:F7:C7");
  assert.equal(res.body.live.uptime,"2h40m10s");
  assert.equal(res.body.live.poolName,"100 Mbps");
  assert.equal(res.body.live.router_status,"reachable");
});

test("live-session shows Offline (router reachable) when the prober has no session for the customer",async()=>{
  const {controller}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,pools:SAVED_POOLS,candidate:null,snapshot:onlineSnapshot([])});
  const res=recorder();
  await controller.getCustomerLiveSession(liveReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.liveStatusAvailable,true);
  assert.equal(res.body.live.status,"offline");
  assert.equal(res.body.live.router_status,"reachable");
});

test("live-session reports unavailable when the prober is offline and no fresh DB candidate exists",async()=>{
  const {controller}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,pools:SAVED_POOLS,candidate:freshCandidate(10),snapshot:offlineSnapshot([])});
  const res=recorder();
  await controller.getCustomerLiveSession(liveReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.liveStatusAvailable,false);
  assert.equal(res.body.live.status,"offline");
  assert.equal(res.body.live.router_status,"unreachable");
});

test("live-session falls back to a fresh DB candidate with live_sync cached",async()=>{
  const {controller}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,pools:SAVED_POOLS,candidate:freshCandidate(1),snapshot:checkingSnapshot()});
  const res=recorder();
  await controller.getCustomerLiveSession(liveReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.liveStatusAvailable,true);
  assert.equal(res.body.live.status,"online");
  assert.equal(res.body.live.ip,"10.20.0.238");
  assert.equal(res.body.live.poolName,"100 Mbps");
  assert.equal(res.body.live.live_sync,"cached");
});

// ---------------- profile() (admin 360 modal) ----------------
test("profile() shows the customer online from the prober snapshot without a live router call",async()=>{
  const {controller,calls}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,packages:PACKAGES_RAW,payments:PAYMENTS_GATEWAY,candidate:null,snapshot:onlineSnapshot()});
  const res=recorder();
  await controller.profile(oldProfileReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.deepEqual(calls.router,[],"profile() must not call the router at all");
  assert.equal(res.body.live.online,true);
  assert.equal(res.body.live.ip,"10.20.0.238");
  assert.equal(res.body.live.mac,"BC:E0:01:AF:F7:C7");
  assert.equal(res.body.live.uptime,"2h40m10s");
  assert.equal(res.body.macLock.locked,false);
  assert.equal(res.body.macLock.liveMac,"BC:E0:01:AF:F7:C7");
});

test("profile() shows Offline when the prober snapshot is stale, DB data still renders",async()=>{
  const {controller}=loadCustomerController({customer:CUSTOMER_10015,secret:SECRET_10015,packages:PACKAGES_RAW,payments:PAYMENTS_GATEWAY,candidate:null,snapshot:offlineSnapshot()});
  const res=recorder();
  await controller.profile(oldProfileReq(),res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.live.online,false);
  assert.equal(res.body.customer.username,"10015");
  assert.equal(res.body.customer.profile,"45 Mbps");
  assert.equal(res.body.plans.length,2);
});

// ---------------- resolvePoolNameForIp ----------------
test("resolvePoolNameForIp matches a-b ranges, CIDR /31, and returns null outside every pool",async()=>{
  const {controller}=loadCustomerController({});
  assert.equal(controller.resolvePoolNameForIp("10.20.0.238",SAVED_POOLS),"100 Mbps");
  assert.equal(controller.resolvePoolNameForIp("10.82.0.100",SAVED_POOLS),"150 Mbps");
  assert.equal(controller.resolvePoolNameForIp("100.65.100.5",SAVED_POOLS),"EXPIRED-PROFILE");
  assert.equal(controller.resolvePoolNameForIp("10.10.0.2",SAVED_POOLS),"PC_Pool");
  assert.equal(controller.resolvePoolNameForIp("10.10.0.3",SAVED_POOLS),"PC_Pool");
  assert.equal(controller.resolvePoolNameForIp("10.10.0.5",SAVED_POOLS),null);
  assert.equal(controller.resolvePoolNameForIp("10.71.0.9",SAVED_POOLS),"400_Hotspot");
  assert.equal(controller.resolvePoolNameForIp("not-an-ip",SAVED_POOLS),null);
  assert.equal(controller.resolvePoolNameForIp("10.20.0.5",[]),null);
});
