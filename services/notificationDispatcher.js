"use strict";
const settingsService=require("./appSettings");
const db=require("../db");
const smsService=require("./smsService");
const whatsappService=require("./whatsappService");
const messengerService=require("./messengerService");
const telegramService=require("./telegramService");
const emailService=require("./emailService");
function bool(settings,key,fallback=false){return Object.prototype.hasOwnProperty.call(settings,key)?settingsService.bool(settings[key]):fallback;}
function eventKey(event){const raw=String(event||"").trim().toLowerCase();const map={payment:"payment",payment_receipt:"payment",recharge:"recharge",renewal:"renewal",pppoe_renewal:"renewal",pppoe_payment:"payment",hotspot_purchase:"payment",hotspot_renewal:"renewal",pppoe_expiry_warning:"expiry_warning",hotspot_expiry_warning:"expiry_warning",pppoe_expired:"expired",hotspot_expired:"expired",welcome:"welcome",welcome_message:"welcome",expiry_warning:"expiry_warning",line_expiry:"expired",expired:"expired"};return map[raw]||raw;}
function customTemplateEvents(type,rawEvent,eventName){
 const raw=String(rawEvent||"").toLowerCase();
 if(raw==="welcome"||raw==="welcome_message"||eventName==="welcome")return ["welcome_message"];
 if(type==="pppoe"){
  if(raw==="pppoe_expired"||eventName==="expired")return ["pppoe_expired","expired"];
  if(eventName==="expiry_warning"||raw==="pppoe_expiry_warning")return ["pppoe_expiry_warning"];
  if(["payment","renewal","recharge"].includes(eventName))return raw==="pppoe_payment"||eventName==="payment"?["pppoe_payment","pppoe_renewal"]:["pppoe_renewal","pppoe_payment"];
 }
 if(type==="hotspot"){
  if(raw==="hotspot_expired"||eventName==="expired")return ["hotspot_expired","expired"];
  if(eventName==="expiry_warning"||raw==="hotspot_expiry_warning")return ["hotspot_expiry_warning"];
  if(["payment","renewal","recharge"].includes(eventName))return raw==="hotspot_purchase"||eventName==="payment"?["hotspot_purchase","hotspot_renewal"]:["hotspot_renewal","hotspot_purchase"];
 }
 return [];
}
async function getCustomTemplate(type,rawEvent,eventName,channel){
 const candidates=customTemplateEvents(type,rawEvent,eventName);if(!candidates.length)return null;
 try{const result=await db.query("SELECT template_body,email_subject,email_body FROM notification_templates WHERE event_key=ANY($1::varchar[]) AND channel=$2 AND is_active=TRUE ORDER BY array_position($1::varchar[],event_key) LIMIT 1",[candidates,channel]);const row=result.rows?.[0];if(!row)return null;return channel==="email"?{template_body:row.template_body,email_subject:row.email_subject||"",email_body:row.email_body||row.template_body||""}:row.template_body||null;}
 catch(error){console.warn("[Notification Hub] Custom template lookup skipped:",error.message);return null;}
}
function renewalRuleEvents(type,eventName){
 if(type!=="pppoe"||!["payment","renewal","recharge"].includes(eventName))return [eventName];
 // These legacy names are all used by PPPoE renewal/payment entry points. Treat an
 // enabled renewal/payment/recharge rule as the same business event, while keeping
 // other notification events isolated.
 return [...new Set([eventName,"renewal","payment","recharge"])];
}
function extractCustomerPhone(customer={}){
 const account=customer||{};
 return account.phone||account.mobile||account.account_phone||account.mobile_number||account.contact_no||"";
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

function formatMessage(settings,event,variables,message,customTemplate){
 const templateKey={payment:"sms_template_payment_receipt",payment_receipt:"sms_template_payment_receipt",recharge:"sms_template_payment_receipt",renewal:"sms_template_payment_receipt",welcome:"sms_template_welcome",expiry_warning:"sms_template_expiry_warning",expired:"sms_template_line_block",line_expiry:"sms_template_line_block"}[event];
 const source=customTemplate!==null&&customTemplate!==undefined?customTemplate:(templateKey&&settings[templateKey]?settings[templateKey]:message||"");
 return smsService.renderTemplate(source,{company_name:settings.company_name||"FAZ NETWORK",support_phone:settings.support_phone||"",...variables});
}

function escapeEmailHtml(value){return String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");}
function renderEmailTemplate(source,variables,html=true){
 return String(source||"").replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(all,key)=>Object.prototype.hasOwnProperty.call(variables,key)?(html?escapeEmailHtml(variables[key]):String(variables[key]??"")):all);
}
function defaultEmailTemplate(event,context){
 const map={
  payment:{subject:"Payment confirmation - {company_name}",body:"<p>Dear {name},</p><p>We have received your payment of Tk {amount} for account <strong>{username}</strong>.</p><p>Thank you,<br>{company_name}</p>"},
  renewal:{subject:"Service renewal confirmed - {company_name}",body:"<p>Dear {name},</p><p>Your {package} service has been renewed. Your new expiry date is <strong>{expiry_date}</strong>.</p><p>Thank you,<br>{company_name}</p>"},
  recharge:{subject:"Recharge confirmation - {company_name}",body:"<p>Dear {name},</p><p>Your {package} recharge of Tk {amount} has been processed. Valid until {expiry_date}.</p><p>{company_name}</p>"},
  expiry_warning:{subject:"Service expiry reminder - {company_name}",body:"<p>Dear {name},</p><p>Your {package} internet service is due to expire on <strong>{expiry_date}</strong>. Please renew to avoid interruption.</p><p>{company_name}</p>"},
  expired:{subject:"Internet service expired - {company_name}",body:"<p>Dear {name},</p><p>Your internet service has expired. Please renew your package to restore service.</p><p>{company_name}</p>"},
  welcome:{subject:"Welcome to {company_name}",body:"<p>Welcome {name}!</p><p>Your account <strong>{username}</strong> is ready. Package: {package}.</p><p>{company_name}</p>"}
 };
 return map[event]||{subject:"Notification from {company_name}",body:"<p>Dear {name},</p><p>This is a notification about your FAZ NETWORK service.</p><p>{company_name}</p>"};
}

async function dispatchNow({userType="pppoe",event="payment",to,phone,username,customer, message,variables={},messengerRecipientId,channels}={}){
 const settings=await settingsService.getAllSettings(),type=String(userType||"pppoe").toLowerCase(),rawEvent=String(event||"").trim().toLowerCase(),eventName=eventKey(event);
 const rawPhone=extractCustomerPhone(customer)||phone||to;
 const recipientPhone=normalizePhone(rawPhone);
 const validWhatsAppPhone=isValidBdWhatsAppPhone(recipientPhone);
 const customerUsername=String(customer?.username||username||"unknown").trim()||"unknown";
 const isPppoeRenewal=type==="pppoe"&&["payment","renewal","recharge"].includes(eventName);
 if(isPppoeRenewal){
  if(validWhatsAppPhone)console.info("[Dispatcher] Triggering PPPoE renewal notification for "+customerUsername+" ("+recipientPhone+").");
  else console.warn("[Notification] No valid phone found for customer: "+customerUsername+".");
 }
 const context={company_name:settings.company_name||"FAZ NETWORK",username:username||customerUsername,name:customer?.full_name||customer?.fullName||customer?.name||username||customerUsername,phone:recipientPhone,package:variables.package||variables.profile||customer?.package_name||customer?.profile||"",expiry_date:variables.expiry_date||variables.new_expiry_date||customer?.expiration_date||"",...variables};
 const escapeTelegramHtml=value=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
 const textFor=async channel=>{
  const variables=channel==="telegram"?Object.fromEntries(Object.entries(context).map(([key,value])=>[key,value===null||value===undefined?value:escapeTelegramHtml(value)])):context;
  return formatMessage(settings,eventName,variables,message,await getCustomTemplate(type,rawEvent,eventName,channel));
 };
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
 if(isPppoeRenewal&&!whatsappChannelEnabled)console.warn("[Dispatcher] WhatsApp skipped: channel disabled for PPPoE Renewal.");
 if(isPppoeRenewal&&whatsappChannelEnabled&&!validWhatsAppPhone)console.warn("[Dispatcher] WhatsApp skipped: no valid PPPoE customer phone.");
 if(channelEnabled("sms")&&ruleEnabled("sms")&&recipientPhone)jobs.push(["sms",async()=>smsService.sendNotification({to:recipientPhone,message:await textFor("sms"),event:smsEvent(eventName),variables:context,settings,useMessageDirectly:true})]);
 if(whatsappChannelEnabled&&whatsappRuleEnabled&&validWhatsAppPhone)jobs.push(["whatsapp",async()=>whatsappService.sendMessage({to:recipientPhone,message:await textFor("whatsapp")})]);
 if(channelEnabled("email")&&ruleEnabled("email")){
  let recipientEmail=String(customer?.email||"").trim();
  if(!recipientEmail&&customerUsername!=="unknown"){
   try{const linked=await db.query("SELECT email FROM customers WHERE username=$1 LIMIT 1",[customerUsername]);recipientEmail=String(linked.rows?.[0]?.email||"").trim();}
   catch(error){console.warn("[Email] Customer email lookup failed for "+customerUsername+": "+String(error?.message||error).slice(0,160));}
  }
  if(!recipientEmail)console.info("[Email] Skipped: No email address found for customer: "+customerUsername);
  else jobs.push(["email",async()=>{
   const custom=await getCustomTemplate(type,rawEvent,eventName,"email");
   const defaults=defaultEmailTemplate(eventName,context);
   const subjectSource=custom&&custom.email_subject?custom.email_subject:defaults.subject;
   const bodySource=custom&&custom.email_body?custom.email_body:defaults.body;
   const subject=renderEmailTemplate(subjectSource,context,false).replace(/[\r\n]+/g," ").trim().slice(0,200);
   const html=renderEmailTemplate(bodySource,context,true);
   const text=html.replace(/<\s*br\s*\/?>/gi,"\n").replace(/<\/(p|div|li|h[1-6])>/gi,"\n").replace(/<[^>]*>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/[ \t]+\n/g,"\n").trim();
   return emailService.sendEmail({to:recipientEmail,subject,html,text});
  }]);
 }
 if(channelEnabled("telegram")&&ruleEnabled("telegram")){
  let telegramChatId=String(customer?.telegram_chat_id||"").trim();
  if(!telegramChatId&&customerUsername!=="unknown"){
   try{const linked=await db.query("SELECT telegram_chat_id FROM customers WHERE username=$1 LIMIT 1",[customerUsername]);telegramChatId=String(linked.rows?.[0]?.telegram_chat_id||"").trim();}
   catch(error){console.warn("[Telegram] Chat ID lookup failed for customer "+customerUsername+": "+String(error?.message||error).slice(0,160));}
  }
  telegramChatId=telegramChatId||String(settings.telegram_default_chat_id||"").trim();
  if(!telegramChatId)jobs.push(["telegram",async()=>({success:false,error:"No customer Telegram Chat ID is linked and no default Chat ID is configured."})]);
  else jobs.push(["telegram",async()=>telegramService.sendTelegramMessage(telegramChatId,await textFor("telegram"),{parse_mode:"HTML",disable_web_page_preview:true})]);
 }
 if(channelEnabled("messenger")&&ruleEnabled("messenger")){
  let psid=String(customer?.messenger_psid||"").trim();
  if(!psid&&customerUsername!=="unknown"){
   try{const linked=await db.query("SELECT messenger_psid FROM customers WHERE username=$1 LIMIT 1",[customerUsername]);psid=String(linked.rows?.[0]?.messenger_psid||"").trim();}
   catch(error){console.warn("[Messenger] PSID lookup failed for customer "+customerUsername+": "+String(error?.message||error).slice(0,160));}
  }
  if(!psid)console.info("[Messenger] Skipped: Customer "+customerUsername+" has not linked their Facebook Messenger.");
  else jobs.push(["messenger",async()=>messengerService.sendMessengerMessage(psid,await textFor("messenger"))]);
 }
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
 if(channel==="telegram")return telegramService.sendTelegramMessage(to||settings.telegram_default_chat_id,message,{parse_mode:"HTML",disable_web_page_preview:true});
 if(channel==="messenger")return messengerService.sendMessengerMessage(messengerRecipientId,message);
 throw new Error("Unsupported notification channel.");
}
module.exports={dispatchNotification,dispatchNow,testChannel,normalizePhone,eventKey,renewalRuleEvents,extractCustomerPhone,isValidBdWhatsAppPhone};
