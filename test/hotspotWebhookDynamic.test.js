"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const paymentController=require("../controllers/paymentController");

function responseRecorder(){
  return {
    statusCode:200,body:null,
    status(code){this.statusCode=code;return this;},
    json(body){this.body=body;return this;}
  };
}

test("verifyTrx requires a valid client MAC before claiming a payment", async () => {
  const res = responseRecorder();
  await paymentController.verifyTrx({
    ip: "test-invalid-hotspot-mac",
    body: { account_phone: "01712345678", trxId: "INVALID-MAC", amount: 15, profile_id: "pkg-weekend" }
  }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.code, "INVALID_MAC");
});

test("verifyTrx uses the current database profile price after a 10 to 15 Tk edit",async()=>{
  const originalQuery=db.query,originalWithTransaction=db.withTransaction,originalProfiles=mikrotik.getHotspotProfiles,originalRecharge=mikrotik.rechargeHotspotUser,originalUpdateProfile=mikrotik.updateHotspotProfile;
  let profileMetadata={Weekend:{id:"pkg-weekend",price:10,validityValue:1,validityUnit:"days",validityLabel:"1 Day",limitBytesTotal:0}};
  let rechargePayload=null,profileUpdatePayload=null;
  try{
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{if(sql.startsWith("UPDATE transactions"))return {rows:[{id:params[1]}]};throw new Error("Unexpected transactional SQL: "+sql);}});
    // Simulate the admin saving the profile price from Tk 10 to Tk 15 in app_settings.
    profileMetadata={Weekend:{id:"pkg-weekend",price:15,validityValue:2,validityUnit:"days",validityLabel:"2 Days",limitBytesTotal:0}};
    db.query=async(sql,params=[])=>{
      if(sql.startsWith("UPDATE hotspot_vouchers"))return {rows:[]};
      if(sql.startsWith("INSERT INTO hotspot_vouchers"))return {rows:[{id:1}]};
      if(sql.includes("SELECT * FROM transactions"))return {rows:[{id:params[0]==="PRICE10"?72:71,trx_id:params[0],amount:params[0]==="PRICE10"?10:15,used:false,status:"unmatched",matched_username:null}]};
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata)}]};
      if(sql.includes("SET status='processing',used=true"))return {rows:[{id:params[1]}]};
      if(sql.startsWith("UPDATE transactions"))return {rows:[]};
      throw new Error("Unexpected SQL in test: "+sql);
    };
    mikrotik.getHotspotProfiles=async()=>[{name:"Weekend",sessionTimeout:"1d"}];
    // verifyTrx updates the profile before provisioning; never open a RouterOS socket in CI.
    mikrotik.updateHotspotProfile=async(payload)=>{profileUpdatePayload=payload;return {success:true};};
    mikrotik.rechargeHotspotUser=async(payload)=>{rechargePayload=payload;return {username:payload.username};};
    const req={ip:"test-price-sync-15",body:{mac:"AA-BB-CC-DD-EE-FF",account_phone:"01712345678",trxId:"PRICE15",amount:15,profile_id:"pkg-weekend"}};
    const res=responseRecorder();
    await paymentController.verifyTrx(req,res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(res.body.profile,"Weekend");
    assert.equal(res.body.validity,"2d");
    assert.equal(res.body.amount,15);
    assert.equal(rechargePayload.profile,"Weekend");
    assert.equal(rechargePayload.validity,"2d");
    assert.deepEqual(Object.keys(profileUpdatePayload).sort(),["name","onLogin"],"a purchase must not mutate shared session-timeout, rate-limit, or other profile settings");
    assert.match(profileUpdatePayload.onLogin,/FAZ_HOTSPOT_EXPIRY_V2/);
    assert.doesNotMatch(profileUpdatePayload.onLogin,/FAZ\\|EXP=|FIRST_LOGIN=|session-timeout|interval=2d/);

    // The old Tk 10 amount must stop matching immediately after the profile price is changed.
    const oldAmountResponse=responseRecorder();
    await paymentController.verifyTrx({ip:"test-price-sync-old-10",body:{mac:"AA-BB-CC-DD-EE-FF",account_phone:"01712345678",trxId:"PRICE10",amount:10,profile_id:"pkg-weekend"}},oldAmountResponse);
    assert.equal(oldAmountResponse.statusCode,400);
    assert.match(oldAmountResponse.body.error,/paid amount does not match the configured price/i);
  }finally{
    db.query=originalQuery;
    db.withTransaction=originalWithTransaction;
    mikrotik.getHotspotProfiles=originalProfiles;
    mikrotik.rechargeHotspotUser=originalRecharge;mikrotik.updateHotspotProfile=originalUpdateProfile;
  }
});

