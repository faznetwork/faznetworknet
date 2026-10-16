"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizePhone,eventKey,renewalRuleEvents,extractCustomerPhone,isValidBdWhatsAppPhone,dispatchNow}=require("../services/notificationDispatcher");
const settingsService=require("../services/appSettings");
const whatsappService=require("../services/whatsappService");
const db=require("../db");
const {ALLOWED_EVENTS}=require("../controllers/notificationTemplateController");
test("notification dispatcher normalizes Bangladeshi mobile numbers for channel gateways",()=>{
 assert.equal(normalizePhone("01712345678"),"8801712345678");
 assert.equal(normalizePhone("+8801712345678"),"8801712345678");
 assert.equal(normalizePhone("008801712345678"),"8801712345678");
});
test("notification dispatcher canonicalizes payment and expiry event names",()=>{
 assert.equal(eventKey("payment_receipt"),"payment");
 assert.equal(eventKey("line_expiry"),"expired");
 assert.equal(eventKey("recharge"),"recharge");
 assert.equal(eventKey("pppoe_renewal"),"renewal");
});
test("PPPoE renewal/payment aliases share rule evaluation candidates",()=>{
 assert.deepEqual(renewalRuleEvents("pppoe","renewal"),["renewal","payment","recharge"]);
 assert.deepEqual(renewalRuleEvents("pppoe","payment"),["payment","renewal","recharge"]);
 assert.deepEqual(renewalRuleEvents("hotspot","renewal"),["renewal"]);
});
test("customer phone extraction supports legacy database field names",()=>{
 assert.equal(extractCustomerPhone({phone:"",mobile:"",account_phone:"01712345678"}),"01712345678");
 assert.equal(extractCustomerPhone({mobile_number:"01712345678"}),"01712345678");
 assert.equal(extractCustomerPhone({contact_no:"01712345678"}),"01712345678");
 assert.equal(isValidBdWhatsAppPhone(normalizePhone("01712345678")),true);
 assert.equal(isValidBdWhatsAppPhone(normalizePhone("not-a-phone")),false);
});
test("PPPoE renewal dispatch uses the enabled payment WhatsApp rule and normalized fallback phone",async()=>{
 const originalGetAllSettings=settingsService.getAllSettings;
 const originalSendMessage=whatsappService.sendMessage;
 const originalDbQuery=db.query;
 const sent=[];
 settingsService.getAllSettings=async()=>({
  notification_channel_whatsapp_enabled:"true",
  notification_channel_sms_enabled:"false",
  notification_channel_telegram_enabled:"false",
  notification_channel_messenger_enabled:"false",
  notification_rule_pppoe_renewal_whatsapp_enabled:"false",
  notification_rule_pppoe_payment_whatsapp_enabled:"true",
  notification_rule_pppoe_recharge_whatsapp_enabled:"false"
 });
 whatsappService.sendMessage=async payload=>{sent.push(payload);return {success:true};};
 db.query=async()=>({rows:[]});
 try{
  const result=await dispatchNow({
   userType:"pppoe",
   event:"pppoe_renewal",
   customer:{username:"test-user",phone:"",mobile:"",account_phone:"01712345678"},
   username:"test-user",
   message:"Renewal test"
  });
  assert.equal(result.success,true);
  assert.equal(result.results.length,1);
  assert.equal(result.results[0].channel,"whatsapp");
  assert.deepEqual(sent,[{to:"8801712345678",message:"Renewal test"}]);
 }finally{
  settingsService.getAllSettings=originalGetAllSettings;
  whatsappService.sendMessage=originalSendMessage;
  db.query=originalDbQuery;
 }
});
test("custom PPPoE renewal template replaces runtime variables for WhatsApp",async()=>{
 const originalGetAllSettings=settingsService.getAllSettings,originalSendMessage=whatsappService.sendMessage,originalDbQuery=db.query;
 const sent=[];
 settingsService.getAllSettings=async()=>({
  company_name:"FAZ NETWORK",notification_channel_whatsapp_enabled:"true",notification_channel_sms_enabled:"false",
  notification_channel_telegram_enabled:"false",notification_channel_messenger_enabled:"false",
  notification_rule_pppoe_renewal_whatsapp_enabled:"true"
 });
 db.query=async(sql,params)=>sql.includes("FROM notification_templates")?{rows:[{template_body:"Hi {name}, {username} renews until {expiry_date} at {company_name}."}]}:{rows:[]};
 whatsappService.sendMessage=async payload=>{sent.push(payload);return {success:true};};
 try{
  const result=await dispatchNow({userType:"pppoe",event:"pppoe_renewal",customer:{username:"alice",full_name:"Alice",phone:"01712345678"},username:"alice",message:"Default",variables:{new_expiry_date:"2026-11-16"}});
  assert.equal(result.success,true);
  assert.deepEqual(sent,[{to:"8801712345678",message:"Hi Alice, alice renews until 2026-11-16 at FAZ NETWORK."}]);
 }finally{settingsService.getAllSettings=originalGetAllSettings;whatsappService.sendMessage=originalSendMessage;db.query=originalDbQuery;}
});


