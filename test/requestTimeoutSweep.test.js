'use strict';
const test=require("node:test");
const assert=require("node:assert/strict");
const Module=require("node:module");
const path=require("node:path");
const fs=require("node:fs");

// "Request Timed Out" kept appearing after the pool/plan fixes because the
// FRONTEND aborted at jsonFetch's 8s default while the backend (now on a 30s
// router budget) legitimately takes longer on the slow tunnel. Every
// router-touching action therefore gets a 120s frontend timeout, and its
// backend endpoint passes the 30s handshake + 30s operation budget to the
// router. Display/list paths are never touched.
const SLOW={operationTimeoutMs:30000,handshakeTimeoutMs:30000};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// The mocked router answers after 25ms: slow enough to prove the call goes
// through the mocked router, fast enough to keep the suite quick. The real
// assertion is that the 30s budget object was passed, not the timing.
const slow=async(v)=>{await delay(25);return v;};

function recorder(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function loadModule(file,mocks){
  const resolved=path.resolve(__dirname,"../"+file);
  const original=Module._load;
  Module._load=function(request,parent,isMain){
    if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];
    return original.call(this,request,parent,isMain);
  };
  try{delete require.cache[resolved];return require(resolved);}
  finally{Module._load=original;}
}
// loadModule only mocks requires that happen at load time. The router
// device service requires its runtime lazily inside testConnection, so this
// keeps the mock installed while the call runs.
async function withMocks(mocks,fn){
  const original=Module._load;
  Module._load=function(request,parent,isMain){
    if(Object.prototype.hasOwnProperty.call(mocks,request))return mocks[request];
    return original.call(this,request,parent,isMain);
  };
  try{return await fn();}
  finally{Module._load=original;}
}

const adminEjs=fs.readFileSync(path.resolve(__dirname,"../views/admin.ejs"),"utf8");
function readSource(file){return fs.readFileSync(path.resolve(__dirname,"../"+file),"utf8");}

// Every jsonFetch call site for the given URL fragment must carry a 120s
// timeout in its options object (same line, or within the next few lines
// for the multi-line call sites).
function everyCallSiteHasTimeout(fragment){
  const starts=[];
  let from=0;
  for(;;){
    const idx=adminEjs.indexOf(fragment,from);
    if(idx===-1)break;
    starts.push(idx);
    from=idx+fragment.length;
  }
  assert.ok(starts.length>0,"no call site found for: "+fragment);
  for(const idx of starts){
    const window=adminEjs.slice(idx,idx+900);
    assert.match(window,/timeout:\s*120000/,"call site for "+fragment+" has no 120s timeout");
  }
  return starts.length;
}

test("frontend: IP pool delete passes a 120s timeout (the reported Request Timed Out)",()=>{
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/ip-pools/'+encodeURIComponent(poolName),{method:'DELETE'"),1);
  // jsonFetch still defaults to 8s for everything else; only the swept
  // actions opt into 120s.
  assert.match(adminEjs,/const timeoutMs = Number\(options\.timeout\) > 0 \? Number\(options\.timeout\) : 8000;/);
  // The abort message the user actually saw in the alert.
  assert.match(adminEjs,/message: err\.name === 'AbortError' \? 'Request Timed Out' : err\.message/);
});

test("frontend: hotspot remove/archive, profile sync/delete and voucher generate pass 120s",()=>{
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/hotspot/users/remove'"),2);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/hotspot/profiles/sync'"),1);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/hotspot/profiles/delete'"),1);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/hotspot/vouchers/generate'"),1);
  assert.equal(everyCallSiteHasTimeout("jsonFetch(endpoint,{method:'POST'"),1);
});

test("frontend: hotspot create user, manual renew and manual match pass 120s",()=>{
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/hotspot/users', {"),1);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/hotspot/manual-renew', {"),1);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/payments/manual-match', {"),1);
});

