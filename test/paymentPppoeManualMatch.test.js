"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const notifications=require("../services/notificationDispatcher");
const controller=require("../controllers/paymentController");

function responseRecorder(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

test("PPPoE manual match renews RouterOS, persists expiry, and finalizes only the claimed transaction",async()=>{
 const originalQuery=db.query,originalTransaction=db.withTransaction;
 const originalUpdate=mikrotik.updateSecret,originalKick=mikrotik.kickActiveUser;
 const originalDispatch=notifications.dispatchNotification,originalDispatchNow=notifications.dispatchNow;
 const calls=[];
 try{
  db.query=async(sql,params=[])=>{
   calls.push({sql,params});
   if(sql.startsWith("SELECT * FROM transactions"))return {rows:[{id:701,trx_id:"TX-PPPOE-701",channel:"bkash",sender_phone:"01712345678",amount:500,status:"unmatched",used:false,service_type:null}]};
   if(sql.startsWith("SELECT username FROM (SELECT username FROM pppoe_users"))return {rows:[{username:"customer-10006"}]};
   if(sql.startsWith("UPDATE transactions SET status='processing'"))return {rows:[{id:701}],rowCount:1};
   if(sql.startsWith("SELECT c.*,p.plan_name,p.pool_name,p.price,p.duration_months,p.profile_name FROM customers c"))return {rows:[{id:10006,username:"customer-10006",full_name:"Test Customer",phone:"01712345678",password:"secret",package_name:"Home 500",profile:"HOME-500",plan_name:"Home 500",pool_name:"",price:500,duration_months:1,profile_name:"HOME-500",expiration_date:"2026-10-25"}]};
   if(sql.startsWith("UPDATE transactions SET needs_reconciliation=true"))return {rows:[{id:701}]};
   if(sql.startsWith("INSERT INTO payment_reconciliation_audit"))return {rows:[{id:1}]};
   throw new Error("Unexpected database query: "+sql);
  };
  db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
   calls.push({sql,params,transactional:true});
   if(sql.startsWith("UPDATE customers SET package_name="))return {rows:[{id:10006}],rowCount:1};
   if(sql.startsWith("UPDATE pppoe_users SET profile="))return {rows:[{username:"customer-10006"}],rowCount:1};
   if(sql.startsWith("UPDATE transactions SET status='PAID'"))return {rows:[{id:701}],rowCount:1};
   throw new Error("Unexpected transactional query: "+sql);
  }});
  mikrotik.updateSecret=async(username,options)=>{calls.push({router:"updateSecret",username,options});return {success:true};};
  mikrotik.kickActiveUser=async username=>{calls.push({router:"kickActiveUser",username});return {kicked:true,count:1};};
  notifications.dispatchNow=async()=>({success:true,results:[]});
  notifications.dispatchNotification=()=>({task:Promise.resolve({success:true})});
  const res=responseRecorder();
  await controller.manualMatch({body:{trxId:"TX-PPPOE-701",service_type:"pppoe",username:"customer-10006"},session:{userId:9}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.username,"customer-10006");
  assert.match(res.body.expiration,/^\d{4}-\d{2}-\d{2}$/);
  assert.ok(calls.some(call=>call.router==="updateSecret"&&call.options.profile==="HOME-500"));
  assert.ok(calls.some(call=>call.router==="kickActiveUser"&&call.username==="customer-10006"));
  assert.ok(calls.some(call=>call.transactional&&call.sql.startsWith("UPDATE customers SET package_name=")));
  assert.ok(calls.some(call=>call.transactional&&call.sql.startsWith("UPDATE transactions SET status='PAID'")));
 }finally{
  db.query=originalQuery;db.withTransaction=originalTransaction;
  mikrotik.updateSecret=originalUpdate;mikrotik.kickActiveUser=originalKick;
  notifications.dispatchNotification=originalDispatch;notifications.dispatchNow=originalDispatchNow;
 }
});

test("manual-match admin UI refuses silent API failures and keeps the modal available",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../views/admin.ejs"),"utf8");
 assert.match(source,/if \(!result \|\| result\.success !== true\)/);
 assert.match(source,/The server did not confirm that this payment was matched/);
 assert.match(source,/Payment was matched successfully, but the payment list could not refresh/);
});