test("dynamicWebhook catches a custom full-URL path from app_settings",async()=>{
  const originalQuery=db.query;
  let nextCalled=false;
  try{
    db.query=async(sql)=>{
      if(sql.includes("personal_payment_webhook_url"))return {rows:[{key:"personal_payment_webhook_url",value:"https://forwarder.example/api/custom-forwarder?source=sms"}]};
      if(sql.includes("personal_payment_webhook_enabled"))return {rows:[{key:"personal_payment_webhook_enabled",value:"false"},{key:"personal_payment_webhook_secret",value:""}]};
      throw new Error("Unexpected SQL in test: "+sql);
    };
    const req={path:"/api/custom-forwarder",body:{},query:{},headers:{},get:()=>""};
    const res=responseRecorder();
    await paymentController.dynamicWebhook(req,res,()=>{nextCalled=true;});
    assert.equal(nextCalled,false,"matching custom path should be handled, not passed to next route");
    assert.equal(res.statusCode,403,"custom endpoint should reach webhook processor and respect its enabled guard");
    assert.equal(res.body.error,"Automation disabled");
  }finally{
    db.query=originalQuery;
  }
});


test("verifyTrx accepts username and trx_id aliases with case/whitespace-insensitive lookup",async()=>{
  const originalQuery=db.query,originalWithTransaction=db.withTransaction,originalProfiles=mikrotik.getHotspotProfiles,originalRecharge=mikrotik.rechargeHotspotUser,originalUpdateProfile=mikrotik.updateHotspotProfile;
  let lookupSql="",claimSql="",lookupValue="",rechargePayload=null;
  try{
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{if(sql.startsWith("UPDATE transactions"))return {rows:[{id:params[1]}]};throw new Error("Unexpected transactional SQL: "+sql);}});
    db.query=async(sql,params=[])=>{
      if(sql.startsWith("UPDATE hotspot_vouchers"))return {rows:[]};
      if(sql.startsWith("INSERT INTO hotspot_vouchers"))return {rows:[{id:1}]};
      if(sql.includes("SELECT * FROM transactions")){lookupSql=sql;lookupValue=params[0];return {rows:[{id:91,trx_id:"AbC-123",amount:15,used:false,status:"Unmatched",matched_username:null}]};}
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify({Weekend:{id:"pkg-weekend",price:15,validityValue:2,validityUnit:"days",id:"pkg-1-hour",aliases:["1-Hour","1h","pkg-1-hour"],limitBytesTotal:0}})}]};
      if(sql.includes("SET status='processing',used=true")){claimSql=sql;return {rows:[{id:params[1]}]};}
      if(sql.startsWith("UPDATE transactions"))return {rows:[]};
      throw new Error("Unexpected SQL in test: "+sql);
    };
    mikrotik.getHotspotProfiles=async()=>[{name:"Weekend",sessionTimeout:"1d"}];
    // verifyTrx updates the profile before provisioning; never open a RouterOS socket in CI.
    mikrotik.updateHotspotProfile=async()=>({success:true});
    mikrotik.rechargeHotspotUser=async(payload)=>{rechargePayload=payload;return {username:payload.username};};
    const req={ip:"test-alias-trim-case",body:{mac:"aa-bb-cc-dd-ee-ff",account_phone:" 01712345678 ",trx_id:"  aBc-123  ",profile_id:"pkg-1-hour",amount:15},query:{}};
    const res=responseRecorder();
    await paymentController.verifyTrx(req,res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(res.body.username,"AA:BB:CC:DD:EE:FF");
    assert.equal(res.body.password,"01712345678");
    assert.equal(lookupValue,"ABC-123");
    assert.match(lookupSql,/UPPER\(TRIM\(trx_id\)\)\s*=\s*\$1/i);
    assert.match(claimSql,/status='unmatched' AND \(used=false OR used IS NULL\)/i);
    assert.match(lookupSql,/UPPER\(TRIM\(trx_id\)\)\s*=\s*\$1/i);
    assert.equal(rechargePayload.username,"AA:BB:CC:DD:EE:FF");
    assert.equal(rechargePayload.password,"01712345678");
  }finally{
    db.query=originalQuery;
    db.withTransaction=originalWithTransaction;
    mikrotik.getHotspotProfiles=originalProfiles;
    mikrotik.rechargeHotspotUser=originalRecharge;mikrotik.updateHotspotProfile=originalUpdateProfile;
  }
});