test("frontend: customer renew (all four call sites), mark-paid, kick, MAC lock/unlock, update and sync pass 120s",()=>{
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/customers/' + encodeURIComponent(id) + '/renew', {"),1);
  assert.equal(everyCallSiteHasTimeout("body:JSON.stringify({amount:price,paymentMethod:'CASH'"),1);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/customers/renew'"),1);
  assert.equal(everyCallSiteHasTimeout("btn.dataset.nocRenew)+'/renew'"),1);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/customers/mark-paid'"),1);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/customers/kick'"),1);
  assert.equal(everyCallSiteHasTimeout("'/mac-unlock'"),1);
  assert.equal(everyCallSiteHasTimeout("'/mac-lock'"),2);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/customers/update'"),2);
  assert.equal(everyCallSiteHasTimeout("'/sync-mikrotik'"),1);
});

test("frontend: PPPoE kick and toggle pass 120s",()=>{
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/pppoe/kick-user', {"),2);
  assert.equal(everyCallSiteHasTimeout("jsonFetch('/api/pppoe/toggle-user', {"),1);
});

test("frontend: both Test Connection aborts are 120s and the 15s aborts are gone",()=>{
  assert.match(adminEjs,/setTimeout\(\(\) => controller\.abort\(\), 120000\)/);
  assert.match(adminEjs,/setTimeout\(\(\)=>requestController\.abort\(\),120000\)/);
  assert.doesNotMatch(adminEjs,/abort\(\), ?15000/);
  // The add-router modal now offers a 30s handshake budget, not 5s.
  assert.match(adminEjs,/value="30000" readonly aria-readonly="true"/);
  assert.match(adminEjs,/Maximum handshake time: 30 seconds\./);
  assert.match(adminEjs,/timeout:Math\.min\(Number\(\$\('routerDeviceTimeout'\)\.value\)\|\|30000,30000\)/);
  assert.match(adminEjs,/form\.elements\.timeout\.value = String\(Math\.min\(Number\(router\.timeout_ms\) \|\| 30000, 30000\)\);/);
});

test("frontend: the already-long sync buttons were not regressed",()=>{
  assert.match(adminEjs,/jsonFetch\('\/api\/customers\/sync-panel-to-mikrotik',\{method:'POST',timeout:120000\}\)/);
  assert.match(adminEjs,/jsonFetch\('\/api\/customers\/sync-expiry-dates', \{method:'POST', timeout:90000\}\)/);
});

// ---- Backend: slow-router mocks ----

