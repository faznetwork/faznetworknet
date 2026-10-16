const db=require("../db");
const {normalizeProfileValidity,parseStoredValidity}=require("../services/hotspotProfileConfig");
function errorResponse(res,error,status=400){const message=String(error?.message||"Settings operation failed.");return res.status(status).json({success:false,error:message,message});}
function parseBool(value){return value===true||String(value||"").toLowerCase()==="true"||String(value||"")==="1";}
function validateUrl(value){
  const url=String(value||"").trim();
  if(!url)return "";
  if(url.startsWith("/")&&!url.startsWith("//"))return url.replace(/\/$/,"")||"/";
  let parsed;
  try{parsed=new URL(url);}catch(_){throw new Error("Webhook URL must be a valid HTTP/HTTPS URL or an absolute path.");}
  if(!["http:","https:"].includes(parsed.protocol))throw new Error("Webhook URL must use HTTP or HTTPS.");
  return parsed.toString().replace(/\/$/,"");
}
async function readSettings(){const result=await db.query("SELECT key,value FROM app_settings WHERE key IN ('personal_payment_webhook_url','personal_payment_webhook_secret','personal_payment_webhook_enabled')");const map=Object.fromEntries((result.rows||[]).map(row=>[row.key,row.value]));return {webhookUrl:String(map.personal_payment_webhook_url||""),webhookEnabled:parseBool(map.personal_payment_webhook_enabled),secretConfigured:Boolean(String(map.personal_payment_webhook_secret||""))};}
async function hotspotWebhookSettings(req,res){try{return res.json({success:true,settings:await readSettings()});}catch(error){return errorResponse(res,error,503);}}
async function hotspotProfiles(req,res){try{
 const [profilesResult,metadataResult]=await Promise.all([
  require("../services/mikrotikService").getHotspotProfiles(),
  db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1")
 ]);
 let metadata={};try{metadata=JSON.parse(metadataResult.rows[0]?.value||"{}");}catch(_){}
 if(!metadata||typeof metadata!=="object"||Array.isArray(metadata))metadata={};
 const profiles=profilesResult.map(profile=>{
  const saved=metadata[String(profile.name||"")]||{};
  let validity;try{validity=saved.validityValue?normalizeProfileValidity(saved.validityValue,saved.validityUnit):parseStoredValidity(profile);}catch(_){validity=parseStoredValidity(profile);}
  return {name:profile.name,rateLimit:profile.rateLimit,sessionTimeout:profile.sessionTimeout,sharedUsers:profile.sharedUsers,price:Number(saved.price||0),validityValue:validity.value,validityUnit:validity.unit,validityLabel:saved.validityLabel||validity.validityLabel,limitBytesTotal:Number(saved.limitBytesTotal||validity.limitBytesTotal||0),updatedAt:saved.updatedAt||null};
 });
 return res.set("Cache-Control","no-store").json({success:true,profiles});
 }catch(error){return errorResponse(res,error,503);}}
