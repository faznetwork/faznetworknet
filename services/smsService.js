"use strict";
const settingsService=require("./appSettings");
const deliveryLog=require("./notificationDeliveryLog");
const EVENT_CONFIG={
 expiry_warning:{enabled:"sms_event_expiry_warning",template:"sms_template_expiry_warning"},
 payment_receipt:{enabled:"sms_event_payment_receipt",template:"sms_template_payment_receipt"},
 payment:{enabled:"sms_event_payment_receipt",template:"sms_template_payment_receipt"},
 recharge:{enabled:"sms_event_payment_receipt",template:"sms_template_payment_receipt"},
 renewal:{enabled:"sms_event_payment_receipt",template:"sms_template_payment_receipt"},
 welcome:{enabled:"sms_event_welcome",template:"sms_template_welcome"},
 line_expiry:{enabled:"sms_event_line_expiry",template:"sms_template_line_block"},
 expired:{enabled:"sms_event_line_expiry",template:"sms_template_line_block"}
};
const MODES=new Set(["disabled","personal_device","bulk_sms","custom_http","provider_preset"]);
const HTTP_METHODS=new Set(["GET","POST_JSON","POST_FORM"]);
function normalizeMethod(value){const method=String(value||"POST_JSON").toUpperCase();return method==="POST"?"POST_JSON":method;}
const DEFAULT_MAPPING={to:"{to}",message:"{message}",token:"{token}",sender_id:"{sender_id}"};
const LEGACY_BULK_MAPPING={phone:"{to}",to:"{to}",message:"{message}",sender_id:"{sender_id}",senderid:"{sender_id}",token:"{token}"};
function withTimeout(promise,ms=8000){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("SMS provider request timed out.")),ms);})]).finally(()=>clearTimeout(timer));}
function safeText(value,max=1200){return String(value??"").trim().slice(0,max);}
function renderTemplate(template,variables={}){
 const source=String(template??"");const values={...variables};
 if(values.company_name&&!values.company)values.company=values.company_name;
 if(values.new_expiry_date&&!values.expiry_date)values.expiry_date=values.new_expiry_date;
 if(values.trx_id&&!values.transaction_id)values.transaction_id=values.trx_id;
 return source.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(whole,key)=>!Object.prototype.hasOwnProperty.call(values,key)||values[key]===null||values[key]===undefined?whole:String(values[key]).slice(0,300)).slice(0,1200);
}
function eventTemplate(settings,event,variables={},fallbackMessage=""){
 const config=EVENT_CONFIG[event];if(!config)return renderTemplate(fallbackMessage,variables);
 const template=String(settings[config.template]||"");return renderTemplate(template||fallbackMessage,variables);
}
function parseMapping(value,fallback=DEFAULT_MAPPING){
 if(value&&typeof value==="object"&&!Array.isArray(value))return value;
 try{const parsed=JSON.parse(String(value||""));if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))return parsed;}catch(_){}
 return fallback;
}
function safeEndpoint(value){
 let parsed;try{parsed=new URL(String(value||""));}catch(_){throw new Error("A valid HTTP(S) SMS endpoint URL is required.");}
 if(!["http:","https:"].includes(parsed.protocol)||parsed.username||parsed.password)throw new Error("SMS endpoint must be an HTTP(S) URL without embedded credentials.");
 return parsed;
}
function mappedParams(mapping,context){
 const params={};
 for(const [rawKey,rawValue] of Object.entries(mapping||{})){
  const key=safeText(rawKey,100);if(!key)continue;
  const value=String(rawValue??"");
  params[key]=renderTemplate(value,context).slice(0,2000);
 }
 return params;
}
async function requestProvider({url,method,params,token}){
 const endpoint=safeEndpoint(url),values={...params};
 if(method==="GET"){
  for(const [key,value] of Object.entries(values))endpoint.searchParams.set(key,String(value));
  const response=await withTimeout(fetch(endpoint,{method:"GET",redirect:"error",headers:{Accept:"application/json,text/plain"}}));
  return parseResponse(response);
 }
 const headers={Accept:"application/json,text/plain"};
 let body;
 if(method==="POST_FORM"){
  headers["Content-Type"]="application/x-www-form-urlencoded;charset=UTF-8";
  body=new URLSearchParams(Object.entries(values).map(([k,v])=>[k,String(v)]));
 }else{
  headers["Content-Type"]="application/json";
  body=JSON.stringify(values);
 }
 const response=await withTimeout(fetch(endpoint,{method:"POST",headers,body,redirect:"error"}));
 return parseResponse(response);
}
async function parseResponse(response){
 const text=await response.text().catch(()=> "");
 let data={};try{data=text?JSON.parse(text):{};}catch(_){data={response:text.slice(0,500)};}
 if(!response.ok)throw new Error("SMS provider returned HTTP "+response.status+(data?.message?": "+String(data.message).slice(0,180):"."));
 if(data&&typeof data==="object"&&(data.success===false||String(data.status||"").toLowerCase()==="error"||(data.error!==undefined&&Number(data.error)!==0)))throw new Error("SMS provider rejected the request"+(data.msg||data.message?": "+String(data.msg||data.message).slice(0,180):"."));
 return {httpStatus:response.status,data};
}
function presetConfig(settings){
 const preset=String(settings.sms_provider_preset||"custom").toLowerCase();
 const known={
  greenweb:{endpoint:"https://api.greenweb.com.bd/api.php",method:"POST_FORM",mapping:{token:"{token}",to:"{to}",message:"{message}",senderid:"{sender_id}"}},
  alpha_sms:{endpoint:"https://api.sms.net.bd/sendsms",method:"POST_FORM",mapping:{api_key:"{token}",to:"{to}",msg:"{message}",sender_id:"{sender_id}"}},
  elitbuzz:{endpoint:"https://msg.elitbuzz-bd.com/smsapi",method:"POST_FORM",mapping:{api_key:"{token}",type:"text",contacts:"{to}",msg:"{message}",senderid:"{sender_id}"}}
 };
 return known[preset]||{endpoint:"",method:"POST_JSON",mapping:DEFAULT_MAPPING};
}
async function sendSmsCore({to,phone,message,event="manual",variables={},token:overrideToken,settings:providedSettings}={}){
 const settings=providedSettings||await settingsService.getAllSettings();
 const mode=String(settings.sms_provider_mode||settings.sms_gateway_mode||"disabled");
 const recipient=safeText(phone||to,40),text=renderTemplate(message,variables);
 if(mode==="disabled"||!MODES.has(mode)){if(mode==="disabled")return {success:true,skipped:true,reason:"sms_gateway_disabled"};throw new Error("Unsupported SMS gateway mode.");}
 if(!recipient||!text)throw new Error("SMS recipient and message are required.");
 const sender=safeText(settings.sms_sender_id,80),apiToken=String(overrideToken||settings.sms_api_key||"");
 const context={to:recipient,phone:recipient,recipient,message:text,text,token:apiToken,api_key:apiToken,password:apiToken,secret:apiToken,sender_id:sender,senderid:sender,event,...variables};
 let endpoint,method,mapping;
 if(mode==="personal_device"){
  endpoint=safeText(settings.sms_device_webhook_url||settings.sms_device_url,1000);
  method=normalizeMethod(settings.sms_device_http_method||"POST_JSON");
  mapping=parseMapping(settings.sms_device_param_mapping,DEFAULT_MAPPING);
 }else{
  const preset=mode==="provider_preset"?presetConfig(settings):null;
  endpoint=safeText(settings.sms_api_url||preset?.endpoint,1000);
  method=normalizeMethod(settings.sms_api_method||preset?.method||"POST_JSON");
  mapping=parseMapping(settings.sms_http_param_mapping,preset?.mapping||DEFAULT_MAPPING);
  if(mode==="bulk_sms"&&JSON.stringify(mapping)===JSON.stringify(DEFAULT_MAPPING))mapping=LEGACY_BULK_MAPPING;
 }
 if(!HTTP_METHODS.has(method))throw new Error("Unsupported SMS HTTP method. Choose GET, POST_JSON or POST_FORM.");
 if(!endpoint)throw new Error("Configure the SMS provider endpoint URL before sending.");
 const params=mappedParams(mapping,context);
 // If the admin did not map a token field, use bearer auth as a safe generic fallback.
 const hasTokenMapping=Object.values(mapping||{}).some(v=>/\{(?:token|api_key|password|secret)\}/i.test(String(v)));
 if(apiToken&&!hasTokenMapping&&mode!=="personal_device"){
  const url=safeEndpoint(endpoint);
  const headers={Authorization:"Bearer "+apiToken,Accept:"application/json,text/plain"};
  let body;
  if(method==="GET"){for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));}
  else if(method==="POST_FORM"){headers["Content-Type"]="application/x-www-form-urlencoded;charset=UTF-8";body=new URLSearchParams(Object.entries(params).map(([k,v])=>[k,String(v)]));}
  else{headers["Content-Type"]="application/json";body=JSON.stringify(params);}
  const response=await withTimeout(fetch(url,{method:method==="GET"?"GET":"POST",headers,body,redirect:"error"}));
  const providerResponse=await parseResponse(response);
  return {success:true,mode,method,providerResponse};
 }
 const providerResponse=await requestProvider({url:endpoint,method,params,token:apiToken});
 return {success:true,mode,method,providerResponse};
}
async function sendSms(args={}) {
 const settings=args.settings||await settingsService.getAllSettings();
 const mode=String(settings.sms_provider_mode||settings.sms_gateway_mode||"disabled");
 if(mode==="disabled") return sendSmsCore({...args,settings});
 const recipient=safeText(args.phone||args.to,40);
 const body=renderTemplate(args.message,args.variables||{});
 if(!recipient||!body) return sendSmsCore({...args,settings});
 const provider=deliveryLog.providerLabel({channel:"sms",mode,preset:settings.sms_provider_preset,settings});
 const vars=args.variables||{};
 const transactionId=vars.transaction_id||vars.trx_id||vars.transactionId||null;
 const attemptId=await deliveryLog.createAttempt({channel:"sms",provider,recipient,message:body,transactionId});
 try {
  const result=await sendSmsCore({...args,settings});
  await deliveryLog.finishAttempt(attemptId,{status:result?.skipped?"skipped":"sent",providerMessageId:result?.providerResponse?.data?.messageId||result?.providerResponse?.data?.message_id||null});
  return result;
 } catch(error) {
  await deliveryLog.finishAttempt(attemptId,{status:"failed",error:error?.message||error});
  throw error;
 }
}
async function sendNotification({to,phone,message,event,variables={},useMessageDirectly=false,...extra}={}){
 const settings=await settingsService.getAllSettings();const config=EVENT_CONFIG[event];
 if(config&&!settingsService.bool(settings[config.enabled]))return {success:true,skipped:true,reason:"event_disabled"};
 const resolved={company_name:settings.company_name||"FAZ NETWORK",support_phone:settings.support_phone||"",...extra,...variables};
 const rendered=useMessageDirectly?renderTemplate(message,resolved):eventTemplate(settings,event,resolved,message);
 return sendSms({to,phone,message:rendered,event,variables:resolved,settings});
}
module.exports={sendSms,sendNotification,renderTemplate,eventTemplate,EVENT_CONFIG,parseMapping,DEFAULT_MAPPING};
