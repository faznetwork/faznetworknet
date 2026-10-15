"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {normalizePhone,eventKey,renewalRuleEvents,extractCustomerPhone,isValidBdWhatsAppPhone,dispatchNow}=require("../services/notificationDispatcher");
const settingsService=require("../services/appSettings");
const whatsappService=require("../services/whatsappService");
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
 }
});
