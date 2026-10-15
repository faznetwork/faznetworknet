"use strict";
const settingsService=require("./appSettings");
const smsService=require("./smsService");
const whatsappService=require("./whatsappService");
function bool(settings,key,fallback=false){return Object.prototype.hasOwnProperty.call(settings,key)?settingsService.bool(settings[key]):fallback;}
function eventKey(event){const raw=String(event||"").trim().toLowerCase();const map={payment:"payment",payment_receipt:"payment",recharge:"recharge",renewal:"renewal",pppoe_renewal:"renewal",welcome:"welcome",expiry_warning:"expiry_warning",line_expiry:"expired",expired:"expired"};return map[raw]||raw;}
function renewalRuleEvents(type,eventName){
 if(type!=="pppoe"||!["payment","renewal","recharge"].includes(eventName))return [eventName];
 // These legacy names are all used by PPPoE renewal/payment entry points. Treat an
 // enabled renewal/payment/recharge rule as the same business event, while keeping
 // other notification events isolated.
 return [...new Set([eventName,"renewal","payment","recharge"])];
}
function extractCustomerPhone(customer={}){
 return customer.phone||customer.mobile||customer.account_phone||customer.mobile_number||customer.contact_no||"";
}
function isValidBdWhatsAppPhone(value){return /^8801[3-9]\d{8}$/.test(String(value||""));}
function smsEvent(event){const map={payment:"payment_receipt",payment_receipt:"payment_receipt",recharge:"payment_receipt",renewal:"payment_receipt",welcome:"welcome",expiry_warning:"expiry_warning",line_expiry:"line_expiry",expired:"line_expiry"};return map[event]||event;}
function normalizePhone(value){
 let digits=String(value||"").replace(/[^\d]/g,"");
 if(digits.startsWith("00880"))digits=digits.slice(2);
 if(digits.startsWith("01")&&digits.length===11)digits="88"+digits;
 if(digits.startsWith("8801")&&digits.length===13)return digits;
 if(digits.startsWith("1")&&digits.length===10)return "880"+digits;
 return digits;
}
async function sendTelegram(settings,message){
 const token=String(settings.telegram_bot_token||"").trim(),chatId=String(settings.telegram_default_chat_id||"").trim();
 if(!token||!chatId)throw new Error("Telegram Bot Token and default Chat ID are required.");
 const response=await fetch("https://api.telegram.org/bot"+encodeURIComponent(token)+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:chatId,text:String(message||"").slice(0,4000),disable_web_page_preview:true}),redirect:"error"});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.ok===false)throw new Error("Telegram delivery failed"+(data.description?": "+String(data.description).slice(0,160):"."));
 return {success:true,result:data.result?{message_id:data.result.message_id}:undefined};
}
async function sendMessenger(settings,recipientId,message){
 const token=String(settings.messenger_page_access_token||"").trim(),pageId=String(settings.messenger_page_id||"").trim();
 if(!token||!pageId)throw new Error("Messenger Page ID and Page Access Token are required.");
 if(!recipientId) return {success:true,skipped:true,reason:"messenger_recipient_id_missing"};
 const response=await fetch("https://graph.facebook.com/v20.0/"+encodeURIComponent(pageId)+"/messages?access_token="+encodeURIComponent(token),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipient:{id:String(recipientId)},messaging_type:"UTILITY",message:{text:String(message||"").slice(0,2000)}}),redirect:"error"});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||data.error)throw new Error("Messenger delivery failed"+(data.error?.message?": "+String(data.error.message).slice(0,160):"."));
 return {success:true,messageId:data.message_id||null};
}
function formatMessage(settings,event,variables,message){
 const templateKey={payment:"sms_template_payment_receipt",payment_receipt:"sms_template_payment_receipt",recharge:"sms_template_payment_receipt",renewal:"sms_template_payment_receipt",welcome:"sms_template_welcome",expiry_warning:"sms_template_expiry_warning",expired:"sms_template_line_block",line_expiry:"sms_template_line_block"}[event];
 const source=templateKey&&settings[templateKey]?settings[templateKey]:message||"";
 return smsService.renderTemplate(source,{company_name:settings.company_name||"FAZ NETWORK",support_phone:settings.support_phone||"",...variables});
}
async function dispatchNow({userType="pppoe",event="payment",to,phone,username,customer, message,variables={},messengerRecipientId,channels}={}){
 const settings=await settingsService.getAllSettings(),type=String(userType||"pppoe").toLowerCase(),eventName=eventKey(event);
 const rawPhone=extractCustomerPhone(customer)||phone||to;
 const recipientPhone=normalizePhone(rawPhone);
 const validWhatsAppPhone=isValidBdWhatsAppPhone(recipientPhone);
 const customerUsername=String(customer?.username||username||"unknown").trim()||"unknown";
 const isPppoeRenewal=type==="pppoe"&&["payment","renewal","recharge"].includes(eventName);
 if(isPppoeRenewal){
  if(validWhatsAppPhone)console.info("[Dispatcher] Triggering PPPoE renewal notification for "+customerUsername+" ("+recipientPhone+").");
  else console.warn("[Notification] No valid phone found for customer: "+customerUsername+".");
 }
 const context={username:username||customerUsername,name:customer?.full_name||customer?.fullName||customer?.name||username||customerUsername,phone:recipientPhone,...variables};
 const text=formatMessage(settings,eventName,context,message);
 const selected=Array.isArray(channels)?new Set(channels):null;
 const jobs=[];
 const channelEnabled=(name)=>selected?selected.has(name):bool(settings,"notification_channel_"+name+"_enabled",name==="sms"&&String(settings.sms_provider_mode||settings.sms_gateway_mode||"disabled")!=="disabled");
 const ruleEvents=renewalRuleEvents(type,eventName);
 const ruleEnabled=(name)=>{
  const keys=ruleEvents.map(ruleEvent=>"notification_rule_"+type+"_"+ruleEvent+"_"+name+"_enabled");
  if(keys.some(key=>Object.prototype.hasOwnProperty.call(settings,key)&&settingsService.bool(settings[key])))return true;
  if(keys.some(key=>Object.prototype.hasOwnProperty.call(settings,key)))return false;
  return name==="sms"&&type==="pppoe"&&["payment","expiry_warning","expired"].includes(eventName);
 };
 const whatsappChannelEnabled=channelEnabled("whatsapp");
 const whatsappRuleEnabled=ruleEnabled("whatsapp");
 if(isPppoeRenewal&&whatsappChannelEnabled&&validWhatsAppPhone&&!whatsappRuleEnabled)console.warn("[Dispatcher] Notification blocked: Rule disabled for PPPoE Renewal WhatsApp.");
 if(isPppoeRenewal&&whatsappChannelEnabled&&!validWhatsAppPhone)console.warn("[Dispatcher] WhatsApp skipped: no valid PPPoE customer phone.");
 if(channelEnabled("sms")&&ruleEnabled("sms")&&recipientPhone)jobs.push(["sms",()=>smsService.sendNotification({to:recipientPhone,message:text,event:smsEvent(eventName),variables:context})]);
 if(whatsappChannelEnabled&&whatsappRuleEnabled&&validWhatsAppPhone)jobs.push(["whatsapp",()=>whatsappService.sendMessage({to:recipientPhone,message:text})]);
 if(channelEnabled("telegram")&&ruleEnabled("telegram"))jobs.push(["telegram",()=>sendTelegram(settings,text)]);
 if(channelEnabled("messenger")&&ruleEnabled("messenger"))jobs.push(["messenger",()=>sendMessenger(settings,messengerRecipientId||context.messengerRecipientId,text)]);
 const results=await Promise.allSettled(jobs.map(([,run])=>Promise.resolve().then(run)));
 return {success:results.every(r=>r.status==="fulfilled"&&(r.value?.success!==false)),event:eventName,userType:type,results:results.map((r,i)=>({channel:jobs[i][0],status:r.status,...(r.status==="fulfilled"?{result:r.value}:{error:String(r.reason?.message||r.reason).slice(0,300)})}))};
}
function dispatchNotification(payload={}){
 // Intentionally detached from request lifecycles: delivery cannot delay or roll back billing.
 const task=Promise.resolve().then(()=>dispatchNow(payload)).catch(error=>({success:false,error:String(error?.message||error)}));
 task.then(result=>{if(!result.success)console.warn("[Notification Hub] One or more channel deliveries failed:",JSON.stringify({event:payload.event,userType:payload.userType,results:result.results||[],error:result.error}));});
 return {accepted:true,task};
}
async function testChannel(channel,{to,message="FAZ NETWORK test notification",messengerRecipientId}={}){
 const settings=await settingsService.getAllSettings();
 if(channel==="sms"){if(String(settings.sms_provider_mode||settings.sms_gateway_mode||"disabled")==="disabled")throw new Error("SMS engine is disabled. Select a provider mode and save settings first.");return smsService.sendSms({to,message,event:"manual",settings});}
 if(channel==="whatsapp")return whatsappService.sendMessage({to,message});
 if(channel==="telegram")return sendTelegram(settings,message);
 if(channel==="messenger")return sendMessenger(settings,messengerRecipientId,message);
 throw new Error("Unsupported notification channel.");
}
module.exports={dispatchNotification,dispatchNow,testChannel,normalizePhone,eventKey,renewalRuleEvents,extractCustomerPhone,isValidBdWhatsAppPhone};
