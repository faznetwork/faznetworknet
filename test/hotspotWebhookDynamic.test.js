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

test("Admin creates a direct active subscriber, provisions RouterOS, and reuses an expired phone record",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction;
  const oldProfiles=mikrotik.getHotspotProfiles,oldRecharge=mikrotik.rechargeHotspotUser;
  let insertedSql="",insertedParams=[],updatedSql="",updatedParams=[],routerWrites=0;
  const expired={id:41,username:"AA:BB:CC:DD:EE:FF",password:"AA:BB:CC:DD:EE:FF",profile:"1-Hour",profile_id:"pkg-1-hour",validity:"1h",price:10,status:"expired",phone:"01712345678",server:"all",time_limit:"1h",data_limit:null,mac_address:"AA:BB:CC:DD:EE:FF",customer_name:"Old Name",note:"old",first_login_at:new Date(Date.now()-7200000),expires_at:new Date(Date.now()-3600000),expired_at:new Date(Date.now()-3500000),cleanup_status:"done",cleanup_error:null,router_removed_at:new Date(Date.now()-3400000),mac_lock:true,subscriber_type:"direct_subscriber",activation_type:"preassigned"};
  try{
    db.query=async(sql)=> {
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      if(sql.startsWith("SELECT price FROM hotspot_vouchers"))return {rows:[{price:10}]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET status='active'"))return {rows:[]};
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[expired]};
      if(sql.startsWith("SELECT phone FROM hotspot_vouchers"))return {rows:[{phone:"01712345678"}]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1")) {
        updatedSql=sql;updatedParams=params;
        return {rows:[{id:41,username:params[0],profile:params[2],profile_id:params[10],phone:params[6],status:"active",mac_address:params[11],customer_name:params[12],note:params[13],expires_at:params[15]}]};
      }
      if(sql.startsWith("INSERT INTO hotspot_vouchers")){insertedSql=sql;insertedParams=params;return {rows:[{id:42,username:params[0],profile:params[2],profile_id:params[10],phone:params[6],status:"active",mac_address:params[11],customer_name:params[12],note:params[13],expires_at:params[15]}]};}
      throw new Error("Unexpected transactional query: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.rechargeHotspotUser=async options=>{routerWrites++;assert.equal(options.username,"AA:BB:CC:DD:EE:FF");assert.equal(options.password,"AA:BB:CC:DD:EE:FF");assert.equal(options.profile,"1-Hour");assert.match(options.comment,/^Exp: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);};
    const res=responseRecorder();
    await hotspotController.createUser({body:{phone:"01712345678",mac:"aa-bb-cc-dd-ee-ff",profile_id:"pkg-1-hour",customer_name:"New Customer"}},res);
    assert.equal(res.statusCode,201);
    assert.equal(res.body.success,true);
    assert.equal(res.body.pending_activation,false);
    assert.equal(res.body.user.status,"active");
    assert.equal(res.body.user.username,"AA:BB:CC:DD:EE:FF");
    assert.equal(updatedSql.startsWith("UPDATE hotspot_vouchers"),true,"expired record is reactivated instead of creating a voucher row");
    assert.match(updatedSql,/status=\$18/);
    assert.equal(updatedParams[17],"active");
    assert.equal(updatedParams[18],"preassigned");
    assert.equal(updatedParams[19],41);
    assert.match(updatedSql,/expired_at=NULL/);
    assert.equal(updatedParams[0],"AA:BB:CC:DD:EE:FF");
    assert.equal(updatedParams[1],"AA:BB:CC:DD:EE:FF");
    assert.equal(updatedParams[6],"01712345678");
    assert.ok(new Date(updatedParams[15]).getTime()>Date.now());
    assert.equal(insertedSql,"","a previous expired phone record should be reused");
    assert.equal(routerWrites,1,"direct account must be provisioned immediately");
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;
    mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;
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
      if(sql.startsWith("INSERT INTO hotspot_voucher_payments"))return {rows:[]};
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


test("verifyTrx accepts TrxID and package with no customer phone",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles,oldRecharge=mikrotik.rechargeHotspotUser;
  const mac="AA:BB:CC:DD:EE:FF";
  let paymentPhone=null,claimParams=null,routerWrites=0;
  try{
    db.query=async(sql,params=[])=>{
      if(sql.startsWith("SELECT * FROM transactions"))return {rows:[paymentTransaction(5,10)]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      if(sql.startsWith("UPDATE transactions SET status='processing'")){claimParams=params;return {rows:[{id:5}]};}
      if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1,password=$1,mac_address=$1,status='active'"))return {rows:[{id:41,username:mac,status:"active",expires_at:params[2]}]};
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[]};
      if(sql.startsWith("INSERT INTO hotspot_vouchers")){
        assert.equal(params[0],mac,"MAC is the Hotspot username when no phone is supplied");
        assert.equal(params[6],"","phone remains optional in the voucher record");
        return {rows:[{id:41,username:params[0],password:params[1],profile:params[2],profile_id:params[9],phone:params[6],status:"pending_claim",server:"all",mac_address:params[10],comment:params[5],first_login_at:params[11],expires_at:params[12]}]};
      }
      if(sql.startsWith("INSERT INTO hotspot_voucher_payments")){paymentPhone=params[2];return {rows:[]};}
      if(sql.startsWith("UPDATE transactions SET status='processed'"))return {rows:[{id:5}]};
      throw new Error("Unexpected transactional query: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.rechargeHotspotUser=async payload=>{routerWrites++;assert.equal(payload.username,mac);assert.equal(payload.macAddress,mac);return {username:mac};};
    const res=responseRecorder();
    await paymentController.verifyTrx({ip:"no-phone-payment-test",body:{service_type:"hotspot",username:mac,mac,trxId:"TXN-TEST-5",amount:10,profile_id:"pkg-1-hour",paymentMethod:"bkash"}},res);
    assert.equal(res.statusCode,200,JSON.stringify(res.body));
    assert.equal(res.body.success,true);
    assert.equal(res.body.username,mac);
    assert.equal(res.body.phone,"");
    assert.deepEqual(claimParams,[mac,"TXN-TEST-5"],"the MAC, not a phone number, identifies the claim");
    assert.equal(paymentPhone,"","the payment ledger accepts an empty optional phone");
    assert.equal(routerWrites,1,"the MAC-bound package is provisioned without requiring a phone");
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;
  }
});

test("verifyTrx recharges an expired MAC-bound voucher and updates the submitted phone",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles,oldRecharge=mikrotik.rechargeHotspotUser;
  let routerPayload=null,updatedPhone="",stagedSql="";
  const mac="AA:BB:CC:DD:EE:FF";
  try{
    db.query=async(sql,params=[])=>{
      if(sql.startsWith("SELECT * FROM transactions"))return {rows:[paymentTransaction(5,10)]};
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      if(sql.startsWith("UPDATE transactions SET status='processing'"))return {rows:[{id:5}]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1,password=$1,mac_address=$1,status='active'"))return {rows:[{id:41,username:mac,status:"active",expires_at:params[2]}]};
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[pendingVoucher({id:41,username:mac,password:mac,mac_address:mac,phone:"01711111111",status:"expired",expires_at:new Date(Date.now()-86400000),profile:"1-Hour"})]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1")){
        stagedSql=sql;updatedPhone=params[6];
        return {rows:[pendingVoucher({id:41,username:params[0],password:params[1],mac_address:params[10],phone:params[6],status:"pending_claim",comment:params[5],first_login_at:params[11],expires_at:params[12],profile:params[2],server:"all"})]};
      }
      if(sql.startsWith("INSERT INTO hotspot_voucher_payments"))return {rows:[]};
      if(sql.startsWith("UPDATE transactions SET status='processed'"))return {rows:[{id:5}]};
      throw new Error("Unexpected transactional query: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.rechargeHotspotUser=async payload=>{routerPayload=payload;return {username:payload.username};};
    const res=responseRecorder();
    await paymentController.verifyTrx({ip:"mac-recharge-test",body:{service_type:"hotspot",phone:"01712345678",mac:"aa-bb-cc-dd-ee-ff",trxId:"TXN-TEST-5",amount:10,profile_id:"pkg-1-hour",paymentMethod:"bkash"}},res);
    assert.equal(res.statusCode,200,JSON.stringify(res.body));
    assert.equal(res.body.success,true);
    assert.equal(res.body.pending_activation,false);
    assert.equal(res.body.username,mac);
    assert.equal(updatedPhone,"01712345678");
    assert.match(stagedSql,/mac_address=\$11/);
    assert.equal(routerPayload.username,mac);
    assert.equal(routerPayload.macAddress,mac);
    assert.match(routerPayload.comment,/Exp: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;
  }
});

test("first captive login normalizes and binds MAC, then provisions RouterOS with MAC username and password",async()=>{
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
    assert.equal(res.body.password,"AA:BB:CC:DD:EE:FF");
    assert.equal(routerPayload.username,"AA:BB:CC:DD:EE:FF");
    assert.equal(routerPayload.password,"AA:BB:CC:DD:EE:FF");
    assert.equal(routerPayload.macAddress,"AA:BB:CC:DD:EE:FF");
    assert.equal(routerPayload.profile,"1-Hour");
    assert.match(routerPayload.comment,/^Exp: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.equal(activeUpdate.params[1],"AA:BB:CC:DD:EE:FF");
    assert.equal(activeUpdate.params[2],routerPayload.comment);
    const firstLoginAt=new Date(routerPayload.comment.slice(5).replace(" ","T")+"+06:00").getTime();
    assert.ok(Number.isFinite(firstLoginAt));
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;
    mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;mikrotik.createHotspotUser=oldCreate;
  }
});


test("manually generated unused voucher activates from phone number and captive-portal MAC",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles;
  const oldRecharge=mikrotik.rechargeHotspotUser;
  let routerPayload=null,activationQuery="";
  try{
    db.query=async(sql,params=[])=>{
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET status='active'"))return {rows:[{id:41,username:params[1],status:"active",first_login_at:new Date()}]};
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers")){
        activationQuery=sql;
        assert.match(sql,/pending_claim/);
        assert.match(sql,/unused/);
        assert.match(sql,/IN \('pending_claim','unused','active','expired'\)/);
        assert.doesNotMatch(sql,/expires_at IS NULL OR expires_at > NOW\(\)/,"unstarted vouchers must not be filtered by expiry");
        return {rows:[pendingVoucher({username:"PENDING-01712345678",status:"unused",mac_address:null,expires_at:new Date(Date.now()-86400000),first_login_at:null})]};
      }
      if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1")){
        assert.match(sql,/IN \('unused','pending_claim'\) THEN \$5::timestamptz/,"first login must overwrite stale expiry");
        assert.ok(new Date(params[4]).getTime()>Date.now(),"first-login expiry must start from the current activation time");
        return {rows:[pendingVoucher({username:params[0],password:params[1],mac_address:params[2],first_login_at:params[3],expires_at:params[4],comment:params[5],status:"unused"})]};
      }
      throw new Error("Unexpected transactional query: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.rechargeHotspotUser=async payload=>{routerPayload=payload;return {username:payload.username};};
    const res=responseRecorder();
    await hotspotAuthController.activate({ip:"manual-unused-activation-test",body:{phone:"01712345678",mac:"aa-bb-cc-dd-ee-ff"}},res);
    assert.equal(res.statusCode,200,JSON.stringify(res.body));
    assert.equal(res.body.success,true);
    assert.equal(res.body.username,"AA:BB:CC:DD:EE:FF");
    assert.equal(routerPayload.username,"AA:BB:CC:DD:EE:FF");
    assert.equal(routerPayload.password,"AA:BB:CC:DD:EE:FF");
    assert.equal(routerPayload.profile,"1-Hour");
    assert.equal(routerPayload.macAddress,"AA:BB:CC:DD:EE:FF");
    assert.match(routerPayload.comment,/^Exp: \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    assert.ok(activationQuery);
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;
    mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;
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

test("the same MAC resolves and updates the phone when a customer changes SIM",async()=>{
  const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles,oldRecharge=mikrotik.rechargeHotspotUser,oldGetUser=mikrotik.getHotspotUser;
  let routerWrites=0,updatedPhone="";
  try{
    db.query=async sql=>{
      if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET status='active'"))return {rows:[{id:41,username:"AA:BB:CC:DD:EE:FF",status:"active",expires_at:new Date(Date.now()+3600000),transaction_id:5}]};
      throw new Error("Unexpected database query: "+sql);
    };
    db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
      if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
      if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[pendingVoucher({username:"AA:BB:CC:DD:EE:FF",mac_address:"AA:BB:CC:DD:EE:FF",phone:"01711111111",status:"unused",first_login_at:null,expires_at:new Date(Date.now()+3600000)})]};
      if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1,password=$2,mac_address=$3")){
        updatedPhone=params[6];
        return {rows:[pendingVoucher({id:41,username:params[0],password:params[1],mac_address:params[2],phone:params[6],first_login_at:params[3],expires_at:params[4],comment:params[5],status:"unused"})]};
      }
      throw new Error("Unexpected transactional query: "+sql);
    }});
    mikrotik.getHotspotProfiles=async()=>oneHourProfile();
    mikrotik.rechargeHotspotUser=async payload=>{routerWrites++;assert.equal(payload.username,"AA:BB:CC:DD:EE:FF");return {};};
    mikrotik.getHotspotUser=async()=>null;
    const res=responseRecorder();
    await hotspotAuthController.activate({ip:"same-mac-new-phone-test",body:{mac:"aa:bb:cc:dd:ee:ff",phone:"01712345678"}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.equal(res.body.phone,"01712345678");
    assert.equal(updatedPhone,"01712345678","the canonical voucher phone is updated to the submitted SIM");
    assert.equal(routerWrites,1,"the MAC-bound account is provisioned for the new phone");
  }finally{
    db.query=oldQuery;db.withTransaction=oldTransaction;
    mikrotik.getHotspotProfiles=oldProfiles;mikrotik.rechargeHotspotUser=oldRecharge;mikrotik.getHotspotUser=oldGetUser;
  }
});

test("All Hotspot Users is PostgreSQL-first and preserves offline and expired vouchers",async()=>{
  const oldQuery=db.query,oldSessions=mikrotik.getActiveHotspotSessions,oldRouterUsers=mikrotik.getHotspotUsers;
  let ledgerSql="",routerUserReads=0;
  const now=Date.now();
  try{
    db.query=async sql=>{
      if(sql.startsWith("UPDATE hotspot_vouchers SET status='expired'"))return {rows:[]};
      ledgerSql=sql;
      return {rows:[
        {id:1,username:"AA:BB:CC:DD:EE:01",status:"active",expires_at:new Date(now+3600000),mac_address:"AA:BB:CC:DD:EE:01",phone:"01711111111",profile:"1-Hour",price:10},
        {id:2,username:"AA:BB:CC:DD:EE:02",status:"active",expires_at:new Date(now+3600000),mac_address:"AA:BB:CC:DD:EE:02",phone:"01722222222",profile:"1-Hour",price:10},
        {id:3,username:"AA:BB:CC:DD:EE:03",status:"active",expires_at:new Date(now-1000),mac_address:"AA:BB:CC:DD:EE:03",phone:"01733333333",profile:"1-Hour",price:10}
      ]};
    };
    mikrotik.getActiveHotspotSessions=async()=>[{username:"AA:BB:CC:DD:EE:01",macAddress:"AA:BB:CC:DD:EE:01",address:"10.10.0.11",uptime:"2m",bytesIn:10,bytesOut:20},{username:"AA:BB:CC:DD:EE:02",macAddress:"AA:BB:CC:DD:EE:02",address:"",uptime:"1m",bytesIn:5,bytesOut:5}];
    mikrotik.getHotspotUsers=async()=>{routerUserReads++;throw new Error("The subscriber list must not depend on RouterOS user inventory");};
    hotspotController.invalidateListCache();
    const result=await hotspotController.refreshHotspotListCache();
    assert.match(ledgerSql,/FROM hotspot_vouchers WHERE LOWER\(COALESCE\(status,''\)\) <> 'archived'/);
    assert.equal(routerUserReads,0);
    assert.equal(result.users.length,3);
    assert.equal(result.users.find(row=>row.id===1).is_online,true);
    assert.equal(result.users.find(row=>row.id===2).is_online,false); 
    assert.equal(result.users.find(row=>row.id===1).ip,"10.10.0.11");
    assert.equal(result.users.find(row=>row.id===3).status,"expired");
  }finally{
    db.query=oldQuery;mikrotik.getActiveHotspotSessions=oldSessions;mikrotik.getHotspotUsers=oldRouterUsers;hotspotController.invalidateListCache();
  }
});

test("verifyTrx treats an absent or malformed phone as optional and proceeds to TrxID lookup",async()=>{
  const oldQuery=db.query;
  let lookedUp=false,lookupParams=[];
  try{
    db.query=async(sql,params=[])=>{if(sql.startsWith("SELECT * FROM transactions")){lookedUp=true;lookupParams=params;return {rows:[]};}throw new Error("Unexpected query: "+sql);};
    for(const phone of ["","12345",undefined]){
      lookedUp=false;lookupParams=[];
      const body={service_type:"hotspot",mac:"AA:BB:CC:DD:EE:FF",trxId:"TXN",amount:10,profile_id:"pkg-1-hour"};
      if(phone!==undefined)body.phone=phone;
      const res=responseRecorder();
      await paymentController.verifyTrx({ip:"optional-phone-test-"+String(phone),body},res);
      assert.equal(res.statusCode,404);
      assert.equal(res.body.code,"NOT_FOUND_OR_DELAYED");
      assert.equal(lookedUp,true,"verification should reach TrxID lookup without a phone");
      assert.deepEqual(lookupParams,["TXN"]);
    }
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


