"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const dispatcher=require("../services/notificationDispatcher");
const settingsService=require("../services/appSettings");
const smsService=require("../services/smsService");
const whatsappService=require("../services/whatsappService");
const {createHotspotExpirationCleanup}=require("../jobs/hotspotExpirationCleanup");

test("normalizes Bangladesh SMS phones to local 11 digits and WhatsApp to a strict international JID",()=>{
  assert.equal(dispatcher.normalizeSmsPhone("01712345678"),"01712345678");
  assert.equal(dispatcher.normalizeSmsPhone("+880 1712-345678"),"01712345678");
  assert.equal(dispatcher.normalizeSmsPhone("1712345678"),"01712345678");
  assert.equal(dispatcher.normalizeSmsPhone("02123456789"),"");
  assert.equal(dispatcher.normalizePhone("01712345678"),"8801712345678");
  assert.equal(whatsappService.normalizeWhatsAppJid("01712345678"),"8801712345678@s.whatsapp.net");
  assert.equal(whatsappService.normalizeWhatsAppJid("+8801712345678"),"8801712345678@s.whatsapp.net");
  assert.throws(()=>whatsappService.normalizeWhatsAppJid("02123456789"),/valid Bangladesh mobile number/);
});

test("Hotspot pre-expiry event dispatches the same direct message to SMS and WhatsApp concurrently",async()=>{
  const oldSettings=settingsService.getAllSettings,oldSms=smsService.sendNotification,oldWa=whatsappService.sendMessage;
  const calls=[];
  try{
    settingsService.getAllSettings=async()=>({company_name:"FAZ NETWORK",notification_channel_sms_enabled:false,notification_channel_whatsapp_enabled:false});
    smsService.sendNotification=async payload=>{calls.push({channel:"sms",...payload});return {success:true};};
    whatsappService.sendMessage=async payload=>{calls.push({channel:"whatsapp",...payload});return {success:true};};
    const result=await dispatcher.dispatchNow({userType:"hotspot",event:"hotspot_expiring_soon",recipient:"01712345678",customerName:"রহিম",message:"পরীক্ষামূলক মেয়াদ সতর্কতা",useMessageDirectly:true,channels:["sms","whatsapp"]});
    assert.equal(result.success,true);
    assert.deepEqual(calls.map(call=>call.channel).sort(),["sms","whatsapp"]);
    assert.equal(calls.find(call=>call.channel==="sms").to,"01712345678");
    assert.equal(calls.find(call=>call.channel==="whatsapp").to,"8801712345678");
    assert.equal(calls.every(call=>call.message==="পরীক্ষামূলক মেয়াদ সতর্কতা"),true);
  }finally{settingsService.getAllSettings=oldSettings;smsService.sendNotification=oldSms;whatsappService.sendMessage=oldWa;}
});

test("five-minute scanner atomically claims due vouchers and dispatches both notification channels",async()=>{
  const calls=[],payloads=[];
  const database={async query(sql,params=[]){calls.push({sql,params});if(sql.startsWith("WITH due AS"))return {rows:[{id:9,username:"AA:BB:CC:DD:EE:FF",phone:"01712345678",customer_name:"রহিম",profile:"1-Hour",price:10,expires_at:new Date("2026-10-17T13:05:00.000Z")}]};if(sql.startsWith("SELECT id,username,status"))return {rows:[]};return {rows:[]};}};
  const router={async getHotspotExpirationSnapshot(){return {users:[],schedulerNames:[]};}};
  const notificationDispatcher={dispatchNotification(payload){payloads.push(payload);return {accepted:true,task:Promise.resolve({success:true,results:[{channel:"sms",status:"fulfilled"},{channel:"whatsapp",status:"fulfilled"}]})};}};
  const logger={log(){},warn(){},error(){}};
  const run=createHotspotExpirationCleanup({db:database,mikrotikService:router,notificationDispatcher,logger});
  const result=await run();
  const claim=calls.find(call=>call.sql.startsWith("WITH due AS"));
  assert.ok(claim);
  assert.ok(claim.sql.includes("INTERVAL '5 minutes'"));
  assert.match(claim.sql,/pre_expiry_notified IS NOT TRUE/);
  assert.match(claim.sql,/SET pre_expiry_notified=TRUE/);
  assert.equal(result.preExpiryNotified,1);
  assert.equal(payloads.length,1);
  assert.equal(payloads[0].event,"hotspot_expiring_soon");
  assert.deepEqual(payloads[0].channels,["sms","whatsapp"]);
  assert.equal(payloads[0].useMessageDirectly,true);
  assert.match(payloads[0].message,/আগামী ৫ মিনিটের মধ্যে শেষ হতে যাচ্ছে/);
});
