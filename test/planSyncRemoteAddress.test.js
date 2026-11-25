'use strict';
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");

function recorder(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

function loadController(fixture){
  const file=path.resolve(__dirname,"../controllers/packageController.js");
  const original=Module._load;
  const f=fixture||{};
  const calls={updateProfile:[],createProfile:[],createIpPool:[],getIpPools:0};
  const db={async query(sql){
    if(sql.includes("FROM ip_pools")){
      if(f.failPanelPools)throw new Error("ip_pools table missing");
      return{rows:f.panelPools||[]};
    }
    if(sql.includes("FROM packages"))return{rows:f.packages||[]};
    if(sql.includes("SELECT * FROM packages WHERE id="))return{rows:f.existingRow?[f.existingRow]:[]};
    if(sql.includes("UPDATE packages")||sql.includes("INSERT INTO packages"))return{rows:[{plan_name:"Test Plan"}]};
    return{rows:[]};
  }};
  const mikrotik={
    async getIpPools(){calls.getIpPools++;return f.pools||[];},
    async fetchExistingProfiles(){return f.profiles||[];},
    async updateProfile(id,data){calls.updateProfile.push({id,data});return{id,name:data.name};},
    async createProfile(data){calls.createProfile.push({data});return{name:data.name};},
    async createIpPool(data){calls.createIpPool.push({data});return data;}
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

const LIVE_POOLS=[
  {name:"EXPIRED-PROFILE",ranges:"100.65.96.2-100.65.111.254"},
  {name:"200 Mbps",ranges:"10.20.0.2-10.20.0.254"},
  {name:"400_Hotspot",ranges:"10.71.0.2-10.71.0.254"}
];
const LIVE_PROFILES=[
  {id:"*B",name:"45 Mbps",localAddress:"10.20.0.1",remoteAddress:"200 Mbps",raw:{"remote-address":"200 Mbps"}},
  {id:"*D",name:"EXPIRED-PROFILE",localAddress:"100.65.96.1",remoteAddress:"EXPIRED-PROFILE",raw:{"remote-address":"EXPIRED-PROFILE"}}
];
const LIVE_PACKAGES=[
  {plan_name:"45 Mbps",profile_name:"45 Mbps",pool_name:"PPPoE_Pool",remote_address:"PPPoE_Pool",local_address:"10.20.0.1",rate_limit:null,dns_server:"8.8.8.8,1.1.1.1",change_tcp_mss:"yes"},
  {plan_name:"80 Mbps",profile_name:"80 Mbps",pool_name:"150 Mbps",remote_address:"150 Mbps",local_address:"10.82.0.1",rate_limit:null,dns_server:"8.8.8.8,1.1.1.1",change_tcp_mss:"yes"},
  {plan_name:"EXPIRED-PROFILE",profile_name:"EXPIRED-PROFILE",pool_name:"EXPIRED-PROFILE",remote_address:"EXPIRED-PROFILE",local_address:"100.65.96.1",rate_limit:"1k/1k",dns_server:null,change_tcp_mss:"default"}
];

test("resolveRemoteAddress matches a live pool case-insensitively, accepts a static IP, flags a stale pool",()=>{
  const {controller}=loadController();
  assert.deepEqual(controller.resolveRemoteAddress("200 mbps",LIVE_POOLS),{kind:"pool",name:"200 Mbps"});
  assert.deepEqual(controller.resolveRemoteAddress("10.82.0.5",LIVE_POOLS),{kind:"ip",name:"10.82.0.5"});
  assert.deepEqual(controller.resolveRemoteAddress("",LIVE_POOLS),{kind:"empty",name:""});
  assert.deepEqual(controller.resolveRemoteAddress("PPPoE_Pool",LIVE_POOLS),{kind:"missing",name:"PPPoE_Pool"});
  assert.deepEqual(controller.resolveRemoteAddress("150 Mbps",LIVE_POOLS),{kind:"missing",name:"150 Mbps"});
});

test("isValidIpv4 accepts dotted quads and rejects bad octets",()=>{
  const {controller}=loadController();
  assert.equal(controller.isValidIpv4("10.82.0.1"),true);
  assert.equal(controller.isValidIpv4("8.8.8.8"),true);
  assert.equal(controller.isValidIpv4("999.1.1.1"),false);
  assert.equal(controller.isValidIpv4("10.0.0"),false);
  assert.equal(controller.isValidIpv4("10.0.0.1.5"),false);
  assert.equal(controller.isValidIpv4(""),false);
  assert.equal(controller.isValidIpv4("abc"),false);
});

test("derivePoolRangeFromLocalAddress follows the /24 .2-.254 convention",()=>{
  const {controller}=loadController();
  assert.equal(controller.derivePoolRangeFromLocalAddress("10.82.0.1"),"10.82.0.2-10.82.0.254");
  assert.equal(controller.derivePoolRangeFromLocalAddress("10.20.0.1"),"10.20.0.2-10.20.0.254");
  assert.equal(controller.derivePoolRangeFromLocalAddress(""),null);
  assert.equal(controller.derivePoolRangeFromLocalAddress("not-an-ip"),null);
  assert.equal(controller.derivePoolRangeFromLocalAddress("10.82.0.0"),null);
  assert.equal(controller.derivePoolRangeFromLocalAddress("10.82.0.255"),null);
});

test("bulk sync: stale pool on an existing profile keeps the router value, missing pool on a new profile is created from the derived range",async()=>{
  const {controller,calls}=loadController({packages:LIVE_PACKAGES,pools:LIVE_POOLS,profiles:LIVE_PROFILES,panelPools:[]});
  const res=recorder();
  await controller.syncPanelToMikrotik({},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.created,1);
  assert.equal(res.body.updated,2);
  assert.equal(res.body.failed,0);
  const byName=new Map(res.body.results.map(x=>[x.name,x]));
  assert.equal(byName.get("45 Mbps").status,"updated");
  assert.match(byName.get("45 Mbps").warning,/PPPoE_Pool/);
  assert.match(byName.get("45 Mbps").warning,/200 Mbps/);
  assert.equal(byName.get("80 Mbps").status,"created");
  assert.match(byName.get("80 Mbps").warning,/150 Mbps/);
  assert.match(byName.get("80 Mbps").warning,/10\.82\.0\.2-10\.82\.0\.254/);
  assert.equal(byName.get("EXPIRED-PROFILE").status,"updated");
  assert.equal(byName.get("EXPIRED-PROFILE").warning,undefined);
  assert.match(res.body.message,/Notes:/);
  // 45 Mbps update must send the router's preserved pool, not the stale name.
  const update45=calls.updateProfile.find(x=>x.data.name==="45 Mbps");
  assert.ok(update45);
  assert.equal(update45.data.remoteAddress,"200 Mbps");
  // 80 Mbps pool is created first (derived /24), then the profile.
  assert.equal(calls.createIpPool.length,1);
  assert.deepEqual(calls.createIpPool[0].data,{name:"150 Mbps",ranges:"10.82.0.2-10.82.0.254",nextPool:"none"});
  const create80=calls.createProfile.find(x=>x.data.name==="80 Mbps");
  assert.ok(create80);
  assert.equal(create80.data.remoteAddress,"150 Mbps");
});

test("bulk sync: missing pool with a saved panel ip_pools record is created from the saved ranges",async()=>{
  const packages=[{plan_name:"80 Mbps",profile_name:"80 Mbps",pool_name:"150 Mbps",remote_address:"150 Mbps",local_address:"10.82.0.1",rate_limit:null,dns_server:"8.8.8.8,1.1.1.1",change_tcp_mss:"yes"}];
  const panelPools=[{name:"150 Mbps",ranges:"10.82.0.10-10.82.0.200",next_pool:"none"}];
  const {controller,calls}=loadController({packages,pools:LIVE_POOLS,profiles:[],panelPools});
  const res=recorder();
  await controller.syncPanelToMikrotik({},res);
  assert.equal(res.body.failed,0);
  assert.equal(res.body.created,1);
  assert.equal(calls.createIpPool.length,1);
  assert.deepEqual(calls.createIpPool[0].data,{name:"150 Mbps",ranges:"10.82.0.10-10.82.0.200",nextPool:"none"});
  assert.match(res.body.results[0].warning,/saved IP pool/);
});

test("bulk sync: missing pool with no panel record and no usable local address fails with a clear error",async()=>{
  const packages=[{plan_name:"80 Mbps",profile_name:"80 Mbps",pool_name:"150 Mbps",remote_address:"150 Mbps",local_address:"",rate_limit:null,dns_server:"",change_tcp_mss:"default"}];
  const {controller,calls}=loadController({packages,pools:LIVE_POOLS,profiles:[],panelPools:[]});
  const res=recorder();
  await controller.syncPanelToMikrotik({},res);
  assert.equal(res.body.failed,1);
  assert.equal(res.body.results[0].status,"failed");
  assert.match(res.body.results[0].message,/150 Mbps/);
  assert.match(res.body.results[0].message,/Create the pool in IP Pools/);
  assert.equal(calls.createIpPool.length,0);
  assert.equal(calls.createProfile.length,0);
});

test("savePlan rejects a plan whose pool does not exist on the router",async()=>{
  const {controller,calls}=loadController({pools:LIVE_POOLS,profiles:[]});
  const res=recorder();
  await controller.savePlan({body:{planName:"Test Plan",price:100,durationMonths:1,rateLimit:"",localAddress:"10.99.0.1",remoteAddress:"NoSuchPool",dnsServer:"8.8.8.8",changeTcpMss:"default"}},res);
  assert.equal(res.statusCode,400);
  assert.match(res.body.message,/NoSuchPool/);
  assert.match(res.body.message,/does not exist on the router/);
  assert.equal(calls.createProfile.length,0);
  assert.equal(calls.updateProfile.length,0);
});

test("savePlan accepts a static IPv4 remote-address and canonicalizes an existing pool name",async()=>{
  const {controller,calls}=loadController({pools:LIVE_POOLS,profiles:[]});
  const res=recorder();
  await controller.savePlan({body:{planName:"Test Plan",price:100,durationMonths:1,rateLimit:"",localAddress:"10.99.0.1",remoteAddress:"10.99.0.5",dnsServer:"8.8.8.8",changeTcpMss:"default"}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(calls.createProfile.length,1);
  assert.equal(calls.createProfile[0].data.remoteAddress,"10.99.0.5");

  const second=loadController({pools:LIVE_POOLS,profiles:[]});
  const res2=recorder();
  await second.controller.savePlan({body:{planName:"Test Plan 2",price:100,durationMonths:1,rateLimit:"",localAddress:"10.20.0.1",remoteAddress:"200 mbps",dnsServer:"8.8.8.8",changeTcpMss:"default"}},res2);
  assert.equal(res2.statusCode,200);
  assert.equal(second.calls.createProfile[0].data.remoteAddress,"200 Mbps");
});