async function readHotspotProfileSettings(){const result=await db.query("SELECT key,value FROM app_settings WHERE key IN ('hotspot_price_profile_map','hotspot_default_profile')");const values=Object.fromEntries((result.rows||[]).map(row=>[row.key,row.value]));let mapping={};try{mapping=JSON.parse(values.hotspot_price_profile_map||"{}");}catch(_){}if(!mapping||typeof mapping!=="object"||Array.isArray(mapping))mapping={};return {mapping,defaultProfile:String(values.hotspot_default_profile||"")};}
async function getHotspotProfileSettings(req,res){try{return res.json({success:true,settings:await readHotspotProfileSettings()});}catch(error){return errorResponse(res,error,503);}}
async function saveHotspotProfileSettings(req,res){try{const body=req.body||{},mapping=body.mapping&&typeof body.mapping==="object"&&!Array.isArray(body.mapping)?body.mapping:{},defaultProfile=String(body.defaultProfile||"").trim();const normalized={};for(const [rawAmount,rawProfile] of Object.entries(mapping)){const amount=Number(rawAmount),profile=String(rawProfile||"").trim();if(!profile)continue;if(!Number.isFinite(amount)||amount<0||amount>1000000)throw new Error("Each mapping must use a valid payment amount.");normalized[amount.toFixed(2)]=profile;}const profiles=await require("../services/mikrotikService").getHotspotProfiles(),available=new Set(profiles.map(p=>String(p.name||"").toLowerCase()));for(const profile of [...Object.values(normalized),...(defaultProfile?[defaultProfile]:[])])if(!available.has(profile.toLowerCase()))throw new Error("Hotspot profile is not available on MikroTik: "+profile);await db.query("INSERT INTO app_settings(key,value,updated_at) VALUES('hotspot_price_profile_map',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[JSON.stringify(normalized)]);await db.query("INSERT INTO app_settings(key,value,updated_at) VALUES('hotspot_default_profile',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[defaultProfile]);return res.json({success:true,message:"Hotspot package/profile settings saved successfully.",settings:{mapping:normalized,defaultProfile}});}catch(error){return errorResponse(res,error,400);}}
async function saveHotspotWebhookSettings(req,res){try{const body=req.body||{},webhookUrl=validateUrl(body.webhookUrl),webhookEnabled=parseBool(body.webhookEnabled),newSecret=String(body.webhookSecret||"").trim();if(webhookEnabled&&!webhookUrl)throw new Error("Webhook URL is required when automation is enabled.");const current=await db.query("SELECT value FROM app_settings WHERE key='personal_payment_webhook_secret' LIMIT 1"),currentSecret=String(current.rows[0]?.value||"");if(webhookEnabled&&!newSecret&&!currentSecret)throw new Error("Webhook Secret Key / Token is required when automation is enabled.");const secret=newSecret||currentSecret;for(const [key,value] of [["personal_payment_webhook_url",webhookUrl],["personal_payment_webhook_enabled",webhookEnabled?"true":"false"],["personal_payment_webhook_secret",secret]])await db.query("INSERT INTO app_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[key,value]);return res.json({success:true,message:"Hotspot Webhook settings saved successfully.",settings:await readSettings()});}catch(error){return errorResponse(res,error,400);}}

const mikrotikService=require("../services/mikrotikService");
const ROUTER_KEYS=["mikrotik_host","mikrotik_port","mikrotik_user","mikrotik_password"];
const MFS_KEYS={bkash:"mfs_bkash_number",nagad:"mfs_nagad_number",rocket:"mfs_rocket_number",upay:"mfs_upay_number"};
async function upsertSetting(key,value){await db.query("INSERT INTO app_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[key,String(value??"")]);try{require("../services/appSettings").invalidate();}catch(_){}}
async function getSettingsMap(keys){const result=await db.query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])",[keys]);return Object.fromEntries((result.rows||[]).map(row=>[row.key,row.value]));}
async function generalSettings(req,res){
 try{
  const keys=[...ROUTER_KEYS,"personal_payment_webhook_url","personal_payment_webhook_enabled","personal_payment_webhook_secret",...Object.values(MFS_KEYS)];
  const s=await getSettingsMap(keys);
  return res.set("Cache-Control","no-store").json({success:true,settings:{
   router:{host:s.mikrotik_host||process.env.ROUTER_HOST||"",port:Number(s.mikrotik_port||process.env.ROUTER_PORT||8728),user:s.mikrotik_user||process.env.ROUTER_USER||"",passwordConfigured:Boolean(s.mikrotik_password||process.env.ROUTER_PASS),passwordSource:s.mikrotik_password?"database":process.env.ROUTER_PASS?"environment":"unset"},
   webhook:{url:s.personal_payment_webhook_url||"/api/webhooks/macrodroid-sms",enabled:parseBool(s.personal_payment_webhook_enabled),secretConfigured:Boolean(s.personal_payment_webhook_secret)},
   mfs:Object.fromEntries(Object.entries(MFS_KEYS).map(([name,key])=>[name,String(s[key]||"")]))
  }});
 }catch(error){return errorResponse(res,error,503);}
}
async function testMikrotik(req,res){
 try{
  const body=req.body||{},current=await getSettingsMap(ROUTER_KEYS);
  const config={host:String(body.host??current.mikrotik_host??process.env.ROUTER_HOST??"").trim(),port:Number(body.port??current.mikrotik_port??process.env.ROUTER_PORT??8728),user:String(body.user??current.mikrotik_user??process.env.ROUTER_USER??"").trim(),password:String(body.password||current.mikrotik_password||process.env.ROUTER_PASS||"")};
  const router=await mikrotikService.testConnection(config);
  return res.set("Cache-Control","no-store").json({success:true,message:"Router connection successful.",router});
 }catch(error){const message=String(error?.message||"MikroTik connection failed.");return res.status(502).json({success:false,message,error:message});}
}
async function syncMikrotikProfilesInternal(){
 const [pppoeProfiles,hotspotProfiles]=await Promise.all([mikrotikService.fetchExistingProfiles(),mikrotikService.getHotspotProfiles()]);
 for(const p of pppoeProfiles){
  await db.query("INSERT INTO pppoe_profiles(name,rate_limit,local_address,remote_address,session_timeout,idle_timeout,only_one,change_tcp_mss,comment,router_id,raw_config,synced_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW(),NOW()) ON CONFLICT(name) DO UPDATE SET rate_limit=EXCLUDED.rate_limit,local_address=EXCLUDED.local_address,remote_address=EXCLUDED.remote_address,session_timeout=EXCLUDED.session_timeout,idle_timeout=EXCLUDED.idle_timeout,only_one=EXCLUDED.only_one,change_tcp_mss=EXCLUDED.change_tcp_mss,comment=EXCLUDED.comment,router_id=EXCLUDED.router_id,raw_config=EXCLUDED.raw_config,synced_at=NOW(),updated_at=NOW()",[p.name,p.rateLimit,p.localAddress,p.remoteAddress,p.sessionTimeout,p.idleTimeout,Boolean(p.onlyOne),String(p.changeTcpMss||"").toLowerCase()==="yes",p.comment||"",p.id||null,JSON.stringify(p.raw||p)]);
 }
 const current=await getSettingsMap(["hotspot_profile_metadata"]);let metadata={};try{metadata=JSON.parse(current.hotspot_profile_metadata||"{}");}catch(_){}
 if(!metadata||typeof metadata!=="object"||Array.isArray(metadata))metadata={};
 for(const p of hotspotProfiles){const name=String(p.name||"");if(!metadata[name])metadata[name]={};}
 await upsertSetting("hotspot_profile_metadata",JSON.stringify(metadata));
 return {pppoeProfiles:pppoeProfiles.length,hotspotProfiles:hotspotProfiles.length,message:"Live MikroTik profiles synced into the local profile cache. Existing prices, profile metadata, and customer records were preserved."};
}
async function saveMikrotik(req,res){
 try{
  const body=req.body||{},host=String(body.host||"").trim(),user=String(body.user||"").trim(),port=Number(body.port),password=String(body.password||"");
  if(!host||host.length>253)throw new Error("Enter a valid Router Host / IP.");
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error("API Port must be between 1 and 65535.");
  if(!user||user.length>128)throw new Error("Enter a valid API Username.");
  const existing=await getSettingsMap(ROUTER_KEYS),resolvedPassword=password||String(existing.mikrotik_password||process.env.ROUTER_PASS||"");
  if(!resolvedPassword)throw new Error("API Password is required for the first save.");
  const router=await mikrotikService.testConnection({host,port,user,password:resolvedPassword});
  for(const [key,value] of [["mikrotik_host",host],["mikrotik_port",port],["mikrotik_user",user],["mikrotik_password",resolvedPassword]])await upsertSetting(key,value);
  const sync=await syncMikrotikProfilesInternal();
  return res.json({success:true,message:"Router credentials saved and profile sync completed.",router,sync,passwordConfigured:true});
 }catch(error){return errorResponse(res,error,400);}
}
async function syncMikrotik(req,res){
 try{return res.json({success:true,message:"MikroTik profile synchronization completed.",sync:await syncMikrotikProfilesInternal()});}
 catch(error){return errorResponse(res,error,502);}
}
async function saveGeneralSettings(req,res){
 try{
  const body=req.body||{},mfs=body.mfs&&typeof body.mfs==="object"?body.mfs:body,normalized={};
  for(const [name] of Object.entries(MFS_KEYS)){const value=String(mfs[name]??"").trim();if(value&&!/^[+()\d\s-]{8,24}$/.test(value))throw new Error("Enter a valid "+name+" Send Money number.");normalized[name]=value;}
  for(const [name,key] of Object.entries(MFS_KEYS))await upsertSetting(key,normalized[name]);
  return res.set("Cache-Control","no-store").json({success:true,message:"MFS receiving numbers saved. Customer payment instructions update immediately.",accounts:normalized});
 }catch(error){return errorResponse(res,error,400);}
}
async function saveMfsAccounts(req,res){
 try{
  const body=req.body||{},normalized={};
  for(const [name] of Object.entries(MFS_KEYS)){const value=String(body[name]??"").trim();if(value&&!/^[+()\d\s-]{8,24}$/.test(value))throw new Error("Enter a valid "+name+" Send Money number.");normalized[name]=value;}
  for(const [name,key] of Object.entries(MFS_KEYS))await upsertSetting(key,normalized[name]);
  return res.json({success:true,message:"Personal MFS Send Money accounts saved.",accounts:normalized});
 }catch(error){return errorResponse(res,error,400);}
}


const appSettingsService=require("../services/appSettings");
const SETTINGS_RULES={
 company_name:{max:160},public_base_url:{url:true,max:500},logo_url:{url:true,max:1000},favicon_url:{url:true,max:1000},
 support_phone:{phone:true,max:40},whatsapp_number:{phone:true,max:24},office_address:{max:1000},btrc_license_number:{max:200},footer_copyright:{max:300},
 billing_cycle_type:{oneOf:["monthly_1st","rolling_30"]},grace_period_days:{numberMin:0,numberMax:7},expiry_action:{oneOf:["quarantine","disable_secret"]},
 personal_payment_webhook_url:{pathOrUrl:true,max:500},personal_payment_webhook_enabled:{bool:true},personal_payment_webhook_secret:{secret:true,max:300},
 mfs_bkash_number:{phone:true,max:24},mfs_nagad_number:{phone:true,max:24},mfs_rocket_number:{phone:true,max:24},mfs_upay_number:{phone:true,max:24},
 sms_gateway_mode:{oneOf:["bulk_sms","personal_device","provider_preset","custom_http","disabled"]},sms_provider_mode:{oneOf:["bulk_sms","personal_device","provider_preset","custom_http","disabled"]},
 sms_provider_preset:{oneOf:["greenweb","alpha_sms","elitbuzz","custom"]},sms_api_url:{url:true,max:1000},sms_api_key:{secret:true,max:1000},sms_sender_id:{max:80},sms_api_method:{oneOf:["GET","POST","POST_JSON","POST_FORM"]},
 sms_http_param_mapping:{json:true,max:4000},sms_device_url:{url:true,max:1000},sms_device_webhook_url:{url:true,max:1000},sms_device_token:{secret:true,max:500},sms_device_http_method:{oneOf:["GET","POST","POST_JSON","POST_FORM"]},sms_device_param_mapping:{json:true,max:4000},
 notification_channel_sms_enabled:{bool:true},notification_channel_whatsapp_enabled:{bool:true},notification_channel_email_enabled:{bool:true},whatsapp_enabled:{bool:true},
 email_provider_mode:{oneOf:["apps_script","smtp"]},email_apps_script_url:{appsScriptUrl:true,max:1000},email_apps_script_token:{secret:true,max:1000},smtp_host:{max:253},smtp_port:{numberMin:1,numberMax:65535},smtp_secure:{bool:true},smtp_username:{max:254},smtp_password:{secret:true,max:1000},email_from_name:{max:160},email_from_address:{email:true,max:254},
 sms_event_expiry_warning:{bool:true},sms_event_payment_receipt:{bool:true},sms_event_line_expiry:{bool:true},sms_event_welcome:{bool:true},
 sms_template_expiry_warning:{max:1200},sms_template_payment_receipt:{max:1200},sms_template_line_block:{max:1200},sms_template_welcome:{max:1200}
};
for(const type of ["hotspot","pppoe"])for(const event of ["payment","recharge","renewal","welcome","expiry_warning","expired"])for(const channel of ["sms","whatsapp","email"])SETTINGS_RULES["notification_rule_"+type+"_"+event+"_"+channel+"_enabled"]={bool:true};
function validateSettingValue(key,value,rule){
 if(rule.bool)return parseBool(value)?"true":"false";
 if(rule.json){let parsed=value;if(typeof value==="string"){try{parsed=JSON.parse(value||"{}");}catch(_){throw new Error(key+" must be valid JSON.");}}if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw new Error(key+" must be a JSON object.");if(Object.keys(parsed).length>40)throw new Error(key+" has too many parameters.");return JSON.stringify(parsed);}
 if(rule.oneOf&&!rule.oneOf.includes(String(value)))throw new Error("Invalid value for "+key+".");
 if(rule.numberMin!==undefined){const n=Number(value);if(!Number.isInteger(n)||n<rule.numberMin||n>rule.numberMax)throw new Error(key+" must be between "+rule.numberMin+" and "+rule.numberMax+".");return String(n);}
 let out=String(value??"").trim();
 if(out.length>(rule.max||1000))throw new Error(key+" is too long.");
 if(rule.phone&&out&&!/^[+()\d\s-]{6,40}$/.test(out))throw new Error("Enter a valid phone number for "+key+".");
 if(rule.url&&out){let u;try{u=new URL(out);}catch(_){throw new Error(key+" must be a valid HTTP(S) URL.");}if(!["http:","https:"].includes(u.protocol))throw new Error(key+" must use HTTP or HTTPS.");out=u.toString();}
 if(rule.pathOrUrl&&out)out=validateUrl(out);
 if(rule.appsScriptUrl&&out){let parsed;try{parsed=new URL(out);}catch(_){throw new Error(key+" must be a valid Google Apps Script Web App URL.");}if(parsed.protocol!=="https:"||parsed.hostname!=="script.google.com"||!/^\/macros\/s\/[^/]+\/exec\/?$/.test(parsed.pathname))throw new Error(key+" must be an HTTPS Google Apps Script URL ending in /macros/s/…/exec.");out=parsed.toString();}
 if(rule.email&&out&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out))throw new Error(key+" must be a valid email address.");
 return out;
}
async function getAllSettings(req,res){
 try{
  const map=await appSettingsService.getAllSettings();
  const out={...map};
  for(const key of ["personal_payment_webhook_secret","sms_api_key","sms_device_token","smtp_password","email_apps_script_token","mikrotik_password"])delete out[key];
  out.personal_payment_webhook_secret_configured=Boolean(map.personal_payment_webhook_secret);out.email_apps_script_token_configured=Boolean(map.email_apps_script_token);
  out.sms_api_key_configured=Boolean(map.sms_api_key);
  out.sms_device_token_configured=Boolean(map.sms_device_token);out.smtp_password_configured=Boolean(map.smtp_password);
  return res.set("Cache-Control","no-store").json({success:true,settings:out});
 }catch(error){return errorResponse(res,error,503);}
}
async function updateSettings(req,res){
 try{
  const input=req.body?.settings&&typeof req.body.settings==="object"?req.body.settings:(req.body||{});
  const updates=[];
  for(const [key,rule] of Object.entries(SETTINGS_RULES)){
   if(!Object.prototype.hasOwnProperty.call(input,key))continue;
   const raw=input[key];
   if(rule.secret&&String(raw??"").trim()==="")continue;
   updates.push([key,validateSettingValue(key,raw,rule)]);
  }
  if(!updates.length)throw new Error("No supported settings were supplied.");
  for(const [key,value] of updates)await upsertSetting(key,value);
  appSettingsService.invalidate();
  const all=await appSettingsService.getAllSettings();
  const safe={...all};
  for(const key of ["personal_payment_webhook_secret","sms_api_key","sms_device_token","smtp_password","email_apps_script_token","mikrotik_password"])delete safe[key];
  safe.personal_payment_webhook_secret_configured=Boolean(all.personal_payment_webhook_secret);safe.email_apps_script_token_configured=Boolean(all.email_apps_script_token);
  safe.sms_api_key_configured=Boolean(all.sms_api_key);
  safe.sms_device_token_configured=Boolean(all.sms_device_token);safe.smtp_password_configured=Boolean(all.smtp_password);
  return res.set("Cache-Control","no-store").json({success:true,message:"System settings saved. Cached branding/settings refreshed.",settings:safe,updatedKeys:updates.map(([key])=>key)});
 }catch(error){return errorResponse(res,error,400);}
}
async function publicSettings(req,res){
 try{
  const brand=await appSettingsService.getBrandSettings();
  const all=await appSettingsService.getAllSettings();
  return res.set("Cache-Control","public, max-age=30").json({success:true,settings:{...brand,payment_accounts:{bkash:all.mfs_bkash_number||"",nagad:all.mfs_nagad_number||"",rocket:all.mfs_rocket_number||"",upay:all.mfs_upay_number||""}}});
 }catch(error){return res.status(503).json({success:false,message:"Public settings temporarily unavailable."});}
}


async function testNotification(req,res){
 try{
  const channel=String(req.body?.channel||"sms").toLowerCase(),to=String(req.body?.to||"").trim(),message=String(req.body?.message||"FAZ NETWORK test notification").trim();
  if(channel==="sms"||channel==="whatsapp"){if(!to)throw new Error("A recipient mobile number is required.");}
  const result=await require("../services/notificationDispatcher").testChannel(channel,{to,message});
  return res.set("Cache-Control","no-store").json({success:true,message:"Test notification request completed.",result});
 }catch(error){return errorResponse(res,error,502);}
}
async function whatsappStatus(req,res){try{return res.set("Cache-Control","no-store").json({success:true,status:require("../services/whatsappService").getStatus()});}catch(error){return errorResponse(res,error,503);}}
async function testWhatsApp(req,res){
 try{
  const to=String(req.body?.to||req.body?.phone||"").trim();
  const message=String(req.body?.message||"").trim();
  if(!to)throw new Error("Recipient mobile number is required.");
  if(!message)throw new Error("Test message is required.");
  if(message.length>4000)throw new Error("Test message must be 4000 characters or fewer.");
  const result=await require("../services/notificationDispatcher").testChannel("whatsapp",{to,message});
  return res.set("Cache-Control","no-store").json({success:true,message:"WhatsApp test message sent to the gateway successfully.",result});
 }catch(error){return errorResponse(res,error,502);}
}
async function whatsappConnect(req,res){try{return res.set("Cache-Control","no-store").json({success:true,status:await require("../services/whatsappService").connect()});}catch(error){return errorResponse(res,error,502);}}
async function whatsappUnlink(req,res){try{return res.set("Cache-Control","no-store").json({success:true,status:await require("../services/whatsappService").unlink()});}catch(error){return errorResponse(res,error,502);}}

module.exports={testNotification,testWhatsApp,testEmail,whatsappStatus,whatsappConnect,whatsappUnlink,hotspotWebhookSettings,saveHotspotWebhookSettings,website:hotspotWebhookSettings,saveWebsite:saveHotspotWebhookSettings,hotspotProfiles,getHotspotProfileSettings,saveHotspotProfileSettings,generalSettings,saveGeneralSettings,testMikrotik,saveMikrotik,syncMikrotik,saveMfsAccounts,getAllSettings,updateSettings,publicSettings};
