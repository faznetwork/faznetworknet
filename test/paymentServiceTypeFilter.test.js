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

test("PPPoE payment API filter applies to count, rows and summary",async()=>{
 const {res,calls}=await runList("pppoe");
 assert.equal(res.statusCode,200);
 assert.equal(res.body.service_type,"pppoe");
 assert.match(calls[0].sql,/COALESCE\(t\.service_type,''\).*\$1/);
 assert.deepEqual(calls[0].params,["pppoe"]);
 assert.match(calls[1].sql,/COALESCE\(t\.service_type,''\).*\$1/);
 assert.deepEqual(calls[1].params,["pppoe",50,0]);
 assert.match(calls[2].sql,/COALESCE\(t\.service_type,''\).*\$1/);
 assert.deepEqual(calls[2].params,["pppoe"]);
});

test("Hotspot payment API filter applies only the Hotspot service type",async()=>{
 const {res,calls}=await runList("hotspot");
 assert.equal(res.statusCode,200);
 assert.equal(res.body.service_type,"hotspot");
 assert.ok(calls.every(call=>call.sql.includes("service_type")));
 assert.ok(calls.every(call=>call.params[0]==="hotspot"));
});

test("All Payments remains unfiltered and keeps existing pagination",async()=>{
 const {res,calls}=await runList(undefined);
 assert.equal(res.statusCode,200);
 assert.equal(res.body.service_type,"all");
 assert.ok(calls.every(call=>!call.sql.includes("service_type")));
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
