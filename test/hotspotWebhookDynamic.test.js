"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const hotspotController=require("../controllers/hotspotController");
const paymentController=require("../controllers/paymentController");
const hotspotAuthController=require("../controllers/hotspotAuthController");

function responseRecorder(){
  return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}
function oneHourProfile(){
  return [{name:"1-Hour",sharedUsers:"1",sessionTimeout:"1h",raw:{}}];
}
function profileMetadata(){
  return {"1-Hour":{id:"pkg-1-hour",profile_id:"pkg-1-hour",price:10,validityValue:1,validityUnit:"hours",validityLabel:"1 Hour",limitBytesTotal:0}};
}
function pendingVoucher(overrides={}){
  return {id:41,username:"PENDING-01712345678",password:"01712345678",profile:"1-Hour",profile_id:"pkg-1-hour",validity:"1h",price:10,status:"pending_claim",phone:"01712345678",server:"all",time_limit:"1h",data_limit:null,mac_address:null,comment:"FAZ|PENDING|PROFILE=1-Hour",first_login_at:null,expires_at:null,...overrides};
}
function paymentTransaction(id=5,amount=10){
  return {id,trx_id:"TXN-TEST-5",channel:"bkash",sender_phone:"01712345678",amount,status:"unmatched",used:false,matched_username:null};
}

