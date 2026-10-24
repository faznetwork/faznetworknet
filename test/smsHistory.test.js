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
 const req={query:{userType:"pppoe",search:"0171%_ OR true",status:"sent",event:"manual",from:"2026-10-01",to:"2026-10-23",limit:"200",offset:"-5"}};
 const headers={};const res={statusCode:200,status(n){this.statusCode=n;return this;},set(k,v){headers[k]=v;return this;},json(body){this.body=body;return this;}};
 try{
  await controller.list(req,res);
  assert.equal(res.statusCode,200);assert.equal(headers["Cache-Control"],"no-store");
  assert.equal(res.body.total,1);assert.equal(res.body.stats.sent,1);assert.equal(res.body.logs[0].recipient_phone,"01712345678");
  assert.equal(calls[0].params[0],"pppoe");assert.equal(calls[0].params[1],"%0171%_ OR true%");assert.equal(calls[0].params[2],"sent");assert.equal(calls[1].params.at(-2),100);assert.equal(calls[1].params.at(-1),0);
  assert.match(calls[0].sql,/user_type=\$1/);assert.match(calls[0].sql,/recipient_phone ILIKE \$2 OR message ILIKE \$2/);
 }finally{db.query=original;}
});
test("SMS history rejects unsupported filters without querying database",async()=>{
 const original=db.query;let queried=false;db.query=async()=>{queried=true;return {rows:[]};};
 const res={statusCode:200,status(n){this.statusCode=n;return this;},set(){return this;},json(body){this.body=body;return this;}};
 try{await controller.list({query:{status:"sent; DROP TABLE sms_delivery_logs"}},res);assert.equal(res.statusCode,400);assert.equal(queried,false);}
 finally{db.query=original;}
});

test("PPPoE filter excludes unclassified legacy rows",async()=>{
 const original=db.query,calls=[];
 db.query=async(sql,params)=>{calls.push({sql,params});if(sql.includes("COUNT(*)"))return {rows:[{total:1,sent:1,failed:0,skipped:0}]};return {rows:[{id:2,user_type:"pppoe",status:"sent"}]};};
 const res={statusCode:200,status(n){this.statusCode=n;return this;},set(){return this;},json(body){this.body=body;return this;}};
 try{await controller.list({query:{userType:"pppoe"}},res);assert.equal(res.statusCode,200);assert.ok(calls[0].sql.includes("user_type=$1"));assert.equal(calls[0].sql.includes("user_type IS NULL"),false);assert.equal(res.body.logs[0].user_type,"pppoe");}
 finally{db.query=original;}
});
test("All and Unclassified customer type filters have distinct SQL scope",async()=>{
 const original=db.query;
 const run=async(userType)=>{const calls=[];db.query=async(sql,params)=>{calls.push({sql,params});if(sql.includes("COUNT(*)"))return {rows:[{total:0,sent:0,failed:0,skipped:0}]};return {rows:[]};};const res={statusCode:200,status(n){this.statusCode=n;return this;},set(){return this;},json(body){this.body=body;return this;}};await controller.list({query:{userType}},res);return {calls,res};};
 try{const all=await run("all"),legacy=await run("unclassified");assert.equal(all.res.statusCode,200);assert.equal(all.calls[0].sql.includes("user_type="),false);assert.equal(legacy.res.statusCode,200);assert.ok(legacy.calls[0].sql.includes("user_type IS NULL"));}
 finally{db.query=original;}
});
test("History UI offers All and Unclassified, and confirms filtered deletion",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const source=fs.readFileSync(path.join(__dirname,"../views/admin.ejs"),"utf8");
 assert.match(source,/option value="all">All customer types/);
 assert.match(source,/option value="unclassified">Unclassified \/ legacy/);
 assert.match(source,/smsHistoryUpdateSelection\(\)/);
 assert.match(source,/PERMANENTLY delete/);
 assert.match(source,/smsHistorySelectPage/);
});
