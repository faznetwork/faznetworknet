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

test("verifyTrx uses the current database profile price after a 10 to 15 Tk edit",async()=>{
  const originalQuery=db.query,originalWithTransaction=db.withTransaction,originalProfiles=mikrotik.getHotspotProfiles,originalRecharge=mikrotik.rechargeHotspotUser,originalUpdateProfile=mikrotik.updateHotspotProfile;
  let profileMetadata={Weekend:{price:10,validityValue:1,validityUnit:"days",validityLabel:"1 Day",limitBytesTotal:0}};
  let rechargePayload=null;
  try{
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{if(sql.startsWith("UPDATE transactions"))return {rows:[{id:params[1]}]};throw new Error("Unexpected transactional SQL: "+sql);}});
    // Simulate the admin saving the profile price from Tk 10 to Tk 15 in app_settings.
    profileMetadata={Weekend:{price:15,validityValue:2,validityUnit:"days",validityLabel:"2 Days",limitBytesTotal:0}};
    db.query=async(sql,params=[])=>{
      if(sql.includes("SELECT * FROM transactions"))return {rows:[{id:params[0]==="PRICE10"?72:71,trx_id:params[0],amount:params[0]==="PRICE10"?10:15,used:false,status:"unmatched",matched_username:null}]};
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata)}]};
      if(sql.includes("SET used=true,status='processing'"))return {rows:[{id:params[1]}]};
      if(sql.startsWith("UPDATE transactions"))return {rows:[]};
      throw new Error("Unexpected SQL in test: "+sql);
    };
    mikrotik.getHotspotProfiles=async()=>[{name:"Weekend",sessionTimeout:"1d"}];
    // verifyTrx updates the profile before provisioning; never open a RouterOS socket in CI.
    mikrotik.updateHotspotProfile=async()=>({success:true});
    mikrotik.rechargeHotspotUser=async(payload)=>{rechargePayload=payload;return {username:payload.username};};
    const req={ip:"test-price-sync-15",body:{phone:"01712345678",trxId:"PRICE15"}};
    const res=responseRecorder();
    await paymentController.verifyTrx(req,res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(res.body.profile,"Weekend");
    assert.equal(res.body.validity,"2d");
    assert.equal(res.body.amount,15);
    assert.equal(rechargePayload.profile,"Weekend");
    assert.equal(rechargePayload.validity,"2d");

    // The old Tk 10 amount must stop matching immediately after the profile price is changed.
    const oldAmountResponse=responseRecorder();
    await paymentController.verifyTrx({ip:"test-price-sync-old-10",body:{phone:"01712345678",trxId:"PRICE10"}},oldAmountResponse);
    assert.equal(oldAmountResponse.statusCode,400);
    assert.match(oldAmountResponse.body.error,/no active Hotspot profile currently has a price of ৳10\.00/i);
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
  let lookupSql="",lookupValue="",rechargePayload=null;
  try{
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{if(sql.startsWith("UPDATE transactions"))return {rows:[{id:params[1]}]};throw new Error("Unexpected transactional SQL: "+sql);}});
    db.query=async(sql,params=[])=>{
      if(sql.includes("SELECT * FROM transactions")){lookupSql=sql;lookupValue=params[0];return {rows:[{id:91,trx_id:"AbC-123",amount:15,used:false,status:"Unmatched",matched_username:null}]};}
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify({Weekend:{price:15,validityValue:2,validityUnit:"days",aliases:["1-Hour","1h","pkg-1-hour"],limitBytesTotal:0}})}]};
      if(sql.includes("SET used=true,status='processing'"))return {rows:[{id:params[1]}]};
      if(sql.startsWith("UPDATE transactions"))return {rows:[]};
      throw new Error("Unexpected SQL in test: "+sql);
    };
    mikrotik.getHotspotProfiles=async()=>[{name:"Weekend",sessionTimeout:"1d"}];
    // verifyTrx updates the profile before provisioning; never open a RouterOS socket in CI.
    mikrotik.updateHotspotProfile=async()=>({success:true});
    mikrotik.rechargeHotspotUser=async(payload)=>{rechargePayload=payload;return {username:payload.username};};
    const req={ip:"test-alias-trim-case",body:{username:" 01712345678 ",trx_id:"  aBc-123  ",profileName:"1h"},query:{}};
    const res=responseRecorder();
    await paymentController.verifyTrx(req,res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(res.body.username,"01712345678");
    assert.equal(lookupValue,"  aBc-123  ");
    assert.match(lookupSql,/UPPER\(TRIM\(trx_id\)\)\s*=\s*UPPER\(TRIM\(\$1\)\)/i);
    assert.match(lookupSql,/used\s*=\s*false/i);
    assert.match(lookupSql,/unmatched/i);
    assert.equal(rechargePayload.username,"01712345678");
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
      if(sql.includes("SELECT * FROM transactions"))return {rows:[{id:111,trx_id:"PARTIAL-111",amount:15,used:false,status:"unmatched",matched_username:null}]};
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify({Weekend:{price:15,validityValue:2,validityUnit:"days",limitBytesTotal:0}})}]};
      if(sql.includes("SET used=true,status='processing'"))return {rows:[{id:params[1]}]};
      if(sql.includes("SET status='unmatched'")){released=true;return {rows:[{id:params[0]}]};}
      if(sql.includes("SELECT status,used FROM transactions"))return {rows:[]};
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
    await paymentController.verifyTrx({ip:"test-partial-commit",body:{phone:"01712345678",trxId:"PARTIAL-111"}},res);
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
      if(sql.includes("SELECT * FROM transactions"))return {rows:[{id:112,trx_id:"ROUTER-FAIL-112",amount:15,used:false,status:"unmatched",matched_username:null}]};
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify({Weekend:{price:15,validityValue:2,validityUnit:"days",limitBytesTotal:0}})}]};
      if(sql.includes("SET used=true,status='processing'"))return {rows:[{id:params[1]}]};
      if(sql.includes("SET status='unmatched'")){released=true;return {rows:[{id:params[0]}]};}
      throw new Error("Unexpected SQL in test: "+sql);
    };
    mikrotik.getHotspotProfiles=async()=>[{name:"Weekend",sessionTimeout:"1d"}];
    // verifyTrx updates the profile before provisioning; never open a RouterOS socket in CI.
    mikrotik.updateHotspotProfile=async()=>({success:true});
    mikrotik.rechargeHotspotUser=async()=>{throw new Error("simulated RouterOS failure");};
    db.withTransaction=async()=>{throw new Error("should not finalize after RouterOS failure");};
    const res=responseRecorder();
    await paymentController.verifyTrx({ip:"test-router-fail",body:{phone:"01712345678",trxId:"ROUTER-FAIL-112"}},res);
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
      if(sql.includes("SELECT * FROM transactions"))return {rows:[{id:113,trx_id:"CONCURRENT-113",amount:15,used:false,status:"unmatched",matched_username:null}]};
      if(sql.includes("SELECT 1 FROM pppoe_users"))return {rows:[]};
      if(sql.includes("FROM packages WHERE ROUND(price*100)"))return {rows:[]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify({Weekend:{price:15,validityValue:2,validityUnit:"days",limitBytesTotal:0}})}]};
      if(sql.includes("SET used=true,status='processing'")){claimAttempts++;return claimAttempts===1?{rows:[{id:113}]}:{rows:[]};}
      if(sql.includes("SELECT status,used FROM transactions"))return {rows:[{status:"processing",used:true}]};
      throw new Error("Unexpected SQL in test: "+sql);
    };
    mikrotik.getHotspotProfiles=async()=>[{name:"Weekend",sessionTimeout:"1d"}];
    // verifyTrx updates the profile before provisioning; never open a RouterOS socket in CI.
    mikrotik.updateHotspotProfile=async()=>({success:true});
    mikrotik.rechargeHotspotUser=async()=>{rechargeCount++;return {username:"01712345678"};};
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{if(sql.startsWith("UPDATE transactions"))return {rows:[{id:params[1]}]};throw new Error("Unexpected transactional SQL: "+sql);}});
    const a=responseRecorder(),b=responseRecorder();
    await Promise.all([
      paymentController.verifyTrx({ip:"test-concurrent-a",body:{phone:"01712345678",trxId:"CONCURRENT-113"}},a),
      paymentController.verifyTrx({ip:"test-concurrent-b",body:{phone:"01712345678",trxId:"CONCURRENT-113"}},b)
    ]);
    assert.equal(claimAttempts,2);
    assert.equal(rechargeCount,1,"only the winning atomic claim may invoke RouterOS");
    assert.deepEqual([a.statusCode,b.statusCode].sort(),[200,409]);
  }finally{
    db.query=originalQuery;db.withTransaction=originalWithTransaction;
    mikrotik.getHotspotProfiles=originalProfiles;mikrotik.rechargeHotspotUser=originalRecharge;mikrotik.updateHotspotProfile=originalUpdateProfile;
  }
});
