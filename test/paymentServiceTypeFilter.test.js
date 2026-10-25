"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const db=require("../db");
const controller=require("../controllers/paymentController");

function responseRecorder(){
 return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}

async function runList(serviceType){
 const originalQuery=db.query,calls=[];
 try{
  db.query=async(sql,params=[])=>{
   calls.push({sql,params});
   if(sql.startsWith("SELECT COUNT(*)"))return {rows:[{count:1}]};
   if(sql.startsWith("SELECT t.*"))return {rows:[{id:1,service_type:serviceType||null}]};
   if(sql.startsWith("SELECT COALESCE(SUM(t.amount)"))return {rows:[{total_received:"50",total_transactions:1,unmatched_count:0}]};
   throw new Error("Unexpected payment list query: "+sql);
  };
  const res=responseRecorder();
  await controller.list({query:serviceType===undefined?{}:{service_type:serviceType}},res);
  return {res,calls};
 }finally{db.query=originalQuery;}
}

test("PPPoE filter includes service type and linked PPPoE accounts in count, rows and summary",async()=>{
 const {res,calls}=await runList("pppoe");
 assert.equal(res.statusCode,200);
 assert.equal(res.body.service_type,"pppoe");
 assert.match(calls[0].sql,/pppoe_users/);
 assert.deepEqual(calls[0].params,[]);
 assert.match(calls[1].sql,/pppoe_users/);
 assert.deepEqual(calls[1].params,[50,0]);
 assert.match(calls[2].sql,/pppoe_users/);
 assert.deepEqual(calls[2].params,[]);
});

test("Hotspot filter includes explicit type, scratch transactions and voucher-linked MAC/PIN records",async()=>{
 const {res,calls}=await runList("hotspot");
 assert.equal(res.statusCode,200);
 assert.equal(res.body.service_type,"hotspot");
 assert.ok(calls.every(call=>call.sql.includes("hotspot_voucher_payments")));
 assert.ok(calls.every(call=>call.sql.includes("hotspot_vouchers")));
 assert.ok(calls.every(call=>call.params.length===0));
});

test("All Payments remains unfiltered and keeps existing pagination",async()=>{
 const {res,calls}=await runList(undefined);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.service_type,"all");
 assert.ok(!calls[0].sql.includes("service_type"));
 assert.ok(!calls[2].sql.includes("service_type"));
 assert.deepEqual(calls[0].params,[]);
 assert.deepEqual(calls[1].params,[50,0]);
 assert.deepEqual(calls[2].params,[]);
});

test("unknown service_type is rejected before querying transactions",async()=>{
 const originalQuery=db.query;
 let queried=false;
 try{
  db.query=async()=>{queried=true;throw new Error("Database must not be queried for invalid filter");};
  const res=responseRecorder();
  await controller.list({query:{service_type:"legacy"}},res);
  assert.equal(res.statusCode,400);
  assert.match(res.body.error,/Invalid payment service_type filter/);
  assert.equal(queried,false);
 }finally{db.query=originalQuery;}
});

test("Payments submenu and SPA route preserve dedicated service filters without page reload",()=>{
 const admin=fs.readFileSync(path.join(__dirname,"../views/admin.ejs"),"utf8");
 assert.match(admin,/href="\/admin\/payments\/pppoe"[\s\S]*?PPPoE Payments/);
 assert.match(admin,/href="\/admin\/payments\/hotspot"[\s\S]*?Hotspot Payments/);
 assert.match(admin,/'\/admin\/payments\/pppoe': \{ view: 'payments',[^\n]*serviceType: 'pppoe' \}/);
 assert.match(admin,/'\/admin\/payments\/hotspot': \{ view: 'payments',[^\n]*serviceType: 'hotspot' \}/);
 assert.match(admin,/loadPaymentsSection\(gatewayType, titleKey, serviceType = ''\)/);
 assert.match(admin,/serviceQuery = currentPaymentServiceType \? '&service_type='/);
 assert.match(admin,/callIfAvailable\('loadPaymentsSection', \[r\.filter, r\.title, r\.serviceType \|\| ''\]\)/);
});

test("Customer type resolution never emits Unknown and prioritizes Hotspot evidence",async()=>{
 const {calls}=await runList(undefined);
 const sql=calls.find(call=>call.sql.startsWith("SELECT t.*")).sql;
 assert.ok(sql.includes("COALESCE(t.service_type,'')='hotspot'"));
 assert.ok(sql.includes("SCRATCH-%"));
 assert.ok(sql.includes("hotspot_voucher_payments hvp WHERE hvp.transaction_id=t.id"));
 assert.ok(sql.includes("hotspot_vouchers hv WHERE"));
 assert.ok(sql.includes("hv.mac_address"));
 assert.ok(sql.includes("hv.password"));
 assert.ok(sql.includes("THEN 'unassigned' END AS customer_type"));
 assert.ok(!sql.includes("THEN 'unknown'"));
});

test("PPPoE filter includes pppoe_users/customers matches when service_type is absent",async()=>{
 const {calls}=await runList("pppoe");
 const sql=calls.find(call=>call.sql.startsWith("SELECT t.*")).sql;
 assert.ok(sql.includes("pppoe_users"));
 assert.ok(sql.includes("customers cu"));
});

test("Customer type badge has dedicated Hotspot color and safely falls back to Unassigned",()=>{
 const admin=fs.readFileSync(path.join(__dirname,"../views/admin.ejs"),"utf8");
 assert.ok(admin.includes("includes(requestedType) ? requestedType : 'unassigned'"));
 assert.ok(admin.includes("hotspot: 'bg-success'"));
 assert.ok(!admin.includes("classes.unknown"));
});
