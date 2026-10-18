"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const controller=require("../controllers/paymentController");

function responseRecorder(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}
function tx(overrides={}){return {id:501,trx_id:"FORCE-TX-501",channel:"bkash",amount:10,status:"unmatched",used:false,sender_phone:"01712345678",matched_username:null,claim_flow:null,sale_type:null,...overrides};}
function profileMetadata(price=10){return {"1-Hour":{id:"pkg-1-hour",profile_id:"pkg-1-hour",price,validityValue:1,validityUnit:"hours",validityLabel:"1 Hour",limitBytesTotal:0}};}

test("force provision claims payment, stages voucher, and immediately provisions normalized MAC",async()=>{
 const oldQuery=db.query,oldTransaction=db.withTransaction,oldProfiles=mikrotik.getHotspotProfiles,oldProvision=mikrotik.forceProvisionHotspotUser;
 const seen={claim:null,stage:null,association:null,finalize:null,router:null,clientQueries:[]};
 try{
  db.query=async(sql,params=[])=>{
   if(sql.startsWith("SELECT * FROM transactions"))return {rows:[tx()]};
   if(sql.startsWith("SELECT username FROM pppoe_users"))return {rows:[]};
   if(sql.startsWith("SELECT username FROM customers"))return {rows:[]};
   if(sql.startsWith("SELECT hp.voucher_id,v.* FROM hotspot_voucher_payments"))return {rows:[]};
   if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata())}]};
   if(sql.startsWith("UPDATE transactions SET status='processing'")){seen.claim={sql,params};return {rows:[{id:501}]};}
   if(sql.startsWith("UPDATE hotspot_vouchers SET username=$1,password=$1,mac_address=$1,status='active'"))return {rows:[{id:61,username:params[0],profile:params[1],status:"active",mac_address:params[0],expires_at:params[3],transaction_id:501}]};
   if(sql.startsWith("UPDATE transactions SET status=CASE")){seen.finalize={sql,params};return {rows:[{id:501,status:"processed"}]};}
   if(sql.startsWith("UPDATE transactions SET needs_reconciliation=true"))return {rows:[]};
   throw new Error("Unexpected db.query: "+sql);
  };
  db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
   seen.clientQueries.push(sql);
   if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
   if(sql.startsWith("SELECT hp.voucher_id,v.* FROM hotspot_voucher_payments"))return {rows:[]};
   if(sql.startsWith("SELECT * FROM hotspot_vouchers WHERE")){assert.match(sql,/\$1::text/);assert.match(sql,/\$2::text/);return {rows:[]};}
   if(sql.startsWith("INSERT INTO hotspot_vouchers")){seen.stage={sql,params};return {rows:[{id:61,username:params[0],profile:params[1],status:"pending_claim",mac_address:params[0],transaction_id:501,server:"all"}]};}
   if(sql.startsWith("INSERT INTO hotspot_voucher_payments")){seen.association={sql,params};return {rows:[]};}
   throw new Error("Unexpected transactional query: "+sql);
  }});
  mikrotik.getHotspotProfiles=async()=>[{name:"1-Hour",sessionTimeout:"1h",sharedUsers:"1",raw:{}}];
  mikrotik.forceProvisionHotspotUser=async payload=>{seen.router=payload;return {username:payload.macAddress,created:true};};
  const res=responseRecorder();
  await controller.forceProvisionHotspot({body:{trxId:"force-tx-501",mac:"aa-bb-cc-dd-ee-ff",phone:"01712345678",package_id:"pkg-1-hour"},session:{userId:9}},res);
  assert.equal(res.statusCode,200,JSON.stringify(res.body));
  assert.equal(res.body.success,true);
  assert.equal(res.body.status,"processed");
  assert.equal(res.body.mac,"AA:BB:CC:DD:EE:FF");
  assert.equal(seen.claim.params[1],"AA:BB:CC:DD:EE:FF");
  assert.match(seen.stage.sql,/'pending_claim'/);
  assert.equal(seen.stage.params[0],"AA:BB:CC:DD:EE:FF");
  assert.equal(seen.stage.params[1],"1-Hour");
  assert.equal(seen.association.params[0],501);
  assert.equal(seen.router.macAddress,"AA:BB:CC:DD:EE:FF");
  assert.equal(seen.router.profile,"1-Hour");
  assert.equal(seen.router.resetCounters,true);
  assert.match(seen.finalize.sql,/LOWER\(status\) IN \('processing','processed','paid'\)/);
 }finally{
  db.query=oldQuery;db.withTransaction=oldTransaction;mikrotik.getHotspotProfiles=oldProfiles;mikrotik.forceProvisionHotspotUser=oldProvision;
 }
});

