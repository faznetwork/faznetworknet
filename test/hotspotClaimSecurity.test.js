"use strict";
// Phase 3 (C1/C2/M14/H6): claim secret, on-network check, deviceLookup
// restriction, rate limiting + lockout, V5 bind-once script, and the
// login-page customer_name fields. MAC stays the username AND password
// (user decision 2026-11-21 23:20) — no password-scheme assertions here.
const test=require("node:test");
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const controller=require("../controllers/hotspotAuthController");
const paymentController=require("../controllers/paymentController");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const notificationDispatcher=require("../services/notificationDispatcher");
const claimOtpService=require("../services/hotspotClaimOtpService");
const rateLimit=require("../services/hotspotAuthRateLimit");
const smsService=require("../services/smsService");
const whatsappService=require("../services/whatsappService");
const {buildHotspotOnLoginScript}=require("../services/hotspotProfileConfig");
const fs=require("node:fs");
const path=require("node:path");

const MAC="AA:BB:CC:DD:EE:01";
const OTHER_MAC="AA:BB:CC:DD:EE:02";
const PHONE="01712345678";
const TXID="8A7B6C5D";
const METADATA={"30-Day":{price:150,validityValue:30,validityUnit:"days",validityLabel:"30 Days",limitBytesTotal:0}};

function response(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function resetLimits(){rateLimit.__resetForTests();}
function knownMac(row){const compact=String(row?.mac_address||row?.username||"").trim().replace(/[:-]/g,"");return /^[0-9a-f]{12}$/i.test(compact)?compact.match(/.{2}/g).join(":").toUpperCase():"";}

// ---- shared in-memory hotspot_claim_otps store (fake NOW() = otpNow) ----
let otpNow=new Date("2026-11-21T23:30:00+06:00");
let otpRows=[];
function otpQuery(sql,params){
  if(sql.includes("SET attempts=attempts+1")){
    const row=otpRows.find(x=>x.id===params[0]); if(row)row.attempts+=1; return {rows:[],rowCount:row?1:0};
  }
  if(sql.includes("UPDATE hotspot_claim_otps SET used_at=NOW() WHERE voucher_id=")){
    for(const row of otpRows)if(row.voucher_id===params[0]&&!row.used_at)row.used_at=new Date(otpNow);
    return {rows:[],rowCount:0};
  }
  if(sql.includes("SET used_at=NOW() WHERE id=")){
    const row=otpRows.find(x=>x.id===params[0]); if(row)row.used_at=new Date(otpNow); return {rows:[],rowCount:row?1:0};
  }
  if(sql.startsWith("INSERT INTO hotspot_claim_otps")){
    otpRows.push({id:"otp-"+(otpRows.length+1),phone:params[0],voucher_id:params[1],code_hash:params[2],expires_at:new Date(otpNow.getTime()+10*60*1000),attempts:0,used_at:null,created_at:new Date(otpNow)});
    return {rows:[],rowCount:1};
  }
  if(sql.includes("FROM hotspot_claim_otps WHERE voucher_id=")){
    const found=otpRows.filter(r=>r.voucher_id===params[0]&&!r.used_at&&r.expires_at>otpNow).sort((a,b)=>b.created_at-a.created_at)[0];
    return {rows:found?[{...found}]:[]};
  }
  return null;
}
function resetOtpStore(){otpNow=new Date("2026-11-21T23:30:00+06:00");otpRows=[];}

// ---- activate() fakes ----
function pendingClaimRow(overrides={}){
  return {id:101,username:"PENDING-"+PHONE,password:PHONE,profile:"30-Day",profile_id:"30-Day",validity:"30d",price:150,status:"pending_claim",comment:"",phone:PHONE,customer_name:null,server:"all",time_limit:null,data_limit:null,mac_address:null,first_login_at:null,expires_at:null,transaction_id:9001,renewal_stacked:false,subscriber_type:"direct_subscriber",activation_type:"online_mfs",mac_lock:false,...overrides};
}
function activeBoundRow(overrides={}){
  const now=Date.now();
  return {id:102,username:MAC,password:MAC,profile:"30-Day",profile_id:"30-Day",validity:"30d",price:150,status:"active",comment:"Exp: 2030-01-02 03:04:05",phone:PHONE,customer_name:"Karim",server:"all",time_limit:null,data_limit:null,mac_address:MAC,first_login_at:new Date(now-24*3600*1000),expires_at:new Date(now+29*24*3600*1000),transaction_id:9001,renewal_stacked:false,subscriber_type:"direct_subscriber",activation_type:"online_mfs",mac_lock:false,...overrides};
}
function installActivateFakes({row,txRow,onNetwork}){
  const queries=[],routerCalls=[];
  const originalQuery=db.query,originalTransaction=db.withTransaction;
  const originalProfiles=mikrotik.getHotspotProfiles,originalOnNetwork=mikrotik.isDeviceOnNetwork;
  const originalRecharge=mikrotik.rechargeHotspotUser,originalGetUser=mikrotik.getHotspotUser;
  const originalCreate=mikrotik.createHotspotUser,originalUpdate=mikrotik.updateHotspotUser;
  const originalNotify=notificationDispatcher.dispatchNotification;
  const notifications=[];
  notificationDispatcher.dispatchNotification=(payload)=>{notifications.push(payload);};
  mikrotik.getHotspotProfiles=async()=>[{name:"30-Day",sessionTimeout:"30d"}];
  mikrotik.isDeviceOnNetwork=async()=>{routerCalls.push({method:"isDeviceOnNetwork"});return onNetwork!==false;};
  mikrotik.rechargeHotspotUser=async(data)=>{routerCalls.push({method:"rechargeHotspotUser",data});return {username:data.username};};
  mikrotik.getHotspotUser=async()=>({username:MAC,password:MAC,profile:"30-Day",comment:"Exp: 2030-01-02 03:04:05",raw:{"mac-address":MAC}});
  mikrotik.createHotspotUser=async(data)=>{routerCalls.push({method:"createHotspotUser",data});return {username:data.username};};
  mikrotik.updateHotspotUser=async()=>{routerCalls.push({method:"updateHotspotUser"});return {username:MAC};};
  db.query=async(sql,params=[])=>{
    queries.push({sql,params,scope:"pool"});
    const otp=otpQuery(sql,params); if(otp)return otp;
    if(sql.includes("FROM app_settings"))return {rows:[{value:JSON.stringify(METADATA)}]};
    if(sql.startsWith("SELECT mac_address,username,status FROM hotspot_vouchers")){
      const callerMac=String(params[0]||"").toUpperCase();
      return {rows:row&&knownMac(row)===callerMac&&["pending_claim","active","unused"].includes(String(row.status||"").toLowerCase())?[row]:[]};
    }
    if(sql.startsWith("UPDATE hotspot_vouchers SET status='active'"))return {rows:[{id:row.id,username:MAC,status:"active",first_login_at:new Date(),expires_at:new Date(Date.now()+30*24*3600*1000),transaction_id:row.transaction_id}]};
    throw new Error("Unexpected pool query: "+sql);
  };
  db.withTransaction=async(callback)=>callback({query:async(sql,params=[])=>{
    queries.push({sql,params,scope:"transaction"});
    const otp=otpQuery(sql,params); if(otp)return otp;
    if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
    if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:row?[row]:[]};
    if(sql.startsWith("SELECT id,status FROM transactions"))return {rows:txRow?[txRow]:[]};
    if(sql.startsWith("UPDATE hotspot_vouchers SET mac_address=$1")){
      const locked={...row,mac_address:params[0],first_login_at:params[1],expires_at:params[2],comment:params[3],phone:params[4],customer_name:params[6]||row.customer_name||null};
      return {rows:[locked]};
    }
    throw new Error("Unexpected transactional query: "+sql);
  }});
  return {queries,routerCalls,notifications,restore(){
    db.query=originalQuery;db.withTransaction=originalTransaction;
    mikrotik.getHotspotProfiles=originalProfiles;mikrotik.isDeviceOnNetwork=originalOnNetwork;
    mikrotik.rechargeHotspotUser=originalRecharge;mikrotik.getHotspotUser=originalGetUser;
    mikrotik.createHotspotUser=originalCreate;mikrotik.updateHotspotUser=originalUpdate;
    notificationDispatcher.dispatchNotification=originalNotify;
  }};
}