function mockMikrotik(calls){
  const mikrotik={
    async getHotspotProfiles(options){calls.getHotspotProfiles.push(options);return slow([{name:"30 Mbps",sharedUsers:"1",rateLimit:"",keepaliveTimeout:"",raw:{}}]);},
    async createHotspotProfile(data,options){calls.createHotspotProfile.push({data,options});return slow({name:data.name});},
    async updateHotspotProfile(data,options){calls.updateHotspotProfile.push({data,options});return slow({name:data.name});},
    async deleteHotspotProfile(name,options){calls.deleteHotspotProfile.push({name,options});return slow({name});},
    async getHotspotUsers(options){calls.getHotspotUsers.push(options);return slow([]);},
    async syncHotspotUsers(vouchers,options){calls.syncHotspotUsers.push({vouchers,options});return slow({provisioned:0,refreshed:0,skipped:0,disconnected:0,failed:[]});},
    async getHotspotExpirationSnapshot(options){calls.getHotspotExpirationSnapshot.push(options);return slow({users:[]});},
    async cleanupExpiredHotspotUser(username,macAddress,options){calls.cleanupExpiredHotspotUser.push({username,macAddress,options});return slow({verified:true,sessionsRemoved:1,cookiesRemoved:0,hostsRemoved:0,usersRemoved:1});},
    async getPppoeSecret(username,options){calls.getPppoeSecret.push({username,options});return slow({username,password:"pw",profile:"30 Mbps",callerId:""});},
    async createSecret(data,options){calls.createSecret.push({data,options});return slow({username:data.username});},
    async updateSecret(username,data,options){calls.updateSecret.push({username,data,options});return slow({username});},
    async updateSecretIdentity(username,data,options){calls.updateSecretIdentity.push({username,data,options});return slow({username});},
    async setSecretCallerId(username,mac,options){calls.setSecretCallerId.push({username,mac,options});return slow({username});},
    async changeSecretProfile(username,profile,options){calls.changeSecretProfile.push({username,profile,options});return slow({username});},
    async toggleSecret(username,disabled,options){calls.toggleSecret.push({username,disabled,options});return slow({username,disabled});},
    async kickActiveUser(username,options){calls.kickActiveUser.push({username,options});return slow({kicked:true,count:1});},
    async forceProvisionHotspotUser(data,options){calls.forceProvisionHotspotUser.push({data,options});return slow({macAuthEnabled:true,clearedActiveSessions:0,clearedCookies:0});},
    async rechargeHotspotUser(data,options){calls.rechargeHotspotUser.push({data,options});return slow({username:data.username});},
    async syncPanelCustomerSecrets(customers,options){calls.syncPanelCustomerSecrets.push({customers,options});return slow({results:(customers||[]).map(c=>({username:c.username,status:"updated"}))});},
    async syncPppoeExpiryComments(customers,options){calls.syncPppoeExpiryComments.push({customers,options});return slow({updated:(customers||[]).length});},
    async fetchExistingProfiles(options){calls.fetchExistingProfiles.push(options);return slow([{name:"30 Mbps"},{name:"EXPIRED-PROFILE"}]);},
    async testConnection(config,options){calls.testConnection.push({config,options});return slow({routerName:"Tp-link",boardName:"RB4011iGS+",version:"7.24.4",uptime:"2d"});},
    async close(){return;}
  };
  mikrotik.getMikroTikService=()=>mikrotik;
  return mikrotik;
}

function customerDb(fixture){
  return{async query(sql,params){
    if(/SELECT \* FROM customers WHERE LOWER\(username\)/i.test(sql))return{rows:fixture.customers||[]};
    if(/SELECT \* FROM pppoe_users WHERE LOWER\(username\)/i.test(sql))return{rows:fixture.pppoeUsers||[]};
    if(/SELECT profile_name FROM packages/i.test(sql))return{rows:fixture.packages||[]};
    if(/SELECT id,router_id FROM customers/i.test(sql))return{rows:fixture.customerIds||[]};
    return{rows:[],rowCount:1};
  }};
}

const auditLogger={logAuditAction:async()=>{},getAdminId:()=>1,getIpAddress:()=>"127.0.0.1"};
const customerReq=(body,params)=>({body:body||{},params:params||{},tenantScope:{global:true},user:{id:1},session:{userId:1}});

test("backend: PPPoE kick and toggle pass the 30s router budget",async()=>{
  const calls={toggleSecret:[],kickActiveUser:[]};
  const mikrotik=mockMikrotik(calls);
  const controller=loadModule("controllers/pppoeController.js",{
    "../db":customerDb({}),
    "../services/mikrotikService":mikrotik,
    "../utils/auditLogger":auditLogger,
    "../utils/activeSessionMatching":{normalizeUsername:v=>v,createActiveSessionMap:()=>new Map(),findActiveSession:()=>null},
    "../utils/billingStatus":{evaluateCustomerBillingStatus:()=>({})}
  });
  const kickRes=recorder();
  await controller.kickUser(customerReq({username:"user1"}),kickRes);
  assert.equal(kickRes.body.success,true);
  assert.deepEqual(calls.kickActiveUser[0].options,SLOW);
  const toggleRes=recorder();
  await controller.toggleUser(customerReq({username:"user1",disabled:true}),toggleRes);
  assert.equal(toggleRes.body.success,true);
  assert.deepEqual(calls.toggleSecret[0].options,SLOW);
});