test("force provision rejects mismatched package price before claiming transaction",async()=>{
 const oldQuery=db.query,oldProfiles=mikrotik.getHotspotProfiles;
 let claimAttempted=false;
 try{
  db.query=async(sql)=>{
   if(sql.startsWith("SELECT * FROM transactions"))return {rows:[tx()]};
   if(sql.startsWith("SELECT username FROM pppoe_users"))return {rows:[]};
   if(sql.startsWith("SELECT hp.voucher_id,v.* FROM hotspot_voucher_payments"))return {rows:[]};
   if(sql.includes("key='hotspot_profile_metadata'"))return {rows:[{value:JSON.stringify(profileMetadata(15))}]};
   if(sql.startsWith("UPDATE transactions SET status='processing'")){claimAttempted=true;return {rows:[{id:501}]};}
   throw new Error("Unexpected db.query: "+sql);
  };
  mikrotik.getHotspotProfiles=async()=>[{name:"1-Hour",sessionTimeout:"1h",raw:{}}];
  const res=responseRecorder();
  await controller.forceProvisionHotspot({body:{trxId:"FORCE-TX-501",mac:"AA:BB:CC:DD:EE:FF",package_id:"pkg-1-hour"}},res);
  assert.equal(res.statusCode,400);
  assert.equal(res.body.code,"AMOUNT_MISMATCH");
  assert.equal(claimAttempted,false);
 }finally{db.query=oldQuery;mikrotik.getHotspotProfiles=oldProfiles;}
});

test("All Payments renders the Force Provision action and admin-only route is wired",async()=>{
 const admin=fs.readFileSync(path.join(__dirname,"../views/admin.ejs"),"utf8");
 const routes=fs.readFileSync(path.join(__dirname,"../routes/paymentRoutes.js"),"utf8");
 const service=fs.readFileSync(path.join(__dirname,"../services/mikrotikService.js"),"utf8");
 assert.match(admin,/data-force-provision-trx/);
 assert.match(admin,/Force Provision Hotspot/);
 assert.match(admin,/\/api\/payments\/force-provision/);
 assert.match(routes,/router\.post\("\/payments\/force-provision",requireAdmin,requireRole\(\["super_admin","admin"\]\),controller\.forceProvisionHotspot\)/);
 assert.match(service,/async forceProvisionHotspotUser\(data\)/);
});


test("payment and Hotspot auth SQL never mix inferred and explicitly cast types for one placeholder",()=>{
 const files=["../controllers/paymentController.js","../controllers/hotspotAuthController.js"];
 const castTypes="text|varchar|character varying|numeric|int|integer|bigint|date|timestamp(?:tz)?|boolean|jsonb";
 const queryCall=/(?:db|client|database)\.query\(\s*"((?:\\.|[^"\\])*)"/gs;
 for(const file of files){
  const source=fs.readFileSync(path.join(__dirname,file),"utf8");
  let match;
  while((match=queryCall.exec(source))){
   const sql=match[1].replace(/\\"/g,'"');
   if(!/\$\d/.test(sql))continue;
   const placeholders=[...sql.matchAll(new RegExp("\\$(\\d+)(?:::(("+castTypes+")))?","gi"))];
   const numbers=[...new Set(placeholders.map(item=>item[1]))];
   for(const number of numbers){
    const types=placeholders.filter(item=>item[1]===number).map(item=>(item[2]||"inferred").toLowerCase());
    assert.equal(new Set(types).size,1, file+" has mixed PostgreSQL types for $"+number+": "+sql);
   }
  }
 }
});

test("force provision casts repeated validity placeholder consistently as text",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../controllers/paymentController.js"),"utf8");
 const update=source.match(/UPDATE hotspot_vouchers SET username=\$1::text,password=\$1::text,profile=\$2::text,validity=\$3::text[\s\S]*?WHERE id=\$13::bigint/);
 const insert=source.match(/INSERT INTO hotspot_vouchers\([\s\S]*?VALUES\(\$1::text,\$1::text,\$2::text,\$3::text,\$4::numeric[\s\S]*?NULLIF\(\$3::text,''\)/);
 assert.ok(update,"Force Provision UPDATE must type the repeated validity placeholder consistently");
 assert.ok(insert,"Force Provision INSERT must type the repeated validity placeholder consistently");
});
