"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const controller=require("../controllers/paymentController");
const notifications=require("../services/notificationDispatcher");

function responseRecorder(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function transaction(){return {id:77,trx_id:"TX-MANUAL-77",channel:"bkash",sender_phone:"01712345678",amount:10,status:"unmatched",used:false,matched_username:null};}
function metadata(){return {"1-Hour":{id:"pkg-1-hour",profile_id:"pkg-1-hour",price:10,validityValue:1,validityUnit:"hours",validityLabel:"1 Hour",limitBytesTotal:0}};}

test("manual Hotspot assignment atomically claims transaction, stages phone voucher, and notifies",async()=>{
 const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles,oldDispatch=notifications.dispatchNotification;
 const seen={claimSql:"",claimParams:[],voucherSql:"",voucherParams:[],finalSql:"",notices:[],routerWrites:0};
 try{
  db.query=async(sql,params=[])=>{
   if(sql.startsWith("SELECT * FROM transactions"))return {rows:[transaction()]};
   if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(metadata())}]};
   if(sql.startsWith("UPDATE transactions SET status='processing'")){seen.claimSql=sql;seen.claimParams=params;return {rows:[{id:77}]};}
   if(sql.startsWith("UPDATE transactions SET status='unmatched'"))return {rows:[{id:77}]};
   throw new Error("Unexpected database query: "+sql);
  };
  db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
   if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
   if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[]};
   if(sql.startsWith("INSERT INTO hotspot_vouchers")){seen.voucherSql=sql;seen.voucherParams=params;return {rows:[{id:31,username:params[0],profile:params[2],profile_id:params[9],validity:params[3],price:params[4],status:"pending_claim",phone:params[6],mac_address:params[10]}]};}
   if(sql.startsWith("UPDATE transactions SET status='processed'")){seen.finalSql=sql;return {rows:[{id:77}]};}
   throw new Error("Unexpected transactional query: "+sql);
  }});
  mikrotik.getHotspotProfiles=async()=>[{name:"1-Hour",sharedUsers:"1",sessionTimeout:"1h",raw:{}}];
  notifications.dispatchNotification=payload=>{seen.notices.push(payload);};
  const res=responseRecorder();
  await controller.manualMatch({body:{trxId:"TX-MANUAL-77",service_type:"hotspot",phone:"01712345678",package_id:"pkg-1-hour"},session:{userId:9}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.service_type,"hotspot");
  assert.equal(res.body.pending_activation,true);
  assert.match(seen.claimSql,/claim_flow='manual_hotspot'/);
  assert.equal(seen.claimParams[1],"01712345678");
  assert.match(seen.voucherSql,/VALUES.*'pending_claim'/);
  assert.equal(seen.voucherParams[2],"1-Hour");
  assert.equal(seen.voucherParams[4],10);
  assert.equal(seen.voucherParams[6],"01712345678");
  assert.equal(seen.voucherParams[10],null,"manual assignment does not invent a device MAC");
  assert.match(seen.finalSql,/status='processed'/);
  assert.equal(seen.notices.length,2);
  assert.equal(seen.routerWrites,0);
 }finally{
  db.query=oldQuery;db.withTransaction=oldTransaction;mikrotik.getHotspotProfiles=oldProfiles;notifications.dispatchNotification=oldDispatch;
 }
});

test("manual Hotspot assignment rejects a package whose price differs from the transaction",async()=>{
 const oldQuery=db.query,oldProfiles=mikrotik.getHotspotProfiles;
 let claimed=false;
 try{
  db.query=async(sql)=>{
   if(sql.startsWith("SELECT * FROM transactions"))return {rows:[transaction()]};
   if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify({"1-Hour":{...metadata()["1-Hour"],price:15}})}]};
   if(sql.startsWith("UPDATE transactions SET status='processing'")){claimed=true;return {rows:[{id:77}]};}
   throw new Error("Unexpected query: "+sql);
  };
  mikrotik.getHotspotProfiles=async()=>[{name:"1-Hour",sharedUsers:"1",sessionTimeout:"1h",raw:{}}];
  const res=responseRecorder();
  await controller.manualMatch({body:{trxId:"TX-MANUAL-77",service_type:"hotspot",phone:"01712345678",package_id:"pkg-1-hour",amount:15}},res);
  assert.equal(res.statusCode,400);
  assert.equal(res.body.success,false);
  assert.equal(claimed,false,"price validation must occur before claiming the transaction");
 }finally{db.query=oldQuery;mikrotik.getHotspotProfiles=oldProfiles;}
});

test("manual match modal exposes PPPoE and Hotspot fields and sends service_type",()=>{
 const fs=require("node:fs");
 const source=fs.readFileSync(require("node:path").join(__dirname,"../views/admin.ejs"),"utf8");
 assert.match(source,/manualMatchTypePppoe/);
 assert.match(source,/manualMatchTypeHotspot/);
 assert.match(source,/manualMatchPhone/);
 assert.match(source,/manualMatchPackage/);
 assert.match(source,/service_type: serviceType/);
 assert.match(source,/\/api\/hotspot\/profiles/);
});