test("backend: hotspot profile delete and profile sync pass the 30s router budget",async()=>{
  const calls={getHotspotProfiles:[],createHotspotProfile:[],updateHotspotProfile:[],deleteHotspotProfile:[],scriptSync:[]};
  const mikrotik=mockMikrotik(calls);
  const db={async query(sql){
    if(/SELECT value FROM app_settings/i.test(sql))return{rows:[{value:"{}"}]};
    return{rows:[],rowCount:1};
  }};
  const controller=loadModule("controllers/hotspotController.js",{
    "../db":db,
    "../services/mikrotikService":mikrotik,
    "../services/hotspotProfileConfig":{
      normalizeProfileValidity:(v,u)=>({value:v,unit:u,validity:"1d"}),
      parseStoredValidity:()=>({value:1,unit:"d",validity:"1d"}),
      resolveHotspotPackage:()=>null,
      buildHotspotOnLoginScript:()=>"on-login-script"
    },
    "../jobs/hotspotProfileScriptSync":{syncHotspotProfileScripts:async(opts)=>{calls.scriptSync.push(opts);return{failed:0,serverAuth:{checked:0,updated:0,skipped:0,failed:0}};}},
    "../services/resellerHotspotPackageSyncService":{syncAllPopPackages:async()=>({synced:0})},
    "../services/notificationDispatcher":{dispatchNotification:()=>({task:Promise.resolve({success:true})})},
    "../services/hotspotRenewalOperationService":{applyRouterRenewal:async()=>({})},
    "../services/hotspotVoucherGenerator":{},
    "../services/hotspotDeletionService":{deleteHotspotSubscriber:async()=>({success:true})},
    "../services/hotspotSalesCategory":{normalizeSalesCategory:v=>v,transactionCategorySql:""}
  });
  const deleteRes=recorder();
  await controller.deleteProfile(customerReq({name:"30 Mbps"}),deleteRes);
  assert.equal(deleteRes.body.success,true);
  assert.deepEqual(calls.deleteHotspotProfile[0].options,SLOW);
  const syncRes=recorder();
  await controller.syncProfiles(customerReq({}),syncRes);
  assert.equal(syncRes.statusCode,200);
  assert.equal(syncRes.body.success,true);
  assert.deepEqual(calls.getHotspotProfiles[0],SLOW);
  assert.deepEqual(calls.updateHotspotProfile[0].options,SLOW);
  assert.deepEqual(calls.scriptSync[0],{timeouts:SLOW});
});

test("backend: hotspot archive (remove) passes the 30s router budget to the purge",async()=>{
  const calls={cleanupExpiredHotspotUser:[]};
  const mikrotik=mockMikrotik(calls);
  const db={async query(sql){
    if(/FROM hotspot_vouchers/i.test(sql)&&/SELECT id,username/i.test(sql))return{rows:[{id:11,username:"AA:BB:CC:DD:EE:01",mac_address:"AA:BB:CC:DD:EE:01",last_known_mac:null,status:"active"}]};
    if(/UPDATE hotspot_vouchers/i.test(sql))return{rows:[{id:11,username:"AA:BB:CC:DD:EE:01",status:"deleted"}]};
    return{rows:[],rowCount:1};
  }};
  const controller=loadModule("controllers/hotspotUserController.js",{
    "../db":db,
    "../services/mikrotikService":mikrotik,
    "../services/hotspotDeletionService":loadModule("services/hotspotDeletionService.js",{
      "../db":db,
      "./mikrotikService":mikrotik
    })
  });
  const res=recorder();
  await controller.archive(customerReq({}, {id:"AA:BB:CC:DD:EE:01"}),res);
  assert.equal(res.body.success,true);
  assert.deepEqual(calls.cleanupExpiredHotspotUser[0].options,SLOW);
});

