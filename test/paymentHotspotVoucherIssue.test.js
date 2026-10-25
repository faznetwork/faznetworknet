"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const controller=require("../controllers/paymentController");
const generator=require("../services/hotspotVoucherGenerator");

function responseRecorder(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function payment(overrides={}){return {id:901,trx_id:"HOTSPOT-ISSUE-901",channel:"bkash",amount:10,status:"unmatched",used:false,service_type:"hotspot",sender_phone:"01712345678",matched_username:null,...overrides};}
function profileMap(price=10){return {"1-Hour":{id:"pkg-1-hour",profile_id:"pkg-1-hour",price,validityValue:1,validityUnit:"hours",validityLabel:"1 Hour",limitBytesTotal:0}};}

test("unmatched Hotspot payment issues a branded voucher PIN and atomically associates it with the transaction",async()=>{
 const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles;
 const seen={voucherInsert:null,association:null,finalize:null};
 try{
  db.query=async(sql,params=[])=>{
   if(sql.startsWith("SELECT * FROM transactions WHERE UPPER(TRIM(trx_id))"))return {rows:[payment()]};
   if(sql.startsWith("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMap())}]};
   throw new Error("Unexpected db.query: "+sql);
  };
  db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
   if(sql.startsWith("SELECT * FROM transactions WHERE id=$1::bigint FOR UPDATE"))return {rows:[payment()]};
   if(sql.startsWith("SELECT voucher_id FROM hotspot_voucher_payments"))return {rows:[]};
   if(sql.startsWith("INSERT INTO hotspot_vouchers")){seen.voucherInsert={sql,params};return {rows:[{id:92,username:params[0],password:params[1],profile:params[2],validity:params[3],price:params[4],status:"unused",transaction_id:params[8]}]};}
   if(sql.startsWith("INSERT INTO hotspot_voucher_payments")){seen.association={sql,params};return {rows:[]};}
   if(sql.startsWith("UPDATE transactions SET status='processed'")){seen.finalize={sql,params};return {rows:[{id:901,status:"processed",matched_username:params[0]}]};}
   throw new Error("Unexpected transaction query: "+sql);
  }});
  mikrotik.getHotspotProfiles=async()=>[{name:"1-Hour",sessionTimeout:"1h",sharedUsers:"1",raw:{}}];
  const res=responseRecorder();
  await controller.forceProvisionHotspot({body:{mode:"issue_voucher",trxId:"hotspot-issue-901",package_id:"pkg-1-hour"},session:{userId:9}},res);
  assert.equal(res.statusCode,201,JSON.stringify(res.body));
  assert.equal(res.body.success,true);
  assert.equal(res.body.status,"processed");
  assert.equal(res.body.profile,"1-Hour");
  assert.match(res.body.voucherPin,/^[A-Z0-9]{8}$/);
  assert.equal(res.body.voucher.username,res.body.voucherPin);
  assert.equal(res.body.voucher.password,res.body.voucherPin,"single-PIN voucher must use the PIN as the login password too");
  assert.equal(seen.voucherInsert.params[2],"1-Hour");
  assert.equal(Number(seen.voucherInsert.params[4]),10);
  assert.equal(Number(seen.voucherInsert.params[8]),901);
  assert.equal(seen.association.params[0],901);
  assert.equal(seen.association.params[1],92);
  assert.equal(seen.association.params[2],"01712345678");
  assert.equal(seen.finalize.params[0],res.body.voucherPin);
  assert.match(seen.finalize.sql,/status='processed'/);
  assert.match(seen.finalize.sql,/matched_username=\$1::text/);
 }finally{db.query=oldQuery;db.withTransaction=oldTransaction;mikrotik.getHotspotProfiles=oldProfiles;}
});

test("voucher issuance rejects processed payments and does not create another voucher",async()=>{
 const oldQuery=db.query,oldProfiles=mikrotik.getHotspotProfiles;
 let generationCalls=0;
 const oldGenerate=generator.generateVoucherBatch;
 try{
  db.query=async(sql)=>sql.startsWith("SELECT * FROM transactions WHERE UPPER(TRIM(trx_id))")?{rows:[payment({status:"processed",used:true})]}:(()=>{throw new Error("Unexpected query: "+sql)})();
  mikrotik.getHotspotProfiles=async()=>{generationCalls++;return [{name:"1-Hour"}];};
  generator.generateVoucherBatch=async()=>{generationCalls++;throw new Error("must not generate");};
  const res=responseRecorder();
  await controller.forceProvisionHotspot({body:{mode:"issue_voucher",trxId:"HOTSPOT-ISSUE-901",package_id:"pkg-1-hour"}},res);
  assert.equal(res.statusCode,409);
  assert.equal(res.body.code,"TRANSACTION_NOT_ELIGIBLE");
  assert.equal(generationCalls,0);
 }finally{db.query=oldQuery;mikrotik.getHotspotProfiles=oldProfiles;generator.generateVoucherBatch=oldGenerate;}
});

test("voucher issuance rejects a package whose price differs from the payment",async()=>{
 const oldQuery=db.query,oldProfiles=mikrotik.getHotspotProfiles;
 try{
  db.query=async(sql)=> {
   if(sql.startsWith("SELECT * FROM transactions WHERE UPPER(TRIM(trx_id))"))return {rows:[payment()]};
   if(sql.startsWith("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMap(12))}]};
   throw new Error("Unexpected query: "+sql);
  };
  mikrotik.getHotspotProfiles=async()=>[{name:"1-Hour",sessionTimeout:"1h",raw:{}}];
  const res=responseRecorder();
  await controller.forceProvisionHotspot({body:{mode:"issue_voucher",trxId:"HOTSPOT-ISSUE-901",package_id:"pkg-1-hour"}},res);
  assert.equal(res.statusCode,400);
  assert.equal(res.body.code,"AMOUNT_MISMATCH");
 }finally{db.query=oldQuery;mikrotik.getHotspotProfiles=oldProfiles;}
});

test("payment ledger hides Force Provision for processed rows and modal has no MAC field",()=>{
 const admin=fs.readFileSync(path.join(__dirname,"../views/admin.ejs"),"utf8");
 const controllerSource=fs.readFileSync(path.join(__dirname,"../controllers/paymentController.js"),"utf8");
 const hotspotSource=fs.readFileSync(path.join(__dirname,"../controllers/hotspotController.js"),"utf8");
 const generatorSource=fs.readFileSync(path.join(__dirname,"../services/hotspotVoucherGenerator.js"),"utf8");
 assert.match(admin,/const canForceProvision = status === 'unmatched'/);
 assert.match(admin,/Generate &amp; Issue Voucher/);
 assert.match(admin,/id="copyIssuedVoucherPin"/);
 assert.match(admin,/id="printIssuedVoucher"/);
 assert.doesNotMatch(admin,/id="forceProvisionMac"/);
 assert.match(controllerSource,/hotspotVoucherGenerator\.generateVoucherBatch/);
 assert.match(controllerSource,/matched_username=\$1::text/);
 assert.match(hotspotSource,/hotspotVoucherGenerator\.generateVoucherBatch/);
 assert.match(generatorSource,/randomPin\(charLength\)/);
});