test("template manager allows both dedicated expired events",()=>{
 assert.equal(ALLOWED_EVENTS.has("pppoe_expired"),true);
 assert.equal(ALLOWED_EVENTS.has("hotspot_expired"),true);
});

for(const scenario of [
 {type:"pppoe",event:"pppoe_expired",rule:"notification_rule_pppoe_expired_whatsapp_enabled",templateKey:"pppoe_expired",name:"Alice",package:"50 Mbps",expiry:"2026-10-15"},
 {type:"hotspot",event:"hotspot_expired",rule:"notification_rule_hotspot_expired_whatsapp_enabled",templateKey:"hotspot_expired",name:"01712345678",package:"Hotspot 1 GB",expiry:"2026-10-15"}
]){
 test("custom "+scenario.templateKey+" template dispatches with runtime variables and enabled rule",async()=>{
  const originalGetAllSettings=settingsService.getAllSettings,originalSendMessage=whatsappService.sendMessage,originalDbQuery=db.query;
  const sent=[];
  settingsService.getAllSettings=async()=>({
   company_name:"FAZ NETWORK",
   notification_channel_whatsapp_enabled:"true",
   notification_channel_sms_enabled:"false",
   notification_channel_telegram_enabled:"false",
   notification_channel_messenger_enabled:"false",
   [scenario.rule]:"true"
  });
  db.query=async(sql,params)=>sql.includes("FROM notification_templates")
   ?{rows:[{template_body:"প্রিয় {name}, {package}; username={username}; expiry={expiry_date}"}]}
   :{rows:[]};
  whatsappService.sendMessage=async payload=>{sent.push(payload);return {success:true};};
  try{
   const result=await dispatchNow({
    userType:scenario.type,event:scenario.event,username:"test-user",to:"01712345678",
    customer:{username:"test-user",full_name:scenario.name,phone:"01712345678"},
    variables:{name:scenario.name,username:"test-user",package:scenario.package,expiry_date:scenario.expiry},
    message:"Fallback message"
   });
   assert.equal(result.success,true);
   assert.deepEqual(sent,[{to:"8801712345678",message:"প্রিয় "+scenario.name+", "+scenario.package+"; username=test-user; expiry="+scenario.expiry}]);
  }finally{
   settingsService.getAllSettings=originalGetAllSettings;
   whatsappService.sendMessage=originalSendMessage;
   db.query=originalDbQuery;
  }
 });
}


test("Messenger delivery uses linked PSID and custom template replacement",async()=>{
 const originalGetAllSettings=settingsService.getAllSettings,originalDbQuery=db.query;
 const messengerService=require("../services/messengerService"),originalSend=messengerService.sendMessengerMessage;
 const sent=[];
 settingsService.getAllSettings=async()=>({
  company_name:"FAZ NETWORK",
  notification_channel_messenger_enabled:"true",
  notification_rule_pppoe_expired_messenger_enabled:"true"
 });
 db.query=async(sql)=>sql.includes("FROM notification_templates")?{rows:[{template_body:"Dear {name}, account {username} expired on {expiry_date}."}]}:{rows:[]};
 messengerService.sendMessengerMessage=async(psid,message,tag)=>{sent.push({psid,message,tag});return {success:true};};
 try{
  const result=await dispatchNow({userType:"pppoe",event:"pppoe_expired",customer:{username:"alice",full_name:"Alice",messenger_psid:"998877"},username:"alice",message:"Fallback",variables:{expiry_date:"2026-10-16"}});
  assert.equal(result.success,true);
  assert.deepEqual(sent,[{psid:"998877",message:"Dear Alice, account alice expired on 2026-10-16.",tag:undefined}]);
 }finally{settingsService.getAllSettings=originalGetAllSettings;db.query=originalDbQuery;messengerService.sendMessengerMessage=originalSend;}
});