test("backend: customer kick, renew and mark-paid pass the 30s router budget",async()=>{
  const calls={updateSecret:[],kickActiveUser:[]};
  const mikrotik=mockMikrotik(calls);
  const fixture={
    customers:[{id:7,username:"user1",password:"pw",profile:"30 Mbps",package_name:"30 Mbps",expiration_date:"2026-12-01",billing_cycle:"monthly",monthly_bill:500,phone:"01700000000",full_name:"Test User",remarks:""}],
    pppoeUsers:[{username:"user1",password:"pw",profile:"30 Mbps",phone:"01700000000"}],
    packages:[{profile_name:"30 Mbps"}],
    customerIds:[{id:7,router_id:3}]
  };
  const controller=loadModule("controllers/customerController.js",{
    "../db":customerDb(fixture),
    "../utils/activeSessionMatching":{normalizeUsername:v=>v,createActiveSessionMap:()=>new Map(),findActiveSession:()=>null},
    "../services/mikrotikService":mikrotik,
    "../services/routerStatusProber":{getRouterStatusSnapshot:()=>({state:"online",sessions:[]})},
    "../services/resellerFinanceService":{},
    "../utils/auditLogger":auditLogger,
    "../utils/billingStatus":{evaluateCustomerBillingStatus:()=>({})},
    "../utils/macAddress":{normalizeMacAddress:v=>String(v||"").toUpperCase()},
    "../services/notificationDispatcher":{dispatchNotification:()=>({task:Promise.resolve({success:true})})}
  });
  const kickRes=recorder();
  await controller.kickActiveUserByUsername(customerReq({username:"user1"}),kickRes);
  assert.equal(kickRes.body.success,true);
  assert.deepEqual(calls.kickActiveUser[0].options,SLOW);
  const renewRes=recorder();
  await controller.renew(customerReq({username:"user1"}),renewRes);
  assert.equal(renewRes.body.success,true);
  assert.ok(renewRes.body.newExpDate);
  assert.deepEqual(calls.updateSecret[0].options,SLOW);
  assert.deepEqual(calls.kickActiveUser[1].options,SLOW);
  const paidRes=recorder();
  await controller.markPaid(customerReq({username:"user1"}),paidRes);
  assert.equal(paidRes.body.success,true);
  assert.deepEqual(calls.updateSecret[1].options,SLOW);
  assert.deepEqual(calls.kickActiveUser[2].options,SLOW);
});

test("backend: Test Connection accepts a 30s budget and passes it to the router runtime",async()=>{
  const calls=[];
  class MockRuntime{
    async testConnection(config,timeoutOptions){calls.push({config,timeoutOptions});return{routerName:"Tp-link",boardName:"RB4011iGS+",version:"7.24.4",uptime:"2d"};}
    async close(){return;}
  }
  const service=loadModule("services/routerDeviceService.js",{});
  // 30000ms must validate now (the old cap rejected anything above 5000).
  const result=await withMocks({"./mikrotikService":{MikroTikService:MockRuntime}},()=>
    service.testConnection({router_name:"Main RB4011",host:"103.54.37.182",port:1039,username:"api",password:"secret",api_type:"native_api",timeout:30000}));
  assert.equal(result.status,"online");
  assert.equal(calls.length,1);
  assert.ok(calls[0].timeoutOptions.handshakeTimeoutMs>=29000&&calls[0].timeoutOptions.handshakeTimeoutMs<=30000);
  assert.ok(calls[0].timeoutOptions.operationTimeoutMs>=29000&&calls[0].timeoutOptions.operationTimeoutMs<=30000);
  assert.ok(calls[0].config.timeout>=29000&&calls[0].config.timeout<=30000);
});

// ---- Backend source assertions: every swept router call passes the budget ----