test("C1: pending_claim + phone + attacker MAC + no secret -> 403, no bind, no router call",async()=>{
  resetLimits();resetOtpStore();
  const fakes=installActivateFakes({row:pendingClaimRow(),txRow:{id:9001,status:"processed"}});
  try{
    const res=response();
    await controller.activate({ip:"10.0.0.11",body:{phone:PHONE,mac:OTHER_MAC}},res);
    assert.equal(res.statusCode,403);
    assert.equal(res.body.code,"CLAIM_SECRET_REQUIRED");
    assert.equal(fakes.queries.some(q=>q.sql.startsWith("UPDATE hotspot_vouchers SET mac_address=$1")),false,"no binding UPDATE may run");
    assert.equal(fakes.routerCalls.some(c=>c.method==="rechargeHotspotUser"),false,"no router call may run");
  }finally{fakes.restore();}
});

test("C1: pending_claim + correct TrxID activates and binds the MAC (and stores customer_name only when empty)",async()=>{
  resetLimits();resetOtpStore();
  const fakes=installActivateFakes({row:pendingClaimRow(),txRow:{id:9001,status:"processed"}});
  try{
    const res=response();
    await controller.activate({ip:"10.0.0.12",body:{phone:PHONE,mac:OTHER_MAC,trxId:TXID,customer_name:"Rahim Uddin"}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(res.body.username,OTHER_MAC);
    assert.equal(res.body.password,OTHER_MAC,"MAC stays the password");
    const bind=fakes.queries.find(q=>q.sql.startsWith("UPDATE hotspot_vouchers SET mac_address=$1"));
    assert.ok(bind,"binding UPDATE must run");
    assert.equal(bind.params[0],OTHER_MAC);
    assert.match(bind.sql,/customer_name=COALESCE\(NULLIF\(customer_name,''\),NULLIF\(\$7::text,''\)\)/);
    assert.equal(bind.params[6],"Rahim Uddin");
    assert.equal(fakes.routerCalls.some(c=>c.method==="rechargeHotspotUser"),true);
    assert.equal(fakes.routerCalls.some(c=>c.method==="isDeviceOnNetwork"),false,"the claim path skips the on-network check (TrxID is the proof)");
  }finally{fakes.restore();}
});

test("C1: pending_claim + wrong TrxID -> 403, and 5 wrong secrets lock the phone for 15 minutes",async()=>{
  resetLimits();resetOtpStore();
  const fakes=installActivateFakes({row:pendingClaimRow(),txRow:{id:9999,status:"processed"}});
  try{
    for(let i=0;i<5;i++){
      const res=response();
      await controller.activate({ip:"10.0.0.13",body:{phone:PHONE,mac:OTHER_MAC,trxId:"WRONG"+i}},res);
      assert.equal(res.statusCode,403);
      assert.equal(res.body.code,"CLAIM_SECRET_INVALID");
    }
    const locked=response();
    await controller.activate({ip:"10.0.0.13",body:{phone:PHONE,mac:OTHER_MAC,trxId:TXID}},locked);
    assert.equal(locked.statusCode,429);
    assert.equal(locked.body.code,"PHONE_LOCKED");
    assert.equal(fakes.queries.some(q=>q.sql.startsWith("UPDATE hotspot_vouchers SET mac_address=$1")),false,"a locked phone must never bind");
  }finally{fakes.restore();}
});

test("C1: OTP request stores only the hash, the code activates, reuse fails, an expired code fails",async()=>{
  resetLimits();resetOtpStore();
  const sentSms=[],sentWa=[];
  const originalSms=smsService.sendSms,originalWa=whatsappService.sendMessage;
  smsService.sendSms=async(payload)=>{sentSms.push(payload);return {success:true,skipped:false};};
  whatsappService.sendMessage=async(payload)=>{sentWa.push(payload);return {success:true};};
  const fakes=installActivateFakes({row:pendingClaimRow(),txRow:{id:9001,status:"processed"}});
  try{
    // request-claim-otp: generic response, no oracle
    const otpRes=response();
    const originalQuery=db.query;
    db.query=async(sql,params=[])=>{
      if(sql.includes("FROM hotspot_vouchers WHERE REGEXP_REPLACE"))return {rows:[pendingClaimRow()]};
      const otp=otpQuery(sql,params); if(otp)return otp;
      return originalQuery(sql,params);
    };
    try{await controller.requestClaimOtp({ip:"10.0.0.14",body:{phone:PHONE}},otpRes);}finally{db.query=originalQuery;}
    assert.equal(otpRes.statusCode,200);
    assert.equal(otpRes.body.success,true);
    assert.equal(sentSms.length,1,"SMS is tried first");
    assert.equal(sentWa.length,0,"WhatsApp is only a fallback");
    const code=String(sentSms[0].message||"").match(/(\d{6})/)?.[1];
    assert.ok(code,"the SMS must carry a 6-digit code");
    assert.equal(otpRows.length,1);
    assert.notEqual(otpRows[0].code_hash,code,"only the hash is stored, never the code");
    assert.equal(otpRows[0].code_hash,crypto.createHash("sha256").update(code).digest("hex"));
    // correct code activates
    const ok=response();
    await controller.activate({ip:"10.0.0.15",body:{phone:PHONE,mac:OTHER_MAC,otp:code}},ok);
    assert.equal(ok.statusCode,200);
    assert.equal(ok.body.success,true);
    // reuse of the same code fails
    const reuse=response();
    await controller.activate({ip:"10.0.0.16",body:{phone:PHONE,mac:OTHER_MAC,otp:code}},reuse);
    assert.equal(reuse.statusCode,403);
    assert.equal(reuse.body.code,"OTP_NOT_FOUND_OR_EXPIRED");
    // an expired code fails
    resetLimits();
    const otpRes2=response();
    const originalQuery2=db.query;
    db.query=async(sql,params=[])=>{
      if(sql.includes("FROM hotspot_vouchers WHERE REGEXP_REPLACE"))return {rows:[pendingClaimRow()]};
      const otp=otpQuery(sql,params); if(otp)return otp;
      return originalQuery2(sql,params);
    };
    try{await controller.requestClaimOtp({ip:"10.0.0.17",body:{phone:PHONE}},otpRes2);}finally{db.query=originalQuery2;}
    const code2=String(sentSms[1].message||"").match(/(\d{6})/)?.[1];
    otpNow=new Date(otpNow.getTime()+11*60*1000); // past the 10-minute TTL
    const expired=response();
    await controller.activate({ip:"10.0.0.18",body:{phone:PHONE,mac:OTHER_MAC,otp:code2}},expired);
    assert.equal(expired.statusCode,403);
    assert.equal(expired.body.code,"OTP_NOT_FOUND_OR_EXPIRED");
  }finally{smsService.sendSms=originalSms;whatsappService.sendMessage=originalWa;fakes.restore();}
});

test("C1/OTP service: 5 wrong codes lock the OTP; SMS skipped falls back to WhatsApp",async()=>{
  resetOtpStore();
  const sentSms=[],sentWa=[];
  const fakeDb={query:async(sql,params=[])=>{const otp=otpQuery(sql,params);if(otp)return otp;throw new Error("Unexpected OTP query: "+sql);}};
  const svc=claimOtpService.createHotspotClaimOtpService({db:fakeDb,smsService:{sendSms:async(payload)=>{sentSms.push(payload);return {success:true,skipped:true};}},whatsappService:{sendMessage:async(payload)=>{sentWa.push(payload);return {success:true};}}});
  const requested=await svc.requestClaimOtp({phone:PHONE,voucherId:101});
  assert.equal(requested.sent,true);
  assert.deepEqual(requested.channels,["whatsapp"]);
  const code=String(sentWa[0].message||"").match(/(\d{6})/)?.[1];
  for(let i=0;i<5;i++){
    const wrong=await svc.verifyClaimOtp({phone:PHONE,voucherId:101,code:"000000"});
    assert.equal(wrong.ok,false);
    assert.equal(wrong.code,"OTP_INVALID");
  }
  const locked=await svc.verifyClaimOtp({phone:PHONE,voucherId:101,code});
  assert.equal(locked.ok,false);
  assert.equal(locked.code,"OTP_LOCKED");
});

test("C2: bound active account + correct MAC + no secret activates (no claim secret needed)",async()=>{
  resetLimits();resetOtpStore();
  const fakes=installActivateFakes({row:activeBoundRow(),txRow:{id:9001,status:"processed"},onNetwork:true});
  try{
    const res=response();
    await controller.activate({ip:"10.0.0.19",body:{phone:PHONE,mac:MAC}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(fakes.routerCalls.some(c=>c.method==="isDeviceOnNetwork"),true,"a returning bound login must pass the on-network check");
  }finally{fakes.restore();}
});

test("C2: bound active account + different MAC -> MAC_MISMATCH; off-network bound login -> MAC_NOT_ON_NETWORK",async()=>{
  resetLimits();resetOtpStore();
  const fakes=installActivateFakes({row:activeBoundRow(),txRow:{id:9001,status:"processed"},onNetwork:true});
  try{
    const mismatch=response();
    await controller.activate({ip:"10.0.0.20",body:{phone:PHONE,mac:OTHER_MAC}},mismatch);
    assert.equal(mismatch.statusCode,403);
    assert.equal(mismatch.body.code,"MAC_MISMATCH");
  }finally{fakes.restore();}
  const offline=installActivateFakes({row:activeBoundRow(),txRow:{id:9001,status:"processed"},onNetwork:false});
  try{
    resetLimits();
    const res=response();
    await controller.activate({ip:"10.0.0.21",body:{phone:PHONE,mac:MAC}},res);
    assert.equal(res.statusCode,403);
    assert.equal(res.body.code,"MAC_NOT_ON_NETWORK");
    assert.equal(offline.queries.some(q=>q.sql.startsWith("UPDATE hotspot_vouchers SET mac_address=$1")),false);
  }finally{offline.restore();}
});

test("C2/mac_lock: a locked account refuses a MAC change even with a valid claim secret",async()=>{
  resetLimits();resetOtpStore();
  const fakes=installActivateFakes({row:pendingClaimRow({mac_lock:true}),txRow:{id:9001,status:"processed"}});
  try{
    const res=response();
    await controller.activate({ip:"10.0.0.22",body:{phone:PHONE,mac:OTHER_MAC,trxId:TXID}},res);
    assert.equal(res.statusCode,403);
    assert.equal(res.body.code,"MAC_LOCKED");
  }finally{fakes.restore();}
});

test("M14: deviceLookup returns no profile/expiry/username/phone and performs no writes",async()=>{
  resetLimits();
  const queries=[];
  const originalQuery=db.query;
  const originalDisable=mikrotik.disableExpiredDirectHotspotUser;
  let disableCalls=0;
  mikrotik.disableExpiredDirectHotspotUser=async()=>{disableCalls++;return {};};
  const expiredRow={...activeBoundRow(),status:"expired",expires_at:new Date(Date.now()-3600*1000)};
  db.query=async(sql,params=[])=>{
    queries.push({sql,params});
    if(sql.includes("FROM hotspot_vouchers"))return {rows:[expiredRow]};
    throw new Error("Unexpected deviceLookup query: "+sql);
  };
  try{
    const res=response();
    await controller.deviceLookup({ip:"10.0.0.23",body:{mac:MAC,phone:PHONE}},res);
    assert.equal(res.statusCode,200);
    assert.deepEqual(Object.keys(res.body).sort(),["can_recharge","found","requires_claim_secret","status","success"]);
    assert.equal(res.body.found,true);
    assert.equal(res.body.status,"expired");
    assert.equal(res.body.can_recharge,true);
    assert.equal(queries.some(q=>/^\s*(UPDATE|INSERT|DELETE)\b/i.test(q.sql)),false,"an unauthenticated lookup must be a pure read");
    assert.equal(disableCalls,0,"an unauthenticated lookup must not touch the router");
    const missing=response();
    db.query=async()=>({rows:[]});
    await controller.deviceLookup({ip:"10.0.0.24",body:{mac:OTHER_MAC}},missing);
    assert.deepEqual(missing.body,{success:true,found:false,status:null,requires_claim_secret:false,can_recharge:false});
  }finally{db.query=originalQuery;mikrotik.disableExpiredDirectHotspotUser=originalDisable;}
});

test("H6: 6th failed PIN attempt locks that PIN for 15 minutes; another PIN is unaffected",async()=>{
  resetLimits();
  const originalTransaction=db.withTransaction,originalOnNetwork=mikrotik.isDeviceOnNetwork;
  mikrotik.isDeviceOnNetwork=async()=>true;
  db.withTransaction=async(callback)=>callback({query:async(sql)=>{
    if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
    if(sql.startsWith("SELECT id,username,password,status,mac_address,expires_at,comment,profile,price,phone,subscriber_type,activation_type FROM hotspot_vouchers"))return {rows:[]};
    throw new Error("Unexpected claim query: "+sql);
  }});
  try{
    for(let i=0;i<5;i++){
      const res=response();
      await controller.claimVoucher({ip:"10.0.0.25",body:{voucher_code:"PIN1234",voucher_password:"secret12",mac:MAC}},res);
      assert.equal(res.statusCode,400);
      assert.equal(res.body.code,"VOUCHER_INVALID");
    }
    const locked=response();
    await controller.claimVoucher({ip:"10.0.0.25",body:{voucher_code:"PIN1234",voucher_password:"secret12",mac:MAC}},locked);
    assert.equal(locked.statusCode,429);
    assert.equal(locked.body.code,"PIN_LOCKED");
    const other=response();
    await controller.claimVoucher({ip:"10.0.0.25",body:{voucher_code:"PIN9999",voucher_password:"secret12",mac:MAC}},other);
    assert.equal(other.statusCode,400);
    assert.equal(other.body.code,"VOUCHER_INVALID");
  }finally{db.withTransaction=originalTransaction;mikrotik.isDeviceOnNetwork=originalOnNetwork;}
});

test("H6: shared limiter buckets expire and locks clear",async()=>{
  let now=1000000;
  const limiter=rateLimit.createHotspotAuthRateLimit({now:()=>now});
  for(let i=0;i<12;i++)assert.equal(limiter.checkLimit({keys:["ip:1.2.3.4"],limit:12,windowMs:60000}).allowed,true);
  assert.equal(limiter.checkLimit({keys:["ip:1.2.3.4"],limit:12,windowMs:60000}).allowed,false);
  now+=61000;
  assert.equal(limiter.checkLimit({keys:["ip:1.2.3.4"],limit:12,windowMs:60000}).allowed,true,"the bucket must expire after its window");
  for(let i=0;i<5;i++)limiter.recordFailure("pin:ABC",{maxFailures:5,lockMs:15*60*1000});
  assert.equal(limiter.isLocked("pin:ABC"),true);
  assert.equal(limiter.isLocked("pin:XYZ"),false);
  now+=16*60*1000;
  assert.equal(limiter.isLocked("pin:ABC"),false,"the lock must expire");
});

test("V5: buildHotspotOnLoginScript binds only when the router user has no MAC yet",()=>{
  const script=buildHotspotOnLoginScript({validityValue:30,validityUnit:"days",sharedUsers:1});
  assert.match(script,/FAZ_HOTSPOT_SESSION_BINDING_V5/);
  assert.match(script,/\/ip hotspot user get \$uid mac-address/);
  assert.match(script,/\$curMac = ""/);
  assert.match(script,/\/ip hotspot user set \$uid mac-address=\$uMac/);
  const shared=buildHotspotOnLoginScript({validityValue:30,validityUnit:"days",sharedUsers:2});
  assert.match(shared,/FAZ_HOTSPOT_SESSION_BINDING_V5/);
  assert.doesNotMatch(shared,/mac-address=\$uMac/,"a shared profile must not bind at all");
});

test("C2: isDeviceOnNetwork finds the MAC in bridge/host/active sources and fails closed",async()=>{
  // NOTE: the service module exports a Proxy whose un-stubbed methods
  // resolve the active router from the DB; test the class directly.
  const {MikroTikService}=require("../services/mikrotikService");
  const direct=new MikroTikService();
  const original=direct._withConnection;
  const run=async(bridge,hosts,active)=>{
    direct._withConnection=async(_label,fn)=>fn({write:async(command)=>{
      if(command==="/interface/bridge/host/print")return bridge;
      if(command==="/ip/hotspot/host/print")return hosts;
      if(command==="/ip/hotspot/active/print")return active;
      return [];
    }});
    return direct.isDeviceOnNetwork(MAC);
  };
  try{
    assert.equal(await run([{"mac-address":MAC}],[],[]),true,"bridge hosts");
    assert.equal(await run([],[{address:"10.71.0.5","mac-address":MAC}],[]),true,"hotspot hosts");
    assert.equal(await run([],[],[{".id":"*1",user:MAC,"mac-address":MAC}]),true,"active sessions");
    assert.equal(await run([],[],[]),false,"absent everywhere");
    direct._withConnection=async(_label,fn)=>fn({write:async(command)=>{
      if(command==="/interface/bridge/host/print")throw new Error("router down");
      return [];
    }});
    await assert.rejects(()=>direct.isDeviceOnNetwork(MAC),/router down/,"a router error must throw, never guess absent");
  }finally{direct._withConnection=original;}
});

test("Portal: recharge + existing-login forms send phone/name, claim-code UI exists, blank login stays optional",()=>{
  const portal=fs.readFileSync(path.join(__dirname,"..","views","portal.ejs"),"utf8");
  assert.ok(portal.includes('id="customer-name"'),"recharge form needs an optional Name field");
  assert.ok(portal.includes('id="existing-phone"'),"existing login needs an optional Phone field");
  assert.ok(portal.includes('id="existing-name"'),"existing login needs an optional Name field");
  assert.ok(portal.includes('id="existing-login-form"'),"existing login must be an expanding form");
  assert.ok(portal.includes("customer_name"),"the portal must send customer_name");
  assert.ok(portal.includes("/api/hotspot-auth/request-claim-otp"),"the portal must offer the claim-code fallback");
  assert.ok(portal.includes('id="claim-code"'),"the portal must have a claim-code input");
  const nameInput=portal.match(/<input id="customer-name"[^>]*>/)[0];
  assert.doesNotMatch(nameInput,/required/,"the Name field must stay optional");
  const phoneInput=portal.match(/<input id="existing-phone"[^>]*>/)[0];
  assert.doesNotMatch(phoneInput,/required/,"the existing-login Phone field must stay optional");
  assert.ok(portal.includes("trxId:data.claim_trx_id||trxId"),"activate must carry the TrxID from the verify response");
});

test("verifyTrx stores a provided customer_name on INSERT and never overwrites on UPDATE",async()=>{
  const queries=[];
  const originalQuery=db.query,originalTransaction=db.withTransaction;
  const originalProfiles=mikrotik.getHotspotProfiles,originalRecharge=mikrotik.rechargeHotspotUser;
  const originalDispatchNow=notificationDispatcher.dispatchNow,originalNotify=notificationDispatcher.dispatchNotification;
  notificationDispatcher.dispatchNow=async()=>({success:true,results:[]});
  notificationDispatcher.dispatchNotification=()=>{};
  mikrotik.getHotspotProfiles=async()=>[{name:"30-Day",sessionTimeout:"30d"}];
  mikrotik.rechargeHotspotUser=async(data)=>({username:data.username});
  const txRow={id:9001,trx_id:TXID,status:"unmatched",amount:150,channel:"bkash",used:false};
  function install({existing}){
    queries.length=0;
    db.query=async(sql,params=[])=>{
      queries.push({sql,params,scope:"pool"});
      if(sql.startsWith("SELECT * FROM transactions"))return {rows:[txRow]};
      if(sql.includes("FROM app_settings"))return {rows:[{value:JSON.stringify(METADATA)}]};
      if(sql.startsWith("UPDATE transactions SET status='processing'"))return {rows:[{id:9001}]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1,password=$1,mac_address=$1,status='active'"))return {rows:[{id:existing?existing.id:201,username:MAC,status:"active",expires_at:new Date(Date.now()+30*24*3600*1000)}]};
      throw new Error("Unexpected verifyTrx pool query: "+sql);
    };
    db.withTransaction=async(callback)=>callback({query:async(sql,params=[])=>{
      queries.push({sql,params,scope:"transaction"});
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:existing?[existing]:[]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1::text")){
        return {rows:[{id:existing.id,username:MAC,profile:"30-Day",server:"all"}]};
      }
      if(sql.startsWith("INSERT INTO hotspot_vouchers")){
        return {rows:[{id:201,username:MAC,profile:"30-Day",server:"all"}]};
      }
      if(sql.startsWith("INSERT INTO hotspot_voucher_payments"))return {rows:[]};
      if(sql.startsWith("UPDATE transactions SET status='processed'"))return {rows:[{id:9001}]};
      throw new Error("Unexpected verifyTrx transactional query: "+sql);
    }});
  }
  try{
    // INSERT path: a provided name is stored on the new row.
    install({existing:null});
    const insertRes=response();
    await paymentController.verifyTrx({ip:"10.0.0.30",body:{service_type:"hotspot",phone:PHONE,account_phone:PHONE,customer_name:"Rahim Uddin",trxId:TXID,amount:150,package_id:"30-Day",profile_id:"30-Day",mac:MAC}},insertRes);
    assert.equal(insertRes.statusCode,200);
    assert.equal(insertRes.body.success,true);
    assert.equal(insertRes.body.claim_trx_id,TXID,"verifyTrx must return the TrxID for the claim step");
    const insert=queries.find(q=>q.sql.startsWith("INSERT INTO hotspot_vouchers"));
    assert.ok(insert,"a new voucher must be inserted");
    assert.ok(insert.sql.includes("customer_name"),"the INSERT must carry customer_name");
    assert.equal(insert.params[insert.params.length-1],"Rahim Uddin");
    // UPDATE path: the same name is passed, but the SQL must keep an
    // existing name (COALESCE guard) instead of overwriting it.
    install({existing:{...pendingClaimRow(),id:101,customer_name:"Karim"}});
    const updateRes=response();
    await paymentController.verifyTrx({ip:"10.0.0.31",body:{service_type:"hotspot",phone:PHONE,account_phone:PHONE,customer_name:"Rahim Uddin",trxId:TXID,amount:150,package_id:"30-Day",profile_id:"30-Day",mac:MAC}},updateRes);
    assert.equal(updateRes.statusCode,200);
    assert.equal(updateRes.body.claim_trx_id,TXID);
    const update=queries.find(q=>q.sql.startsWith("UPDATE hotspot_vouchers SET username=$1::text"));
    assert.ok(update,"an existing voucher must be updated");
    assert.match(update.sql,/customer_name=COALESCE\(NULLIF\(customer_name,''\),NULLIF\(\$17::text,''\)\)/,"the UPDATE must never overwrite an existing name");
    assert.equal(update.params[16],"Rahim Uddin");
  }finally{
    db.query=originalQuery;db.withTransaction=originalTransaction;
    mikrotik.getHotspotProfiles=originalProfiles;mikrotik.rechargeHotspotUser=originalRecharge;
    notificationDispatcher.dispatchNow=originalDispatchNow;notificationDispatcher.dispatchNotification=originalNotify;
  }
});

// ---- Phase 4: optional Phone + Name on every login form ----
// claimVoucher must pass a provided phone/name through to activate()
// (which stores them fill-if-empty) instead of overwriting phone with "".
function scratchRow(overrides={}){
  return {id:201,username:"PIN7777",password:"secret12",status:"unused",mac_address:null,expires_at:null,comment:"",profile:"30-Day",price:150,phone:"Unlinked",subscriber_type:"legacy",activation_type:"scratch_card",customer_name:null,...overrides};
}
function installClaimVoucherFakes({row}){
  const queries=[],routerCalls=[];
  const originalQuery=db.query,originalTransaction=db.withTransaction;
  const originalOnNetwork=mikrotik.isDeviceOnNetwork,originalProfiles=mikrotik.getHotspotProfiles;
  const originalRecharge=mikrotik.rechargeHotspotUser,originalNotify=notificationDispatcher.dispatchNotification;
  const boundRow={...row,mac_address:MAC};
  mikrotik.isDeviceOnNetwork=async()=>{routerCalls.push({method:"isDeviceOnNetwork"});return true;};
  mikrotik.getHotspotProfiles=async()=>[{name:"30-Day",sessionTimeout:"30d"}];
  mikrotik.rechargeHotspotUser=async(data)=>{routerCalls.push({method:"rechargeHotspotUser",data});return {username:data.username};};
  notificationDispatcher.dispatchNotification=()=>{};
  db.query=async(sql,params=[])=>{
    queries.push({sql,params,scope:"pool"});
    if(sql.includes("FROM app_settings"))return {rows:[{value:JSON.stringify(METADATA)}]};
    if(sql.startsWith("UPDATE hotspot_vouchers SET status='active'"))return {rows:[{id:row.id,username:MAC,status:"active",first_login_at:new Date(),expires_at:new Date(Date.now()+30*24*3600*1000),transaction_id:9001}]};
    if(sql.startsWith("INSERT INTO transactions"))return {rows:[{id:777}]};
    if(sql.startsWith("INSERT INTO hotspot_voucher_payments"))return {rows:[]};
    throw new Error("Unexpected claimVoucher pool query: "+sql);
  };
  db.withTransaction=async(callback)=>callback({query:async(sql,params=[])=>{
    queries.push({sql,params,scope:"transaction"});
    if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
    if(sql.startsWith("SELECT id,username,password,status,mac_address,expires_at,comment,profile,price,phone,subscriber_type,activation_type FROM hotspot_vouchers")){
      return {rows:params[0]===row.username&&params[1]===row.password?[row]:[]};
    }
    if(sql.startsWith("SELECT id,status,expires_at,comment FROM hotspot_vouchers"))return {rows:[]};
    if(sql.startsWith("UPDATE hotspot_vouchers SET mac_address=$1::text,updated_at=NOW()"))return {rows:[],rowCount:1};
    if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[boundRow]};
    if(sql.includes("first_login_at=COALESCE(first_login_at,$2::timestamptz)")){
      const locked={...boundRow,mac_address:params[0],first_login_at:params[1],expires_at:params[2],comment:params[3],phone:(boundRow.phone&&boundRow.phone!=="Unlinked")?boundRow.phone:(params[4]||"Unlinked"),customer_name:boundRow.customer_name||params[6]||null};
      return {rows:[locked]};
    }
    throw new Error("Unexpected claimVoucher transactional query: "+sql);
  }});
  return {queries,routerCalls,restore(){
    db.query=originalQuery;db.withTransaction=originalTransaction;
    mikrotik.isDeviceOnNetwork=originalOnNetwork;mikrotik.getHotspotProfiles=originalProfiles;
    mikrotik.rechargeHotspotUser=originalRecharge;notificationDispatcher.dispatchNotification=originalNotify;
  }};
}

test("P4: claimVoucher passes a provided phone + customer_name through to activate() and the sales audit",async()=>{
  resetLimits();
  const row=scratchRow();
  const fakes=installClaimVoucherFakes({row});
  try{
    const res=response();
    await controller.claimVoucher({ip:"10.0.0.40",body:{voucher_code:"PIN7777",voucher_password:"secret12",mac:MAC,phone:"01811111111",customer_name:"Rahim Uddin"}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(res.body.username,MAC,"MAC stays the username");
    const reservation=fakes.queries.find(q=>q.sql.includes("first_login_at=COALESCE(first_login_at,$2::timestamptz)"));
    assert.ok(reservation,"activate must run its reservation UPDATE");
    assert.equal(reservation.params[4],"01811111111","activate must receive the provided phone, not phone: \"\"");
    assert.equal(reservation.params[6],"Rahim Uddin","activate must receive the provided customer_name");
    const txInsert=fakes.queries.find(q=>q.sql.startsWith("INSERT INTO transactions"));
    assert.ok(txInsert,"the first-use sales audit must run");
    assert.equal(txInsert.params[1],"01811111111","audit sender_phone uses the provided phone when the row has none");
    const payInsert=fakes.queries.find(q=>q.sql.startsWith("INSERT INTO hotspot_voucher_payments"));
    assert.ok(payInsert,"the voucher payment audit must run");
    assert.equal(payInsert.params[2],"01811111111","audit phone uses the provided phone when the row has none");
  }finally{fakes.restore();}
});

test("P4: claimVoucher with an entered-but-invalid phone -> 400 INVALID_ACCOUNT_PHONE, no DB bind, no router call",async()=>{
  resetLimits();
  let transactionCalls=0,onNetworkCalls=0;
  const originalTransaction=db.withTransaction,originalOnNetwork=mikrotik.isDeviceOnNetwork;
  db.withTransaction=async()=>{transactionCalls++;throw new Error("withTransaction must not run for an invalid phone");};
  mikrotik.isDeviceOnNetwork=async()=>{onNetworkCalls++;return true;};
  try{
    const res=response();
    await controller.claimVoucher({ip:"10.0.0.42",body:{voucher_code:"PIN9999",voucher_password:"secret12",mac:MAC,phone:"12345"}},res);
    assert.equal(res.statusCode,400);
    assert.equal(res.body.code,"INVALID_ACCOUNT_PHONE");
    assert.equal(transactionCalls,0,"an invalid phone must fail before any DB bind");
    assert.equal(onNetworkCalls,0,"an invalid phone must fail before any router call");
  }finally{db.withTransaction=originalTransaction;mikrotik.isDeviceOnNetwork=originalOnNetwork;}
});

test("P4: claimVoucher with blank phone/name still claims exactly as before",async()=>{
  resetLimits();
  const row=scratchRow({username:"PIN8888"});
  const fakes=installClaimVoucherFakes({row});
  try{
    const res=response();
    await controller.claimVoucher({ip:"10.0.0.41",body:{voucher_code:"PIN8888",voucher_password:"secret12",mac:MAC}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    const reservation=fakes.queries.find(q=>q.sql.includes("first_login_at=COALESCE(first_login_at,$2::timestamptz)"));
    assert.ok(reservation,"activate must run its reservation UPDATE");
    assert.equal(reservation.params[4],"","blank phone passes through as empty, never a guess");
    assert.equal(reservation.params[6],"","blank name passes through as empty");
    const txInsert=fakes.queries.find(q=>q.sql.startsWith("INSERT INTO transactions"));
    assert.equal(txInsert.params[1],null,"audit sender_phone stays null when no phone was given");
    const payInsert=fakes.queries.find(q=>q.sql.startsWith("INSERT INTO hotspot_voucher_payments"));
    assert.equal(payInsert.params[2],"Unlinked","audit phone stays Unlinked when no phone was given");
  }finally{fakes.restore();}
});

test("P4: portal voucher PIN form + always-visible existing login (no toggle, no hidden)",()=>{
  const portal=fs.readFileSync(path.join(__dirname,"..","views","portal.ejs"),"utf8");
  for(const id of ["voucher-pin","voucher-password","voucher-phone","voucher-name"])assert.ok(portal.includes(`id="${id}"`),`voucher claim form needs ${id}`);
  assert.ok(portal.includes('id="voucher-claim-submit"'),"voucher claim form needs a submit button");
  assert.ok(portal.includes("submitVoucherClaim"),"the portal must wire the voucher claim submit handler");
  assert.ok(portal.includes('id="existing-phone"'),"existing login needs an optional Phone field");
  assert.ok(portal.includes('id="existing-name"'),"existing login needs an optional Name field");
  const formDiv=portal.match(/<div id="existing-login-form"[^>]*>/);
  assert.ok(formDiv,"existing login form must exist");
  assert.doesNotMatch(formDiv[0],/hidden/,"existing login must be visible on first paint, not hidden behind a toggle");
  assert.equal(portal.includes('id="existing-mac-login"'),false,"the toggle button must be gone");
  assert.ok(portal.includes('id="phone"'),"recharge form still needs its Phone field");
  assert.ok(portal.includes('id="customer-name"'),"recharge form still needs its Name field");
  assert.ok(portal.includes('id="claim-code-box"'),"the claim-code box must still exist");
  assert.ok(portal.includes('id="result"'),"the shared status area must still exist");
});

test("P4: login.html voucher form has Phone + Name, handleVoucherLogin sends them, TrxID mode sends phone",()=>{
  const login=fs.readFileSync(path.join(__dirname,"..","public","login.html"),"utf8");
  assert.ok(login.includes('id="voucher_phone"'),"voucher section needs an optional Phone field");
  assert.ok(login.includes('id="voucher_name"'),"voucher section needs an optional Name field");
  const voucherFn=login.slice(login.indexOf("async function handleVoucherLogin()"),login.indexOf("window.switchPortalTab"));
  assert.ok(voucherFn.includes("/api/hotspot-auth/claim-voucher"),"handleVoucherLogin must post to claim-voucher");
  assert.ok(voucherFn.includes("customer_name"),"handleVoucherLogin must send customer_name with the claim");
  assert.ok(voucherFn.includes("phone:voucherPhone"),"handleVoucherLogin must send the phone with the claim");
  assert.ok(voucherFn.includes("সঠিক ১১ ডিজিটের ফোন নম্বর দিন অথবা খালি রাখুন।"),"an invalid entered phone must be rejected with the Bangla message");
  const verifyFn=login.slice(login.indexOf("async function handleVerification()"),login.indexOf("function parseQrCredentials"));
  assert.ok(verifyFn.includes("payload.phone"),"handleVerification must send phone in TrxID mode");
  assert.ok(verifyFn.includes("payload.senderPhoneNumber"),"senderPhoneNumber mode must keep sending senderPhoneNumber");
  assert.ok(login.includes("byId('sender-phone-field').hidden=false"),"the phone field must be shown in both verification modes");
  assert.ok(login.includes("cust_phone_label"),"the phone label must switch text per mode");
  const qrFn=login.slice(login.indexOf("function applyScannedCredentials"),login.indexOf("async function handleVoucherLogin()"));
  assert.equal(qrFn.includes("voucher_phone"),false,"QR fill must not touch the phone field");
  assert.equal(qrFn.includes("voucher_name"),false,"QR fill must not touch the name field");
});

test("P4: router login page still redirects with the MAC and its fallback link keeps the MAC",()=>{
  const routerPage=fs.readFileSync(path.join(__dirname,"..","docs","router-hotspot-login.html"),"utf8");
  assert.ok(routerPage.includes("https://faznetwork.com/login.html"),"the router page must redirect to /login.html");
  assert.ok(routerPage.includes("?mac=$(mac)"),"the redirect must carry the device MAC");
  assert.ok(routerPage.includes('id="login-link"'),"the fallback link must have an id so JS can set it");
  assert.ok(routerPage.includes("link.href = target"),"the fallback link href must be set from JS to the full redirect target");
  assert.ok(routerPage.includes("window.location.replace(target)"),"the instant redirect must stay");
});