test("Messenger dispatch skips customers without a linked PSID",async()=>{
 const originalGetAllSettings=settingsService.getAllSettings,originalDbQuery=db.query;
 const messengerService=require("../services/messengerService"),originalSend=messengerService.sendMessengerMessage;
 let sent=0;
 settingsService.getAllSettings=async()=>({
  notification_channel_messenger_enabled:"true",
  notification_rule_pppoe_payment_messenger_enabled:"true"
 });
 db.query=async()=>({rows:[]});
 messengerService.sendMessengerMessage=async()=>{sent++;return {success:true};};
 try{
  const result=await dispatchNow({userType:"pppoe",event:"payment",customer:{username:"unlinked-user"},username:"unlinked-user",message:"Payment received"});
  assert.equal(result.success,true);
  assert.equal(sent,0);
  assert.equal(result.results.length,0);
 }finally{settingsService.getAllSettings=originalGetAllSettings;db.query=originalDbQuery;messengerService.sendMessengerMessage=originalSend;}
});


test("Email dispatch renders the email subject and HTML template with escaped customer variables",async()=>{
 const originalGetAllSettings=settingsService.getAllSettings,originalDbQuery=db.query;
 const emailService=require("../services/emailService"),originalSend=emailService.sendEmail;
 const sent=[];
 settingsService.getAllSettings=async()=>({
  company_name:"FAZ NETWORK",notification_channel_email_enabled:"true",
  notification_rule_pppoe_payment_email_enabled:"true",
  notification_channel_sms_enabled:"false",notification_channel_whatsapp_enabled:"false",
  notification_channel_telegram_enabled:"false",notification_channel_messenger_enabled:"false"
 });
 db.query=async(sql)=>sql.includes("FROM notification_templates")?{rows:[{template_body:"<p>Hello {name}</p>",email_subject:"Payment {amount} - {company_name}",email_body:"<p>Hello {name}, account {username}</p>"}]}:{rows:[]};
 emailService.sendEmail=async payload=>{sent.push(payload);return {success:true,messageId:"email-test"};};
 try{
  const result=await dispatchNow({userType:"pppoe",event:"pppoe_payment",customer:{username:"alice",full_name:"A <Admin>",email:"alice@example.com"},username:"alice",variables:{amount:"525",package:"30 Mbps",expiry_date:"2026-10-31"}});
  assert.equal(result.success,true);
  assert.equal(sent.length,1);
  assert.equal(sent[0].to,"alice@example.com");
  assert.equal(sent[0].subject,"Payment 525 - FAZ NETWORK");
  assert.match(sent[0].html,/A &lt;Admin&gt;/);
  assert.match(sent[0].html,/alice/);
 }finally{settingsService.getAllSettings=originalGetAllSettings;db.query=originalDbQuery;emailService.sendEmail=originalSend;}
});

test("Email dispatch logs and skips customers without an email address",async()=>{
 const originalGetAllSettings=settingsService.getAllSettings,originalDbQuery=db.query,originalInfo=console.info;
 let logged="";
 settingsService.getAllSettings=async()=>({notification_channel_email_enabled:"true",notification_rule_pppoe_payment_email_enabled:"true"});
 db.query=async()=>({rows:[]});
 console.info=(...args)=>{logged+=args.join(" ");};
 try{
  const result=await dispatchNow({userType:"pppoe",event:"payment",customer:{username:"missing-email"},username:"missing-email"});
  assert.equal(result.success,true);
  assert.equal(result.results.length,0);
  assert.match(logged,/\[Email\] Skipped: No email address found for customer: missing-email/);
 }finally{settingsService.getAllSettings=originalGetAllSettings;db.query=originalDbQuery;console.info=originalInfo;}
});