test("backend source: customer controller passes the 30s budget on every swept action",()=>{
  const src=readSource("controllers/customerController.js");
  for(const fragment of [
    "await mikrotikService.updateSecret(username,{password:customer?.password||routerUser?.password||\"\",profile:activeProfile,comment,disabled:false},SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.kickActiveUser(username,SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.getPppoeSecret(username,SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.setSecretCallerId(username,targetMac,SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.setSecretCallerId(username,\"\",SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.changeSecretProfile(payload.customer.username,effective,SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.syncPanelCustomerSecrets(customers,SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.syncPppoeExpiryComments(eligible,SLOW_ROUTER_TIMEOUTS)",
    "await routerService.fetchExistingProfiles(SLOW_ROUTER_TIMEOUTS)",
    "await routerService.updateSecret(payload.customer.username,{password:payload.customer.password,profile:activeProfile,comment,disabled:false},SLOW_ROUTER_TIMEOUTS)",
    "await routerService.kickActiveUser(payload.customer.username,SLOW_ROUTER_TIMEOUTS)",
    "await routerService.updateSecret(row.username,{password:row.password,profile:targetProfile,remoteAddress:row.remote_address,comment,disabled:suspend},SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.testConnection(undefined,SLOW_ROUTER_TIMEOUTS)"
  ]) assert.ok(src.includes(fragment),"missing 30s budget: "+fragment);
});

test("backend source: hotspot, PPPoE, payment and deletion paths pass the 30s budget",()=>{
  const hotspot=readSource("controllers/hotspotController.js");
  for(const fragment of [
    "await mikrotikService.deleteHotspotProfile(name,SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.getHotspotProfiles(SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.getHotspotUsers(SLOW_ROUTER_TIMEOUTS)",
    "await mikrotikService.syncHotspotUsers(vouchers,SLOW_ROUTER_TIMEOUTS)",
    "await syncHotspotProfileScripts({timeouts:SLOW_ROUTER_TIMEOUTS})",
    "await hotspotRenewalOperations.applyRouterRenewal(prepared, mikrotikService, SLOW_ROUTER_TIMEOUTS)"
  ]) assert.ok(hotspot.includes(fragment),"missing 30s budget in hotspotController: "+fragment);
  const pppoe=readSource("controllers/pppoeController.js");
  assert.ok(pppoe.includes("await mikrotikService.toggleSecret(username, disabled, SLOW_ROUTER_TIMEOUTS);"));
  assert.ok(pppoe.includes("const result = await mikrotikService.kickActiveUser(username, SLOW_ROUTER_TIMEOUTS);"));
  const payment=readSource("controllers/paymentController.js");
  assert.ok(payment.includes("routerProfiles=await mikrotikService.getHotspotProfiles(SLOW_ROUTER_TIMEOUTS);"));
  assert.ok(payment.includes("},SLOW_ROUTER_TIMEOUTS);"),"force-provision must pass the budget");
  const deletion=readSource("services/hotspotDeletionService.js");
  assert.ok(deletion.includes("purge = await router.cleanupExpiredHotspotUser(username, macAddress, options);"));
  const renewal=readSource("services/hotspotRenewalOperationService.js");
  assert.ok(renewal.includes("async function applyRouterRenewal(payload, router = mikrotikService, options)"));
  const job=readSource("jobs/hotspotProfileScriptSync.js");
  assert.ok(job.includes("const timeouts = deps.timeouts;"));
  assert.ok(job.includes("await router.getHotspotProfiles(timeouts);"));
  const user=readSource("controllers/hotspotUserController.js");
  assert.ok(user.includes("deleteHotspotSubscriber({ identifier, options: SLOW_ROUTER_TIMEOUTS })"));
});

test("backend source: router test-connection path uses a 30s budget end to end",()=>{
  const service=readSource("services/routerDeviceService.js");
  assert.match(service,/const DEFAULT_TIMEOUT_MS = 30000;/);
  assert.match(service,/Timeout must be between 500 and 30000 ms\./);
  assert.match(service,/Router did not respond within 30 seconds\./);
  assert.ok(service.includes("}, { handshakeTimeoutMs: timeout, operationTimeoutMs: timeout });"));
  const controller=readSource("controllers/routerDeviceController.js");
  assert.ok(controller.includes("timeout: 30000"));
  // The service methods accept the options arg (24 methods gained it).
  const mikrotik=readSource("services/mikrotikService.js");
  assert.ok((mikrotik.match(/resolveProbeTimeouts\(options\)/g)||[]).length>=30);
});