test("Admin creates a phone + package pending account without MAC or RouterOS provisioning",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction;
  const oldProfiles=mikrotik.getHotspotProfiles,oldCreate=mikrotik.createHotspotUser,oldRecharge=mikrotik.rechargeHotspotUser;
  let insertedSql="",insertedParams=[],routerWrites=0;
  try{
    db.query=async sql=>{
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      if(sql.startsWith("SELECT price FROM hotspot_vouchers"))return {rows:[]};
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[]};
      if(sql.startsWith("INSERT INTO hotspot_vouchers")){
        insertedSql=sql;insertedParams=params;
        return {rows:[{id:41,username:params[0],profile:params[2],profile_id:params[10],phone:params[6],status:"pending_claim",mac_address:params[11]}]};
      }
      throw new Error("Unexpected transactional query: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.createHotspotUser=async()=>{routerWrites++;throw new Error("Admin create must not write RouterOS");};
    mikrotik.rechargeHotspotUser=async()=>{routerWrites++;throw new Error("Admin create must not write RouterOS");};
    const res=responseRecorder();
    await hotspotController.createUser({body:{phone:"01712345678",profile_id:"pkg-1-hour"}},res);
    assert.equal(res.statusCode,201);
    assert.equal(res.body.success,true);
    assert.equal(res.body.pending_activation,true);
    assert.equal(res.body.user.status,"pending_claim");
    assert.equal(res.body.user.phone,"01712345678");
    assert.match(insertedSql,/VALUES\(\$1,\$2,\$3,\$4,\$5,'pending_claim'/);
    assert.equal(insertedParams[1],"01712345678","pending database password field stores the phone for verification");
    assert.equal(insertedParams[6],"01712345678","phone is stored as the stable customer lookup key");
    assert.equal(insertedParams[10],"pkg-1-hour");
    assert.equal(insertedParams[11],null,"admin cannot supply a device MAC");
    assert.equal(routerWrites,0,"pending accounts must not be provisioned on RouterOS before first login");
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;
    mikrotik.getHotspotProfiles=oldProfiles;mikrotik.createHotspotUser=oldCreate;mikrotik.rechargeHotspotUser=oldRecharge;
  }
});

test("verifyTrx validates payment and stages a pending phone package without RouterOS writes",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles;
  const oldRecharge=mikrotik.rechargeHotspotUser,oldCreate=mikrotik.createHotspotUser,oldUpdate=mikrotik.updateHotspotProfile;
  let routerWrites=0,claimCount=0,stageCount=0;
  try{
    db.query=async(sql,params=[])=>{
      if(sql.startsWith("SELECT * FROM transactions"))return {rows:[paymentTransaction(5,10)]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      if(sql.startsWith("UPDATE transactions SET status='processing'")){claimCount++;return {rows:[{id:5}]};}
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[]};
      if(sql.startsWith("INSERT INTO hotspot_vouchers")){
        stageCount++;
        assert.match(sql,/pending_claim/);
        assert.equal(params[1],"01712345678");
        assert.equal(params[9],"pkg-1-hour");
        assert.equal(params[10],null);
        return {rows:[{id:41,username:params[0],phone:params[6],status:"pending_claim"}]};
      }
      if(sql.startsWith("UPDATE transactions SET status='processed'"))return {rows:[{id:5}]};
      throw new Error("Unexpected transactional query: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.rechargeHotspotUser=async()=>{routerWrites++;return {};};
    mikrotik.createHotspotUser=async()=>{routerWrites++;return {};};
    mikrotik.updateHotspotProfile=async()=>{routerWrites++;return {};};
    const res=responseRecorder();
    await paymentController.verifyTrx({ip:"payment-stage-test",body:{service_type:"hotspot",phone:"01712345678",trxId:"TXN-TEST-5",amount:10,profile_id:"pkg-1-hour",paymentMethod:"bkash"}},res);
    assert.equal(res.statusCode,200,JSON.stringify(res.body));
    assert.equal(res.body.success,true);
    assert.equal(res.body.pending_activation,true);
    assert.equal(res.body.username,null);
    assert.equal(res.body.password,null);
    assert.equal(res.body.profile,"1-Hour");
    assert.equal(claimCount,1);
    assert.equal(stageCount,1);
    assert.equal(routerWrites,0,"checkout must not create, rename, or update a RouterOS user");
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;
    mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;
    mikrotik.createHotspotUser=oldCreate;mikrotik.updateHotspotProfile=oldUpdate;
  }
});

test("first captive login normalizes and binds MAC, then provisions RouterOS with MAC username and phone password",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles;
  const oldRecharge=mikrotik.rechargeHotspotUser,oldCreate=mikrotik.createHotspotUser;
  let routerPayload=null,activeUpdate=null;
  try{
    db.query=async(sql,params=[])=>{
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET status='active'")){
        activeUpdate={sql,params};
        return {rows:[{id:41,username:params[1],status:"active",first_login_at:new Date(params[1])}]};
      }
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers")){
        assert.match(sql,/mac_address/);
        return {rows:[pendingVoucher()]};
      }
      if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1")){
        const row=pendingVoucher({username:params[0],password:params[1],mac_address:params[2],first_login_at:params[3],expires_at:params[4],comment:params[5]});
        return {rows:[row]};
      }
      throw new Error("Unexpected transactional query: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.rechargeHotspotUser=async payload=>{routerPayload=payload;return {username:payload.username};};
    mikrotik.createHotspotUser=async()=>{throw new Error("first activation should use the existing-user-aware recharge provisioner");};
    const res=responseRecorder();
    await hotspotAuthController.activate({ip:"first-bind-test",body:{mac:"aa-bb-cc-dd-ee-ff",phone:"01712345678"}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(res.body.username,"AA:BB:CC:DD:EE:FF");
    assert.equal(res.body.password,"01712345678");
    assert.equal(routerPayload.username,"AA:BB:CC:DD:EE:FF");
    assert.equal(routerPayload.password,"01712345678");
    assert.equal(routerPayload.macAddress,"AA:BB:CC:DD:EE:FF");
    assert.equal(routerPayload.profile,"1-Hour");
    assert.match(routerPayload.comment,/^Exp: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(activeUpdate.params[1],"AA:BB:CC:DD:EE:FF");
    assert.equal(activeUpdate.params[2],"01712345678");
    const firstLoginAt=new Date(routerPayload.comment.slice(5).replace(" ","T")+"+06:00").getTime();
    assert.ok(Number.isFinite(firstLoginAt));
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;
    mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;mikrotik.createHotspotUser=oldCreate;
  }
});

test("an already-bound phone rejects a different device MAC before touching RouterOS",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles,oldRecharge=mikrotik.rechargeHotspotUser;
  let routerWrites=0;
  try{
    db.query=async sql=>{
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async sql=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[pendingVoucher({username:"AA:BB:CC:DD:EE:FF",mac_address:"AA:BB:CC:DD:EE:FF",status:"active",first_login_at:new Date(Date.now()-60000),expires_at:new Date(Date.now()+3600000),comment:"Exp: 2026-10-15 12:00:00"})]};
      throw new Error("The database row should reject the MAC before update: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.rechargeHotspotUser=async()=>{routerWrites++;return {};};
    const res=responseRecorder();
    await hotspotAuthController.activate({ip:"wrong-mac-test",body:{mac:"10-20-30-40-50-60",phone:"01712345678"}},res);
    assert.equal(res.statusCode,403);
    assert.equal(res.body.code,"MAC_MISMATCH");
    assert.equal(routerWrites,0,"a different MAC must not get a RouterOS user or password");
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;
    mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;
  }
});

test("the same MAC cannot be rebound to a different phone",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles,oldRecharge=mikrotik.rechargeHotspotUser;
  let routerWrites=0;
  try{
    db.query=async sql=>{
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async sql=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[pendingVoucher({username:"AA:BB:CC:DD:EE:FF",mac_address:"AA:BB:CC:DD:EE:FF",phone:"01711111111",status:"active"})]};
      throw new Error("Unexpected transactional query: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.rechargeHotspotUser=async()=>{routerWrites++;return {};};
    const res=responseRecorder();
    await hotspotAuthController.activate({ip:"wrong-phone-same-mac-test",body:{mac:"aa:bb:cc:dd:ee:ff",phone:"01712345678"}},res);
    assert.equal(res.statusCode,403);
    assert.equal(res.body.code,"MAC_ALREADY_BOUND");
    assert.equal(routerWrites,0);
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;
    mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;
  }
});

test("verifyTrx rejects invalid Bangladeshi phone numbers before claiming a payment",async()=>{
  const oldQuery=db.query;
  let called=false;
  try{
    db.query=async()=>{called=true;return {rows:[]};};
    const res=responseRecorder();
    await paymentController.verifyTrx({ip:"bad-phone-test",body:{service_type:"hotspot",phone:"12345",trxId:"TXN",amount:10,profile_id:"pkg-1-hour"}},res);
    assert.equal(res.statusCode,400);
    assert.equal(res.body.code,"INVALID_ACCOUNT_PHONE");
    assert.equal(called,false);
  }finally{db.query=oldQuery;}
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


