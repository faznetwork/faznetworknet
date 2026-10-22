"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../db");
const controller=require("../controllers/smsHistoryController");
test("SMS history validates date filters and bounds pagination",()=>{
 assert.equal(controller.validDate("2026-10-23","start"),"2026-10-23");
 assert.equal(controller.validDate("","start"),null);
 assert.throws(()=>controller.validDate("2026-02-31","start"),/Invalid start date/);
 assert.equal(controller.boundedInt("999",25,1,100),100);
 assert.equal(controller.boundedInt("-2",25,1,100),1);
 assert.equal(controller.boundedInt("nope",25,1,100),25);
});
test("SMS history API applies filters, returns status totals, and never interpolates search input",async()=>{
 const original=db.query,calls=[];
 db.query=async(sql,params)=>{calls.push({sql,params});if(sql.includes("COUNT(*)"))return {rows:[{total:1,sent:1,failed:0,skipped:0}]};return {rows:[{id:8,recipient_phone:"01712345678",message:"Hello",event_key:"manual",status:"sent"}]};};
 const req={query:{search:"0171%_ OR true",status:"sent",event:"manual",from:"2026-10-01",to:"2026-10-23",limit:"200",offset:"-5"}};
 const headers={};const res={statusCode:200,status(n){this.statusCode=n;return this;},set(k,v){headers[k]=v;return this;},json(body){this.body=body;return this;}};
 try{
  await controller.list(req,res);
  assert.equal(res.statusCode,200);assert.equal(headers["Cache-Control"],"no-store");
  assert.equal(res.body.total,1);assert.equal(res.body.stats.sent,1);assert.equal(res.body.logs[0].recipient_phone,"01712345678");
  assert.equal(calls[0].params[0],"%0171%_ OR true%");assert.equal(calls[0].params[1],"sent");assert.equal(calls[1].params.at(-2),100);assert.equal(calls[1].params.at(-1),0);
  assert.match(calls[0].sql,/recipient_phone ILIKE \$1 OR message ILIKE \$1/);
 }finally{db.query=original;}
});
test("SMS history rejects unsupported filters without querying database",async()=>{
 const original=db.query;let queried=false;db.query=async()=>{queried=true;return {rows:[]};};
 const res={statusCode:200,status(n){this.statusCode=n;return this;},set(){return this;},json(body){this.body=body;return this;}};
 try{await controller.list({query:{status:"sent; DROP TABLE sms_delivery_logs"}},res);assert.equal(res.statusCode,400);assert.equal(queried,false);}
 finally{db.query=original;}
});