test("verifyTrx keeps a durable processing claim if RouterOS succeeds but DB commit fails",async()=>{
  const originalQuery=db.query,originalWithTransaction=db.withTransaction,originalProfiles=mikrotik.getHotspotProfiles,originalRecharge=mikrotik.rechargeHotspotUser,originalUpdateProfile=mikrotik.updateHotspotProfile;
  let released=false,commitAttempted=false;
  try{
    db.query=async(sql,params=[])=>{
      if(sql.startsWith("UPDATE hotspot_vouchers"))return {rows:[]};
      if(sql.startsWith("INSERT INTO hotspot_vouchers"))return {rows:[{id:1}]};
      if(sql.includes("SELECT * FROM transactions"))return {rows:[{id:111,trx_id:"PARTIAL-111",amount:15,used:false,status:"unmatched",matched_username:null}]};
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify({Weekend:{id:"pkg-weekend",price:15,validityValue:2,validityUnit:"days",limitBytesTotal:0}})}]};
      if(sql.includes("SET status='processing',used=true"))return {rows:[{id:params[1]}]};
      if(sql.includes("SET status='unmatched'")){released=true;return {rows:[{id:params[0]}]};}
      if(sql.includes("SELECT status FROM transactions"))return {rows:[]};
      throw new Error("Unexpected SQL in test: "+sql);
    };
    mikrotik.getHotspotProfiles=async()=>[{name:"Weekend",sessionTimeout:"1d"}];
    // verifyTrx updates the profile before provisioning; never open a RouterOS socket in CI.
    mikrotik.updateHotspotProfile=async()=>({success:true});
    mikrotik.rechargeHotspotUser=async()=>({username:"01712345678"});
    db.withTransaction=async callback=>{
      commitAttempted=true;
      await callback({query:async(sql,params=[])=>{if(sql.startsWith("UPDATE transactions"))return {rows:[{id:params[1]}]};throw new Error("Unexpected transactional SQL: "+sql);}});
      throw new Error("simulated commit failure");
    };
    const res=responseRecorder();
    await paymentController.verifyTrx({ip:"test-partial-commit",body:{mac:"AA-BB-CC-DD-EE-FF",account_phone:"01712345678",trxId:"PARTIAL-111",amount:15,profile_id:"pkg-weekend"}},res);
    assert.equal(res.statusCode,500);
    assert.equal(commitAttempted,true);
    assert.equal(released,false,"successful RouterOS provisioning must not release the transaction for reuse");
  }finally{
    db.query=originalQuery;db.withTransaction=originalWithTransaction;
    mikrotik.getHotspotProfiles=originalProfiles;mikrotik.rechargeHotspotUser=originalRecharge;mikrotik.updateHotspotProfile=originalUpdateProfile;
  }
});

