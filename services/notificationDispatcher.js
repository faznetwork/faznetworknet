"use strict";
const settingsService=require("./appSettings");
const db=require("../db");
const smsService=require("./smsService");
const whatsappService=require("./whatsappService");
const emailOutboxService=require("./emailOutboxService");
function bool(settings,key,fallback=false){return Object.prototype.hasOwnProperty.call(settings,key)?settingsService.bool(settings[key]):fallback;}
function eventKey(event){const raw=String(event||"").trim().toLowerCase();const map={payment:"payment",payment_receipt:"payment",recharge:"recharge",renewal:"renewal",pppoe_renewal:"renewal",pppoe_payment:"payment",hotspot_purchase:"payment",hotspot_payment_received:"payment",hotspot_account_created:"welcome",hotspot_first_login:"welcome",hotspot_expiring_soon:"expiry_warning",hotspot_renewal:"renewal",pppoe_expiry_warning:"expiry_warning",hotspot_expiry_warning:"expiry_warning",pppoe_expired:"expired",hotspot_expired:"expired",welcome:"welcome",welcome_message:"welcome",expiry_warning:"expiry_warning",line_expiry:"expired",expired:"expired"};return map[raw]||raw;}
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
function normalizeSmsPhone(value){
 let digits=String(value||"").replace(/[^\d]/g,"");
 if(digits.startsWith("00880"))digits=digits.slice(2);
 if(digits.startsWith("8801")&&digits.length===13)digits="0"+digits.slice(3);
 else if(digits.startsWith("1")&&digits.length===10)digits="0"+digits;
 return /^01[3-9]\d{8}$/.test(digits)?digits:"";
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

async function dispatchNow({userType="pppoe",event="payment",to,recipient,phone,username,customer,customerName,message,variables={},channels,excludeChannels=[],useMessageDirectly=false,emailClient=null}={}){
 const settings=await settingsService.getAllSettings(),type=String(userType||"pppoe").toLowerCase(),rawEvent=String(event||"").trim().toLowerCase(),eventName=eventKey(event);
 const rawPhone=extractCustomerPhone(customer)||phone||to||recipient;
 const recipientPhone=normalizePhone(rawPhone);
 const smsPhone=normalizeSmsPhone(rawPhone);
 const validWhatsAppPhone=isValidBdWhatsAppPhone(recipientPhone);
 const explicitHotspotPipeline=type==="hotspot"&&["hotspot_payment_received","hotspot_account_created","hotspot_first_login","hotspot_renewal","hotspot_expiring_soon"].includes(rawEvent);
 const customerUsername=String(customer?.username||username||"unknown").trim()||"unknown";
 const isPppoeRenewal=type==="pppoe"&&["payment","renewal","recharge"].includes(eventName);
 if(isPppoeRenewal){
  if(validWhatsAppPhone)console.info("[Dispatcher] Triggering PPPoE renewal notification for "+customerUsername+" ("+recipientPhone+").");
  else console.warn("[Notification] No valid phone found for customer: "+customerUsername+".");
 }
 const context={company_name:settings.company_name||"FAZ NETWORK",username:username||customerUsername,name:customer?.full_name||customer?.fullName||customer?.name||customerName||username||customerUsername,phone:smsPhone||recipientPhone,package:variables.package||variables.profile||customer?.package_name||customer?.profile||"",expiry_date:variables.expiry_date||variables.new_expiry_date||customer?.expiration_date||"",...variables};
 context.expiry=context.expiry||context.expiry_date||"নির্ধারিত হয়নি";
 const textFor=async channel=>{
  // Notification Hub templates must take precedence over a controller-provided fallback message.
  // Controllers may still pass useMessageDirectly for legacy compatibility; it is only a fallback
  // when no active database template exists for this event/channel.
  const custom=await getCustomTemplate(type,rawEvent,eventName,channel);
  const template=typeof custom==="string"&&custom.trim()?custom:null;
  console.log("[Notification Pipeline] Sending:",{event:rawEvent,phone:rawPhone,templateFound:!!template});
  if(template){
   return smsService.renderTemplate(template,{...context,...variables,name:context.name,customer_name:context.name,expiry:context.expiry_date||"নির্ধারিত হয়নি",package:context.package||"হটস্পট প্যাকেজ",price:context.price??""});
  }
  if(useMessageDirectly&&String(message||"").trim())return smsService.renderTemplate(String(message),{...context,...variables,name:context.name,customer_name:context.name});
  if(channel==="whatsapp"&&type==="hotspot"&&eventName==="renewal"){
   const fallback="FAZ NETWORK: আপনার হটস্পট প্যাকেজ সফলভাবে রিনিউ হয়েছে। মেয়াদ: {expiry} পর্যন্ত। ধন্যবাদ!";
   return smsService.renderTemplate(fallback,{...context,expiry:context.expiry_date||"নির্ধারিত হয়নি",package:context.package||"হটস্পট প্যাকেজ",price:context.price??""});
  }
  return formatMessage(settings,eventName,context,message,custom);
 };
 const selected=Array.isArray(channels)?new Set(channels):null;
 const excluded=new Set(Array.isArray(excludeChannels)?excludeChannels:[]);
 const jobs=[];
 const channelEnabled=(name)=>{
  if(excluded.has(name))return false;
  if(emailClient&&name==="email")return bool(settings,"notification_channel_email_enabled",false)&&(!selected||selected.has(name));
  return selected?selected.has(name):bool(settings,"notification_channel_"+name+"_enabled",name==="sms"&&String(settings.sms_provider_mode||settings.sms_gateway_mode||"disabled")!=="disabled");
 };
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
 if(channelEnabled("sms")&&(ruleEnabled("sms")||explicitHotspotPipeline)&&smsPhone)jobs.push(["sms",async()=>smsService.sendNotification({to:smsPhone,message:await textFor("sms"),event:explicitHotspotPipeline?"manual":smsEvent(eventName),variables:context,settings,useMessageDirectly:true})]);
 const explicitHotspotRenewalWhatsApp=type==="hotspot"&&eventName==="renewal"&&selected?.has("whatsapp");
 if(whatsappChannelEnabled&&(whatsappRuleEnabled||explicitHotspotRenewalWhatsApp||explicitHotspotPipeline)&&validWhatsAppPhone)jobs.push(["whatsapp",async()=>whatsappService.sendMessage({to:recipientPhone,message:await textFor("whatsapp"),event:rawEvent||eventName})]);
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
   return emailOutboxService.enqueueEmail({to:recipientEmail,subject,html,text,event:rawEvent||eventName,idempotencyKey:variables.email_idempotency_key||undefined,client:emailClient});
  }]);
 }
 const settled=await Promise.allSettled(jobs.map(([,run])=>Promise.resolve().then(run)));
 const channelResults=settled.map((r,i)=>({channel:jobs[i][0],status:r.status,...(r.status==="fulfilled"?{result:r.value}:{error:String(r.reason?.message||r.reason).slice(0,300)})}));
 if(type==="hotspot"&&eventName==="renewal"){
  const whatsappResult=channelResults.find(result=>result.channel==="whatsapp")||{status:"skipped",reason:!validWhatsAppPhone?"invalid_phone":!whatsappChannelEnabled?"channel_disabled":"rule_disabled"};
  console.log("[Hotspot WhatsApp Alert] Status:",whatsappResult);
 }
 return {success:settled.every(r=>r.status==="fulfilled"&&(r.value?.success!==false)),event:eventName,userType:type,results:channelResults};
}
function dispatchNotification(payload={}){
 // Intentionally detached from request lifecycles: delivery cannot delay or roll back billing.
 const task=Promise.resolve().then(()=>dispatchNow(payload)).catch(error=>({success:false,error:String(error?.message||error)}));
 task.then(result=>{if(!result.success)console.warn("[Notification Hub] One or more channel deliveries failed:",JSON.stringify({event:payload.event,userType:payload.userType,results:result.results||[],error:result.error}));});
 return {accepted:true,task};
}
async function testChannel(channel,{to,message="FAZ NETWORK test notification"}={}){
 const settings=await settingsService.getAllSettings();
 if(channel==="sms"){if(String(settings.sms_provider_mode||settings.sms_gateway_mode||"disabled")==="disabled")throw new Error("SMS engine is disabled. Select a provider mode and save settings first.");return smsService.sendSms({to,message,event:"manual",settings});}
 if(channel==="whatsapp")return whatsappService.sendMessage({to,message});
 throw new Error("Unsupported notification channel.");
}
module.exports={dispatchNotification,dispatchNow,testChannel,normalizePhone,normalizeSmsPhone,eventKey,renewalRuleEvents,extractCustomerPhone,isValidBdWhatsAppPhone};
