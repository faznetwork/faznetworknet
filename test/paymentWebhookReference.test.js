"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");
const notifications=require("../services/notificationDispatcher");
const webhookSettings=require("../services/webhookSettingsService");
const parser=require("../services/paymentWebhookParser");
const controller=require("../controllers/paymentController");

function responseRecorder(){return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};}

test("SMS Ref customer ID auto-renews PPPoE when service_type is omitted",async()=>{
 const oldQuery=db.query,oldTransaction=db.withTransaction;
 const oldUpdate=mikrotik.updateSecret,oldKick=mikrotik.kickActiveUser;
 const oldGet=webhookSettings.get,oldDispatch=notifications.dispatchNotification,oldDispatchNow=notifications.dispatchNow;
 const calls=[];
 try{
  webhookSettings.get=async()=>({secret:"test-webhook-secret",senders:parser.OFFICIAL_SENDERS,recipients:{}});
  db.query=async(sql,params=[])=>{
   calls.push({sql,params});
   if(sql.includes("SELECT key,value FROM app_settings WHERE key IN ('personal_payment_webhook_enabled'"))return {rows:[
    {key:"personal_payment_webhook_enabled",value:"true"},
    {key:"personal_payment_webhook_secret",value:"test-webhook-secret"}
   ]};
   if(sql.startsWith("SELECT id,status,used FROM transactions"))return {rows:[]};
   if(sql.includes("FROM (SELECT username FROM customers WHERE id::text=$1"))return {rows:[{normalized_username:"customer-10006",username:"customer-10006"}]};
   if(sql.startsWith("SELECT c.*,p.plan_name,p.pool_name,p.price,p.duration_months,p.profile_name FROM customers c"))return {rows:[{id:10006,username:"customer-10006",full_name:"Test Customer",phone:"01712345678",password:"secret",package_name:"Home 500",profile:"HOME-500",plan_name:"Home 500",pool_name:"",price:500,duration_months:1,profile_name:"HOME-500",expiration_date:"2026-10-25"}]};
   if(sql.startsWith("INSERT INTO transactions(channel,trx_id,sender_phone,amount,status,matched_username,raw_sms,used,claimed_at,claimed_by,claim_flow,service_type,reference_user)"))return {rows:[{id:702}]};
   if(sql.startsWith("UPDATE transactions SET needs_reconciliation=true"))return {rows:[{id:702}]};
   if(sql.startsWith("INSERT INTO payment_reconciliation_audit"))return {rows:[{id:2}]};
   throw new Error("Unexpected database query: "+sql);
  };
  db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
   calls.push({sql,params,transactional:true});
   if(sql.startsWith("UPDATE customers SET package_name="))return {rows:[{id:10006}],rowCount:1};
   if(sql.startsWith("UPDATE pppoe_users SET profile="))return {rows:[{username:"customer-10006"}],rowCount:1};
   if(sql.startsWith("UPDATE transactions SET status='PAID'"))return {rows:[{id:702}],rowCount:1};
   throw new Error("Unexpected transactional query: "+sql);
  }});
  mikrotik.updateSecret=async(username,options)=>{calls.push({router:"updateSecret",username,options});return {success:true};};
  mikrotik.kickActiveUser=async username=>{calls.push({router:"kickActiveUser",username});return {kicked:true,count:1};};
  notifications.dispatchNow=async()=>({success:true,results:[]});
  notifications.dispatchNotification=()=>({task:Promise.resolve({success:true})});
  const req={body:{sender:"bKash",message:"bKash Payment Received Tk 500.00 from 01712345678 Ref 10006 TrxID ABC123456"},query:{},headers:{},get(name){return name.toLowerCase()==="x-webhook-token"?"test-webhook-secret":"";}};
  const res=responseRecorder();
  await controller.webhook(req,res);
  assert.equal(res.statusCode,200);
  assert.equal(res.body.success,true);
  assert.equal(res.body.status,"PAID");
  assert.equal(res.body.customerRef,"10006");
  assert.equal(res.body.matched_username,"customer-10006");
  assert.ok(calls.some(call=>call.router==="updateSecret"));
  assert.ok(calls.some(call=>call.router==="kickActiveUser"));
  assert.ok(calls.some(call=>call.transactional&&call.sql.startsWith("UPDATE customers SET package_name=")));
  assert.ok(calls.some(call=>call.transactional&&call.sql.startsWith("UPDATE transactions SET status='PAID'")));
 }finally{
  db.query=oldQuery;db.withTransaction=oldTransaction;
  mikrotik.updateSecret=oldUpdate;mikrotik.kickActiveUser=oldKick;
  webhookSettings.get=oldGet;notifications.dispatchNotification=oldDispatch;notifications.dispatchNow=oldDispatchNow;
 }
});