test("verifyTrx releases the claim if RouterOS provisioning fails",async()=>{
  const originalQuery=db.query,originalWithTransaction=db.withTransaction,originalProfiles=mikrotik.getHotspotProfiles,originalRecharge=mikrotik.rechargeHotspotUser,originalUpdateProfile=mikrotik.updateHotspotProfile;
  let released=false;
  try{
    db.query=async(sql,params=[])=>{
      if(sql.startsWith("UPDATE hotspot_vouchers"))return {rows:[]};
      if(sql.startsWith("INSERT INTO hotspot_vouchers"))return {rows:[{id:1}]};
      if(sql.includes("SELECT * FROM transactions"))return {rows:[{id:112,trx_id:"ROUTER-FAIL-112",amount:15,used:false,status:"unmatched",matched_username:null}]};
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify({Weekend:{id:"pkg-weekend",price:15,validityValue:2,validityUnit:"days",limitBytesTotal:0}})}]};
      if(sql.includes("SET status='processing',used=true"))return {rows:[{id:params[1]}]};
      if(sql.includes("SET status='unmatched'")){released=true;return {rows:[{id:params[0]}]};}
      throw new Error("Unexpected SQL in test: "+sql);
    };
    mikrotik.getHotspotProfiles=async()=>[{name:"Weekend",sessionTimeout:"1d"}];
    // verifyTrx updates the profile before provisioning; never open a RouterOS socket in CI.
    mikrotik.updateHotspotProfile=async()=>({success:true});
    mikrotik.rechargeHotspotUser=async()=>{throw new Error("simulated RouterOS failure");};
    db.withTransaction=async()=>{throw new Error("should not finalize after RouterOS failure");};
    const res=responseRecorder();
    await paymentController.verifyTrx({ip:"test-router-fail",body:{mac:"AA-BB-CC-DD-EE-FF",account_phone:"01712345678",trxId:"ROUTER-FAIL-112",amount:15,profile_id:"pkg-weekend"}},res);
    assert.equal(res.statusCode,500);
    assert.equal(released,true,"a confirmed RouterOS failure should release the claim");
  }finally{
    db.query=originalQuery;db.withTransaction=originalWithTransaction;
    mikrotik.getHotspotProfiles=originalProfiles;mikrotik.rechargeHotspotUser=originalRecharge;mikrotik.updateHotspotProfile=originalUpdateProfile;
  }
});


test("verifyTrx atomic claim allows only one concurrent RouterOS recharge",async()=>{
  const originalQuery=db.query,originalWithTransaction=db.withTransaction,originalProfiles=mikrotik.getHotspotProfiles,originalRecharge=mikrotik.rechargeHotspotUser,originalUpdateProfile=mikrotik.updateHotspotProfile;
  let claimAttempts=0,rechargeCount=0;
  try{
    db.query=async(sql,params=[])=>{
      if(sql.startsWith("UPDATE hotspot_vouchers"))return {rows:[]};
      if(sql.startsWith("INSERT INTO hotspot_vouchers"))return {rows:[{id:1}]};
      if(sql.includes("SELECT * FROM transactions"))return {rows:[{id:113,trx_id:"CONCURRENT-113",amount:15,used:false,status:"unmatched",matched_username:null}]};
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify({Weekend:{id:"pkg-weekend",price:15,validityValue:2,validityUnit:"days",limitBytesTotal:0}})}]};
      if(sql.includes("SET status='processing',used=true")){claimAttempts++;return claimAttempts===1?{rows:[{id:113}]}:{rows:[]};}
      if(sql.includes("SELECT status FROM transactions"))return {rows:[{status:"processing"}]};
      throw new Error("Unexpected SQL in test: "+sql);
    };
    mikrotik.getHotspotProfiles=async()=>[{name:"Weekend",sessionTimeout:"1d"}];
    // verifyTrx updates the profile before provisioning; never open a RouterOS socket in CI.
    mikrotik.updateHotspotProfile=async()=>({success:true});
    mikrotik.rechargeHotspotUser=async()=>{rechargeCount++;return {username:"01712345678"};};
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{if(sql.startsWith("UPDATE transactions"))return {rows:[{id:params[1]}]};throw new Error("Unexpected transactional SQL: "+sql);}});
    const a=responseRecorder(),b=responseRecorder();
    await Promise.all([
      paymentController.verifyTrx({ip:"test-concurrent-a",body:{mac:"AA-BB-CC-DD-EE-FF",account_phone:"01712345678",trxId:"CONCURRENT-113",amount:15,profile_id:"pkg-weekend"}},a),
      paymentController.verifyTrx({ip:"test-concurrent-b",body:{mac:"AA-BB-CC-DD-EE-FF",account_phone:"01712345678",trxId:"CONCURRENT-113",amount:15,profile_id:"pkg-weekend"}},b)
    ]);
    assert.equal(claimAttempts,2);
    assert.equal(rechargeCount,1,"only the winning atomic claim may invoke RouterOS");
    assert.deepEqual([a.statusCode,b.statusCode].sort(),[200,409]);
  }finally{
    db.query=originalQuery;db.withTransaction=originalWithTransaction;
    mikrotik.getHotspotProfiles=originalProfiles;mikrotik.rechargeHotspotUser=originalRecharge;mikrotik.updateHotspotProfile=originalUpdateProfile;
  }
});
