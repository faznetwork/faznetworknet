"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {renderTemplate,eventTemplate,EVENT_CONFIG,parseMapping}=require("../services/smsService");
test("SMS template parser replaces all known dynamic variables",()=>{
 const rendered=renderTemplate("Dear {name}, Tk {amount} due {expiry_date}. Help: {support_phone}",{
  name:"Rahim",amount:550,expiry_date:"2026-11-01",support_phone:"01339932887"
 });
 assert.equal(rendered,"Dear Rahim, Tk 550 due 2026-11-01. Help: 01339932887");
});
test("SMS template parser preserves unknown placeholders and safely stringifies values",()=>{
 assert.equal(renderTemplate("{name} {unknown}",{name:"Customer"}),"Customer {unknown}");
 assert.equal(renderTemplate("{trx_id}",{trx_id:12345}),"12345");
});
test("event templates map to all three settings and support payment variables",()=>{
 const settings={
  sms_template_expiry_warning:"Expires {expiry_date}",
  sms_template_payment_receipt:"Tk {amount} received via {gateway}; {trx_id}; {new_expiry_date}",
  sms_template_line_block:"Hello {name} {support_phone}"
 };
 assert.equal(eventTemplate(settings,"expiry_warning",{expiry_date:"2026-11-01"}),"Expires 2026-11-01");
 assert.equal(eventTemplate(settings,"payment_receipt",{amount:200,gateway:"bKash",trx_id:"ABC123",new_expiry_date:"2026-12-01"}),"Tk 200 received via bKash; ABC123; 2026-12-01");
 assert.equal(eventTemplate(settings,"line_expiry",{name:"Rahim",support_phone:"01339932887"}),"Hello Rahim 01339932887");
 assert.deepEqual(Object.keys(EVENT_CONFIG).sort(),["expired","expiry_warning","line_expiry","payment","payment_receipt","recharge","renewal","welcome"]);
});

test("dynamic provider mapping accepts object or JSON and safely falls back",()=>{
 assert.deepEqual(parseMapping('{"receiver":"{to}","msg":"{message}"}'),{receiver:"{to}",msg:"{message}"});
 assert.deepEqual(parseMapping("not-json",{to:"{to}"}),{to:"{to}"});
});

test("universal SMS engine sends provider-defined x-www-form-urlencoded fields",async()=>{
 const {sendSms}=require("../services/smsService");
 const oldFetch=global.fetch;let captured;
 global.fetch=async(url,options)=>{captured={url:String(url),options};return new Response(JSON.stringify({error:0,msg:"accepted"}),{status:200,headers:{"content-type":"application/json"}});};
 try{
  const result=await sendSms({to:"01712345678",message:"Hello Rahim",settings:{sms_provider_mode:"custom_http",sms_api_url:"https://provider.example/send",sms_api_method:"POST_FORM",sms_http_param_mapping:JSON.stringify({receiver:"{to}",msg:"{message}",api_key:"{token}"}),sms_api_key:"test-secret",sms_sender_id:"FAZ"}});
  assert.equal(result.success,true);
  assert.equal(captured.options.method,"POST");
  assert.equal(captured.options.headers["Content-Type"],"application/x-www-form-urlencoded;charset=UTF-8");
  const params=new URLSearchParams(String(captured.options.body));
  assert.equal(params.get("receiver"),"01712345678");
  assert.equal(params.get("msg"),"Hello Rahim");
  assert.equal(params.get("api_key"),"test-secret");
 }finally{global.fetch=oldFetch;}
});

test("SMS attempts are recorded with provider-accepted and failure statuses without blocking send results",async()=>{
 const smsService=require("../services/smsService"),db=require("../db");
 const originalGetPool=db.getPool,originalFetch=global.fetch;const records=[];
 db.getPool=()=>({query:async(sql,params)=>{if(!sql.includes("INSERT INTO sms_delivery_logs"))throw new Error("Unexpected query");records.push({sql,params});return {rows:[{id:records.length}]};}});
 global.fetch=async()=>new Response(JSON.stringify({success:true,message:"accepted"}),{status:200});
 try{
  const success=await smsService.sendSms({to:"01712345678",message:"Hello SMS history",event:"manual",settings:{sms_provider_mode:"custom_http",sms_api_url:"https://provider.example/send",sms_api_method:"POST_JSON",sms_http_param_mapping:JSON.stringify({to:"{to}",message:"{message}"})}});
  assert.equal(success.success,true);assert.equal(records.at(-1).params[3],"sent");assert.equal(records.at(-1).params[0],"01712345678");assert.equal(records.at(-1).params[1],"Hello SMS history");
  global.fetch=async()=>new Response("provider error",{status:503});
  await assert.rejects(()=>smsService.sendSms({to:"01712345678",message:"Failure test",settings:{sms_provider_mode:"custom_http",sms_api_url:"https://provider.example/send",sms_api_method:"POST_JSON",sms_http_param_mapping:JSON.stringify({to:"{to}",message:"{message}"})}}));
  assert.equal(records.at(-1).params[3],"failed");assert.match(records.at(-1).params[7],/HTTP 503/);
 }finally{db.getPool=originalGetPool;global.fetch=originalFetch;}
});
