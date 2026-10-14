"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const paymentController=require("../controllers/paymentController");
const smsService=require("../services/smsService");
function responseRecorder(){return{statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

test("reference webhook renews only an active PPPoE reference and finalizes as matched",async()=>{
 const originalQuery=db.query,originalTransaction=db.withTransaction,originalUpdateSecret=mikrotik.updateSecret,originalKick=mikrotik.kickActiveUser,originalSms=smsService.sendNotification;
 let claimSql="",finalSql="",pppoeLookupSql="";
 try{
  db.query=async(sql,params=[])=>{
   if(sql.includes("personal_payment_webhook_enabled"))return{rows:[{key:"personal_payment_webhook_enabled",value:"true"},{key:"personal_payment_webhook_secret",value:"secret"},{key:"mfs_bkash_number",value:""},{key:"mfs_nagad_number",value:""},{key:"mfs_rocket_number",value:""},{key:"mfs_upay_number",value:""}]};
   if(sql.startsWith("SELECT id,status,used FROM transactions"))return{rows:[]};
   if(sql.includes("FROM pppoe_users WHERE (LOWER(username)")){pppoeLookupSql=sql;assert.equal(params[0],"10006");return{rows:[{username:"10006"}]};}
   if(sql.includes("FROM customers c LEFT JOIN packages"))return{rows:[{id:9,username:"10006",full_name:"Test PPPoE",phone:"01712345678",password:"pw",plan_name:"Basic",profile_name:"basic",pool_name:"pool1",price:50,duration_months:1}]};
   if(sql.includes("key='billing_cycle_type'"))return{rows:[]};
   if(sql.startsWith("INSERT INTO transactions")&&sql.includes("'processing'")){claimSql=sql;return{rows:[{id:501}]};}
   throw new Error("Unexpected webhook SQL: "+sql);
  };
  db.withTransaction=async callback=>callback({query:async(sql)=>{if(sql.startsWith("UPDATE transactions SET status='matched'")){finalSql=sql;return{rows:[{id:501}]};}if(sql.startsWith("UPDATE customers")||sql.startsWith("UPDATE pppoe_users"))return{rows:[]};throw new Error("Unexpected transaction SQL: "+sql);}});
  mikrotik.updateSecret=async()=>({success:true});mikrotik.kickActiveUser=async()=>({success:true});smsService.sendNotification=async()=>({success:true});
  const req={body:{sender:"bKash",message:"You have received Tk 50.00 from 01712345678. Ref: 10006 TrxID ABC12345 at 14/10/2026 03:30"},query:{},headers:{},get:name=>name==="x-webhook-token"?"secret":""};
  const res=responseRecorder();await paymentController.webhook(req,res);
  assert.equal(res.statusCode,200);assert.equal(res.body.status,"matched");assert.equal(res.body.customer_type,"PPPoE");assert.equal(res.body.matched_username,"10006");
  assert.match(pppoeLookupSql,/COALESCE\(disabled,false\)=false/);assert.match(claimSql,/customer_type/);assert.match(finalSql,/status='matched'/);
 }finally{db.query=originalQuery;db.withTransaction=originalTransaction;mikrotik.updateSecret=originalUpdateSecret;mikrotik.kickActiveUser=originalKick;smsService.sendNotification=originalSms;}
});

test("webhook does not use sender phone to auto-match a PPPoE customer when reference is absent",async()=>{
 const originalQuery=db.query;let insertedSql="";
 try{
  db.query=async(sql)=>{
   if(sql.includes("personal_payment_webhook_enabled"))return{rows:[{key:"personal_payment_webhook_enabled",value:"true"},{key:"personal_payment_webhook_secret",value:"secret"},{key:"mfs_bkash_number",value:""},{key:"mfs_nagad_number",value:""},{key:"mfs_rocket_number",value:""},{key:"mfs_upay_number",value:""}]};
   if(sql.startsWith("SELECT id,status,used FROM transactions"))return{rows:[]};
   if(sql.includes("FROM pppoe_users"))throw new Error("Webhook must not use sender phone for PPPoE matching");
   if(sql.startsWith("INSERT INTO transactions")){insertedSql=sql;return{rows:[{id:502}]};}
   throw new Error("Unexpected webhook SQL: "+sql);
  };
  const req={body:{sender:"bKash",message:"You have received Tk 50.00 from 01712345678 TrxID ABC12346 at 14/10/2026 03:30"},query:{},headers:{},get:name=>name==="x-webhook-token"?"secret":""};
  const res=responseRecorder();await paymentController.webhook(req,res);
  assert.equal(res.statusCode,200);assert.equal(res.body.status,"unmatched");assert.equal(res.body.customer_type,null);assert.match(insertedSql,/customer_type/);
 }finally{db.query=originalQuery;}
});

test("Hotspot TrxID verification uses ledger sender phone as login seed and never queries PPPoE",async()=>{
 const originalQuery=db.query,originalTransaction=db.withTransaction,originalProfiles=mikrotik.getHotspotProfiles,originalUpdateProfile=mikrotik.updateHotspotProfile,originalRecharge=mikrotik.rechargeHotspotUser;
 let claimSql="",recharge=null;
 try{
  db.query=async(sql,params=[])=>{
   if(sql.includes("FROM pppoe_users"))throw new Error("Hotspot verification must not query PPPoE");
   if(sql.includes("SELECT * FROM transactions")){assert.match(sql,/customer_type IS NULL OR LOWER\(TRIM\(customer_type\)\) = 'hotspot'/);return{rows:[{id:601,trx_id:"HOTSPOT601",sender_phone:"01712345678",amount:10,used:false,status:"unmatched",customer_type:null,channel:"bkash"}]};}
   if(sql.includes("key='hotspot_profile_metadata'"))return{rows:[{value:JSON.stringify({"1-Hour":{price:10,validityValue:1,validityUnit:"hours",limitBytesTotal:0}})}]};
   if(sql.startsWith("UPDATE transactions")&&sql.includes("SET used=true,status='processing'")){claimSql=sql;return{rows:[{id:601}]};}
   if(sql.startsWith("UPDATE hotspot_vouchers"))return{rows:[]};
   if(sql.startsWith("INSERT INTO hotspot_vouchers"))return{rows:[{id:1}]};
   throw new Error("Unexpected Hotspot SQL: "+sql);
  };
  db.withTransaction=async callback=>callback({query:async(sql)=>{if(sql.startsWith("UPDATE transactions SET status='processed'"))return{rows:[{id:601}]};throw new Error("Unexpected transaction SQL: "+sql);}});
  mikrotik.getHotspotProfiles=async()=>[{name:"1-Hour",sessionTimeout:"1h",sharedUsers:1,raw:{}}];
  mikrotik.updateHotspotProfile=async()=>({success:true});
  mikrotik.rechargeHotspotUser=async(payload)=>{recharge=payload;return{username:payload.username};};
  const res=responseRecorder();await paymentController.verifyTrx({ip:"dual-path-hotspot-test",body:{trxId:"HOTSPOT601",profileName:"1-Hour"},query:{}},res);
  assert.equal(res.statusCode,200);assert.equal(res.body.customer_type,"Hotspot");assert.equal(res.body.username,"01712345678");assert.equal(recharge.username,"01712345678");assert.match(claimSql,/customer_type='Hotspot'/);
 }finally{db.query=originalQuery;db.withTransaction=originalTransaction;mikrotik.getHotspotProfiles=originalProfiles;mikrotik.updateHotspotProfile=originalUpdateProfile;mikrotik.rechargeHotspotUser=originalRecharge;}
});

test("the explicit PPPoE portal TrxID endpoint is wired to logged-in customer renewal",()=>{
 const routes=require("../routes/paymentRoutes");
 const selfCare=require("../controllers/customerSelfCareController");
 const route=routes.stack.find(layer=>layer.route&&layer.route.path==="/portal/verify-trx");
 assert.ok(route,"/api/portal/verify-trx route should exist under the /api mount");
 assert.equal(route.route.methods.post,true);
 assert.equal(route.route.stack[0].handle,selfCare.renew);
});
