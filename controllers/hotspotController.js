const crypto=require("crypto");const db=require("../db");const mikrotikService=require("../services/mikrotikService");const {normalizeProfileValidity,parseStoredValidity,resolveHotspotPackage,buildHotspotOnLoginScript}=require("../services/hotspotProfileConfig");const {syncHotspotProfileScripts}=require("../jobs/hotspotProfileScriptSync");const {syncAllPopPackages}=require("../services/resellerHotspotPackageSyncService");
const notificationDispatcher=require("../services/notificationDispatcher");
const hotspotRenewalOperations=require("../services/hotspotRenewalOperationService");
const hotspotVoucherGenerator=require("../services/hotspotVoucherGenerator");
const {deleteHotspotSubscriber}=require("../services/hotspotDeletionService");
const {normalizeSalesCategory,transactionCategorySql}=require("../services/hotspotSalesCategory");
function clean(v,max=255){return String(v??"").trim().slice(0,max)}
function booleanValue(value){return value===true||value===1||["true","yes","1"].includes(String(value??"").trim().toLowerCase())}
function normalizeHotspotPhone(value){const bangla="০১২৩৪৫৬৭৮৯";let digits=String(value??"").replace(/[০-৯]/g,ch=>String(bangla.indexOf(ch))).replace(/\D/g,"");if(digits.startsWith("880")&&digits.length===13)digits="0"+digits.slice(3);return digits;}
function normalizeHotspotMac(value){const compact=String(value??"").trim().replace(/[:-]/g,"");return /^[0-9a-fA-F]{12}$/.test(compact)?compact.match(/.{2}/g).join(":").toUpperCase():"";}
function normalizeProfileIdentifier(value){return String(value??"").normalize("NFKC").trim().toLowerCase().replace(/\b(hours?|hrs?)\b/g,"h").replace(/\b(minutes?|mins?)\b/g,"m").replace(/\b(seconds?|secs?)\b/g,"s").replace(/\b(days?)\b/g,"d").replace(/\b(weeks?)\b/g,"w").replace(/\b(months?)\b/g,"mo").replace(/[^a-z0-9]/g,"");}
function profileIdentifierMatches(profileName,metadata,requested){if(!requested)return false;const aliases=[profileName,metadata?.id,metadata?.profileId,metadata?.profile_id,metadata?.packageId,metadata?.package_id,metadata?.packageName,metadata?.package_name,metadata?.alias,metadata?.aliases];const target=normalizeProfileIdentifier(requested);return Boolean(target)&&aliases.flatMap(value=>Array.isArray(value)?value:[value]).filter(value=>value!==undefined&&value!==null&&String(value).trim()!=="").some(value=>normalizeProfileIdentifier(value)===target);}
function hotspotError(code,statusCode,message){const error=new Error(message);error.code=code;error.statusCode=statusCode;return error;}
function errorResponse(res,e){console.error("[Hotspot API]",e);const message=e?.message||"Hotspot operation failed.";return res.status(e?.statusCode||503).json({success:false,users:[],profiles:[],message,error:message});}
function normalizeFilter(value){const filter=String(value||"all").trim().toLowerCase();return ["all","online","active","offline","expired"].includes(filter)?filter:"all";}
function validityMs(value){const m=String(value||"").trim().match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/i);if(!m)return 0;const n=Number(m[1]),u=m[2].toLowerCase();const unit=u.startsWith("s")?1000:u.startsWith("m")?60000:u.startsWith("h")?3600000:u.startsWith("w")?604800000:86400000;return n*unit;}
function voucherValidUntil(createdAt,validity){const ms=validityMs(validity);return ms?new Date(new Date(createdAt).getTime()+ms):null;}
function hotspotExpiryComment(validity){const ms=validityMs(validity);if(!ms)return "";return "Exp: "+new Date(Date.now()+ms+6*60*60*1000).toISOString().slice(0,10);}
async function page(req,res){res.render("hotspot",{title:"Hotspot Vouchers",page:"hotspot"});}
async function readProfileMetadata(){const r=await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");try{const v=JSON.parse(r.rows[0]?.value||"{}");return v&&typeof v==="object"&&!Array.isArray(v)?v:{};}catch(_){return {};}}
async function ensureCalendarProfile(profile, routerProfile, profileValidity) {
  const existing = String(routerProfile?.raw?.["on-login"] || "");
  if (existing.includes("FAZ|EXP=PENDING|PROF=")) return { updated: false };
  if (typeof mikrotikService.updateHotspotProfile !== "function") return { updated: false, skipped: true };
  const onLogin = buildHotspotOnLoginScript({
    name: profile,
    sharedUsers: Number(routerProfile?.sharedUsers) || 1,
    validityValue: profileValidity.value,
    validityUnit: profileValidity.unit
  });
  const customScript = existing.trim() && !existing.includes("FAZ|PROFILE=") ? " ; " + existing.trim() : "";
  const result = await mikrotikService.updateHotspotProfile({
    name: profile,
    rateLimit: routerProfile.rateLimit,
    sharedUsers: Number(routerProfile.sharedUsers) || 1,
    sessionTimeout: profileValidity.validity,
    clearSessionTimeout: false,
    keepaliveTimeout: routerProfile.keepaliveTimeout,
    onLogin: onLogin + customScript
  });
  return { updated: true, result };
}
async function writeProfileMetadata(v){await db.query("INSERT INTO app_settings(key,value,updated_at) VALUES('hotspot_profile_metadata',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[JSON.stringify(v)]);}
// Panel is the master for POP packages: after a profile change, sync every
// POP's package rows from core metadata. Best-effort — the router profile
// and metadata are already saved, so a POP sync failure is reported as a
// warning instead of rolling the profile change back.
async function syncPopPackagesBestEffort(){
 try{
  const results=await syncAllPopPackages(db);
  return {popSync:results};
 }catch(error){
  const warning="Panel profile saved, but POP packages could not be synced: "+String(error.message||error).slice(0,200);
  console.warn("[Hotspot POP package sync]",warning);
  return {popSyncWarning:warning};
 }
}
async function servers(req,res){try{const data=await mikrotikService.getHotspotServers();return res.json({success:true,servers:data.map(s=>({name:s.name,interface:s.interface,profile:s.profile}))});}catch(e){return errorResponse(res,e);}}
async function listServerProfiles(req,res){try{const profiles=await mikrotikService.getHotspotServerProfiles();return res.set("Cache-Control","no-store").json({success:true,profiles:profiles.filter(profile=>String(profile.name||"").trim().toLowerCase()!=="default").map(profile=>({...profile,loginBy:String(profile.loginBy||"").split(",").map(value=>value.trim()).filter(Boolean)}))});}catch(e){return errorResponse(res,e);}}
async function listMikrotikFiles(req,res){try{const directories=await mikrotikService.getMikrotikDirectories();return res.set("Cache-Control","no-store").json({success:true,directories});}catch(e){return errorResponse(res,e);}}
async function listServerProfileOptions(req,res){try{const options=await mikrotikService.getHotspotServerProfileOptions();return res.set("Cache-Control","no-store").json({success:true,...options});}catch(e){return errorResponse(res,e);}}
function serverProfilePayload(body={}){
 const textFields={hotspotAddress:64,dnsName:255,htmlDirectory:255,htmlDirectoryOverride:255,httpProxy:64,smtpServer:64,macAuthPassword:255,httpCookieLifetime:64,sslCertificate:255,trialUptimeLimit:64,trialUptimeReset:64,trialUserProfile:100,radiusDefaultDomain:255,radiusLocationId:255,radiusLocationName:255,radiusMacFormat:64,radiusInterimUpdate:64,nasPortType:64,rateLimit:128};
 const payload={};
 for(const [key,max] of Object.entries(textFields)){if(!Object.prototype.hasOwnProperty.call(body,key))continue;const value=key==="macAuthPassword"?String(body[key]??"").slice(0,max):clean(body[key],max);if(value!==""&&!(key==="sslCertificate"&&value.toLowerCase()==="none"))payload[key]=value;}
 if(Array.isArray(body.loginBy))payload.loginBy=body.loginBy;
 for(const key of ["splitUserDomain","useRadius","radiusAccounting"])if(Object.prototype.hasOwnProperty.call(body,key))payload[key]=booleanValue(body[key]);
 return payload;
}
async function createServerProfile(req,res){try{const body=req.body&&typeof req.body==="object"?req.body:{},name=clean(body.name,100);if(!name||name.toLowerCase()==="default")return res.status(400).json({success:false,message:"Choose a custom name; the built-in default profile cannot be created."});const profile=await mikrotikService.createHotspotServerProfile({name,...serverProfilePayload(body)});return res.status(201).json({success:true,message:"Hotspot server profile created on MikroTik.",profile});}catch(e){return errorResponse(res,e);}}
async function updateServerProfile(req,res){try{const id=clean(req.params?.id,100),body=req.body&&typeof req.body==="object"?req.body:{};if(!id)return res.status(400).json({success:false,message:"Hotspot server profile ID is required."});const profile=await mikrotikService.updateHotspotServerProfile(id,serverProfilePayload(body));return res.json({success:true,message:"Hotspot server profile updated on MikroTik.",profile});}catch(e){return errorResponse(res,e);}}
async function profiles(req,res){try{const [routerProfiles,meta]=await Promise.all([mikrotikService.getHotspotProfiles(),readProfileMetadata()]);if(!Array.isArray(routerProfiles))throw new Error("MikroTik returned an invalid Hotspot profile list.");return res.set("Cache-Control","no-store").json({success:true,profiles:routerProfiles.filter(p=>p.name&&String(p.name).toLowerCase()!=="default").map(p=>{const m=meta[p.name]||{};let v;try{v=m.validityValue!==undefined&&m.validityUnit?normalizeProfileValidity(m.validityValue,m.validityUnit):parseStoredValidity(p);}catch(_){v=parseStoredValidity(p);}const quota=Number(m.limitBytesTotal||m.limit_bytes_total||v.limitBytesTotal||0),dataOnly=!v.validity&&quota>0;return {...p,profile_id:String(m.id||m.profileId||m.profile_id||m.packageId||m.package_id||m.packageName||m.package_name||m.alias||p.name),price:Number(m.price||0),validityValue:dataOnly?0:v.value,validityUnit:dataOnly?"gb":v.unit,validityLabel:dataOnly?(v.validityLabel||"Data quota"):m.validityLabel||v.validityLabel,limitBytesTotal:quota};})});}catch(e){return errorResponse(res,e);}}
function previewProfileScript(req,res){
 try{
  const body=req.body||{};
  const name=clean(body.name||"profile",100);
  const sharedUsers=Number(body.sharedUsers??1);
  if(!name)return res.status(400).json({success:false,message:"Profile name is required for the preview."});
  if(!Number.isSafeInteger(sharedUsers)||sharedUsers<1)return res.status(400).json({success:false,message:"Shared users must be a positive whole number."});
  const validity=normalizeProfileValidity(body.validityValue??1,body.validityUnit||"days");
  const onLogin=buildHotspotOnLoginScript({name,sharedUsers,validityValue:validity.value,validityUnit:validity.unit});
  return res.json({success:true,scriptVersion:"FAZ_HOTSPOT_SESSION_BINDING_V4",onLogin});
 }catch(error){
  return res.status(400).json({success:false,message:error?.message||"Unable to generate the RouterOS on-login preview."});
 }
}
async function createProfile(req,res){try{
 const body=req.body&&typeof req.body==="object"?req.body:{};
 const name=clean(body.name,100),rateLimit=clean(body.rateLimit,100),sharedUsers=Number(body.sharedUsers??1),price=Number(body.price??0),v=normalizeProfileValidity(body.validityValue,body.validityUnit);
 if(!name||name.toLowerCase()==="default")return res.status(400).json({success:false,message:"A custom profile name is required."});
 if(!Number.isFinite(price)||price<0)return res.status(400).json({success:false,message:"Price must be zero or greater."});
 if(!Number.isSafeInteger(sharedUsers)||sharedUsers<1)return res.status(400).json({success:false,message:"Shared users must be a positive whole number."});
 const onLogin=buildHotspotOnLoginScript({name,sharedUsers,validityValue:v.value,validityUnit:v.unit});
 const result=await mikrotikService.createHotspotProfile({name,rateLimit,sharedUsers,sessionTimeout:v.validity,clearSessionTimeout:v.unit==="gb",keepaliveTimeout:"",onLogin});
 const meta=await readProfileMetadata();meta[name]={...(meta[name]||{}),price,rateLimit,validityValue:v.value,validityUnit:v.unit,validityLabel:v.validityLabel,limitBytesTotal:v.limitBytesTotal,updatedAt:new Date().toISOString()};await writeProfileMetadata(meta);
 const popSync=await syncPopPackagesBestEffort();
 return res.json({success:true,message:"Hotspot profile created and metadata saved.",profile:{...result,rateLimit,sharedUsers,price,...v,onLogin},...popSync});
}catch(e){return errorResponse(res,e);}}
async function updateProfile(req,res){try{
 const body=req.body&&typeof req.body==="object"?req.body:{};
 const pathName=clean(req.params&&req.params.id,100),name=pathName||clean(body.name,100),bodyName=clean(body.name||name,100),rateLimit=clean(body.rateLimit,100),sharedUsers=Number(body.sharedUsers??1),price=Number(body.price??0),v=normalizeProfileValidity(body.validityValue,body.validityUnit);
 if(!name||name.toLowerCase()==="default")return res.status(400).json({success:false,message:"A custom profile name is required."});
 if(pathName&&bodyName!==pathName)return res.status(400).json({success:false,message:"Profile name is the identifier and cannot be changed while editing."});
 if(!Number.isFinite(price)||price<0)return res.status(400).json({success:false,message:"Price must be zero or greater."});
 if(!Number.isSafeInteger(sharedUsers)||sharedUsers<1)return res.status(400).json({success:false,message:"Shared users must be a positive whole number."});
 const onLogin=buildHotspotOnLoginScript({name,sharedUsers,validityValue:v.value,validityUnit:v.unit});
 const result=await mikrotikService.updateHotspotProfile({name,rateLimit,sharedUsers,sessionTimeout:v.validity,clearSessionTimeout:v.unit==="gb",keepaliveTimeout:"",onLogin});
 const meta=await readProfileMetadata();meta[name]={...(meta[name]||{}),price,rateLimit,validityValue:v.value,validityUnit:v.unit,validityLabel:v.validityLabel,limitBytesTotal:v.limitBytesTotal,updatedAt:new Date().toISOString()};await writeProfileMetadata(meta);
 const popSync=await syncPopPackagesBestEffort();
 return res.json({success:true,message:"Hotspot profile updated and metadata saved.",profile:{...result,rateLimit,sharedUsers,price,...v,onLogin},...popSync});
}catch(e){return errorResponse(res,e);}}
async function syncProfiles(req,res){
 try{
  const [routerProfiles,metadata]=await Promise.all([mikrotikService.getHotspotProfiles(),readProfileMetadata()]);
  if(!Array.isArray(routerProfiles))throw new Error("MikroTik returned an invalid Hotspot profile list.");
  const routerByName=new Map(routerProfiles.map(profile=>[String(profile.name||"").trim(),profile]).filter(([name])=>name));
  const panelProfiles=Object.entries(metadata||{}).filter(([name,value])=>name&&name.trim().toLowerCase()!=="default"&&value&&typeof value==="object"&&!Array.isArray(value));
  const names=new Set([...routerByName.keys(),...panelProfiles.map(([name])=>name.trim())]);
  const panelByName=new Map(panelProfiles.map(([name,value])=>[name.trim(),value]));
  const result={checked:0,created:0,updated:0,failed:0,results:[]};
  for(const name of names){
   if(!name||name.toLowerCase()==="default")continue;
   const current=routerByName.get(name)||null,panel=panelByName.get(name)||{};
   result.checked++;
   try{
    let validity;
    try{
     validity=panel.validityValue!==undefined&&panel.validityUnit
      ?normalizeProfileValidity(panel.validityValue,panel.validityUnit)
      :current?parseStoredValidity(current):normalizeProfileValidity(0,"gb");
    }catch(_){
     if(!current)throw new Error("Panel profile has invalid validity settings.");
     validity=parseStoredValidity(current);
    }
    const sharedUsers=Number(panel.sharedUsers||panel.shared_users||current?.sharedUsers||1);
    if(!Number.isSafeInteger(sharedUsers)||sharedUsers<1)throw new Error("Panel profile has invalid shared-user settings.");
    const storedRateLimit=Object.prototype.hasOwnProperty.call(panel,"rateLimit")?panel.rateLimit:panel.rate_limit;
    const rateLimit=storedRateLimit!==undefined?clean(storedRateLimit,100):clean(current?.rateLimit,100);
    const existingLogin=String(current?.raw?.["on-login"]||"");
    const onLogin=buildHotspotOnLoginScript({name,sharedUsers,validityValue:validity.value,validityUnit:validity.unit});
    const customScript=existingLogin.trim()&&!existingLogin.includes("FAZ|PROFILE=")?" ; "+existingLogin.trim():"";
    const profileData={name,rateLimit,sharedUsers,sessionTimeout:validity.validity,clearSessionTimeout:validity.unit==="gb",keepaliveTimeout:current?.keepaliveTimeout||"",onLogin:onLogin+customScript};
    if(current){await mikrotikService.updateHotspotProfile(profileData);result.updated++;}
    else{await mikrotikService.createHotspotProfile(profileData);result.created++;}
    result.results.push({name,status:current?"updated":"created"});
   }catch(error){
    result.failed++;
    result.results.push({name,status:"failed",error:error?.message||"Profile sync failed."});
   }
  }
  // Keep the established session-expiry and MAC-auth profile maintenance after the panel settings are applied.
  const scriptSync=await syncHotspotProfileScripts();
  const serverAuth=scriptSync.serverAuth||{checked:0,updated:0,skipped:0,failed:0};
  // Heal POP package rows from the same panel metadata, so a manual sync
  // also repairs price/validity/quota drift and deactivates removed profiles.
  const popSync=await syncPopPackagesBestEffort();
  const sync={panelProfiles:result,...scriptSync,serverAuth,...(popSync.popSync?{popSync:popSync.popSync}:{})};
  const success=result.failed===0&&Number(scriptSync.failed||0)===0&&Number(serverAuth.failed||0)===0;
  return res.status(success?200:502).json({success,message:success?"Panel Hotspot profiles synced to MikroTik.":"Panel profile sync completed with errors; review the per-profile results.",sync,...(popSync.popSyncWarning?{popSyncWarning:popSync.popSyncWarning}:{})});
 }catch(e){return errorResponse(res,e);}
}
async function deleteProfile(req,res){
 try{
  const name=clean(req.body?.name,100);
  if(!name)return res.status(400).json({success:false,code:"HOTSPOT_PROFILE_NAME_REQUIRED",message:"Hotspot profile name is required."});
  if(name.toLowerCase()==="default")return res.status(400).json({success:false,code:"HOTSPOT_PROFILE_PROTECTED",message:"The built-in default Hotspot profile cannot be deleted."});
  const result=await mikrotikService.deleteHotspotProfile(name);
  const meta=await readProfileMetadata();
  // Always persist the canonical metadata object after RouterOS confirms deletion.
  // The upsert is awaited, so a PostgreSQL failure cannot be reported as success.
  delete meta[name];
  await writeProfileMetadata(meta);
  // A deleted profile must stop selling immediately: deactivate its POP
  // package rows. Best-effort — the profile itself is already deleted.
  let popSyncWarning=null;
  try{
    await db.query("UPDATE public.pop_hotspot_packages SET is_active=FALSE, updated_at=NOW() WHERE profile_key=$1",[name]);
  }catch(error){
    popSyncWarning="Panel profile deleted, but its POP packages could not be deactivated: "+String(error.message||error).slice(0,200);
    console.warn("[Hotspot POP package sync]",popSyncWarning);
  }
  const popSync=await syncPopPackagesBestEffort();
  if(popSync.popSyncWarning)popSyncWarning=popSyncWarning?popSyncWarning+"; "+popSync.popSyncWarning:popSync.popSyncWarning;
  return res.json({success:true,message:"Hotspot profile deleted successfully from MikroTik and metadata was updated.",profile:result,...(popSync.popSync?{popSync:popSync.popSync}:{}),...(popSyncWarning?{popSyncWarning}:{})});
 }catch(e){
  console.error("[Hotspot profile deletion]",{code:e?.code||null,message:e?.message||String(e)});
  const status=Number.isInteger(e?.statusCode)?e.statusCode:503;
  return res.status(status).json({success:false,code:e?.code||"HOTSPOT_PROFILE_DELETE_FAILED",message:e?.message||"Hotspot profile deletion failed."});
 }
}
let hotspotListCache={expiresAt:0,users:null,activeUsers:[]},hotspotListRefresh=null;
async function refreshHotspotListCache(){
 if(hotspotListRefresh)return hotspotListRefresh;
 hotspotListRefresh=(async()=>{
  // Persist expiry state first so both this response and downstream cleanup observe the same lifecycle state.
  await db.query("UPDATE hotspot_vouchers SET status='expired',cleanup_status=CASE WHEN LOWER(COALESCE(cleanup_status,'')) IN ('completed','not_required') THEN cleanup_status ELSE 'pending' END,expired_at=COALESCE(expired_at,expires_at,NOW()),updated_at=NOW() WHERE expires_at < NOW() AND LOWER(COALESCE(status,'')) NOT IN ('archived','expired','deleted')");
  // PostgreSQL is the subscriber source of truth. RouterOS contributes live-session telemetry only.
  const ledgerPromise=db.query("SELECT id,username,password,status,comment,expires_at,first_login_at,validity,customer_name,phone,mac_address,server,transaction_id,profile,price,mac_lock,subscriber_type,activation_type,profile_id,created_at,updated_at FROM hotspot_vouchers WHERE LOWER(COALESCE(status,'')) NOT IN ('archived','deleted') ORDER BY id DESC");
  const sessionsPromise=mikrotikService.getActiveHotspotSessions().catch(error=>{console.warn("[Hotspot API] Active-session lookup unavailable; returning database records as offline:",error.message);return [];});
  const [ledger,sessionRows]=await Promise.all([ledgerPromise,sessionsPromise]);
  const now=Date.now();
  const expiredUsers=new Set((ledger.rows||[]).filter(row=>String(row.status||"").toLowerCase()==="expired"||(row.expires_at&&new Date(row.expires_at).getTime()<=now)).flatMap(row=>[String(row.username||"").trim().toLowerCase(),normalizeHotspotMac(row.mac_address||row.username).toLowerCase()].filter(Boolean)));
  const activeUsers=(Array.isArray(sessionRows)?sessionRows:[]).filter(row=>String(row?.username||"").trim()&&String(row.username).toLowerCase()!=="default-trial"&&!expiredUsers.has(String(row.username||"").trim().toLowerCase())&&!expiredUsers.has(normalizeHotspotMac(row.macAddress||row.mac_address||row["mac-address"]||"").toLowerCase())).map(row=>({id:row.id||"",sessionId:row.id||"",user:row.username,username:row.username,address:row.address||"",macAddress:normalizeHotspotMac(row.macAddress||row.mac_address||row["mac-address"]||""),uptime:row.uptime||"",sessionTimeLeft:row.sessionTimeLeft||"",bytesIn:Number(row.bytesIn||0),bytesOut:Number(row.bytesOut||0),server:row.server||"",profile:row.profile||""}));
  const users=(ledger.rows||[]).map(row=>{
   const mac=normalizeHotspotMac(row.mac_address)||normalizeHotspotMac(row.username);
   const session=activeUsers.find(item=>(mac&&normalizeHotspotMac(item.macAddress)===mac)||String(item.username||"").trim().toLowerCase()===String(row.username||"").trim().toLowerCase())||null;
   const expiry=row.expires_at?new Date(row.expires_at):null;
   const isExpired=Boolean((expiry&&!Number.isNaN(expiry.getTime())&&expiry.getTime()<=now)||String(row.status||"").toLowerCase()==="expired");
   const status=isExpired?"expired":String(row.status||"").toLowerCase();
   return {id:row.id,voucherId:row.id,username:row.username||mac||"",password:row.password||"",name:row.customer_name||"",customer_name:row.customer_name||"",phone:row.phone||"",macAddress:mac||row.mac_address||"",mac_address:mac||row.mac_address||"",transaction_id:row.transaction_id||null,price:Number(row.price||0),profile:row.profile||"",profile_id:row.profile_id||null,subscriber_type:row.subscriber_type||"legacy",activation_type:row.activation_type||"legacy",uptime:session?.uptime||"",limitUptime:"",bytesIn:Number(session?.bytesIn||0),bytesOut:Number(session?.bytesOut||0),ip:session?.address||"",address:session?.address||"",sessionId:session?.sessionId||session?.id||"",comment:row.comment||"",disabled:status==="expired"||status==="archived",status,expires_at:row.expires_at||null,first_login_at:row.first_login_at||null,validity:row.validity||"",server:row.server||"all",macLock:row.mac_lock!==false,is_online:Boolean(session&&String(session.address||"").trim()),online:Boolean(session&&String(session.address||"").trim()),created_at:row.created_at||null,updated_at:row.updated_at||null};
  });
  hotspotListCache={expiresAt:Date.now()+8000,users,activeUsers};
  return hotspotListCache;
 })().finally(()=>{hotspotListRefresh=null;});
 return hotspotListRefresh;
}

function parseHotspotExpiry(comment) {
 const match=String(comment||"").match(/Exp: ([0-9]{4}-[0-9]{2}-[0-9]{2})(?: ([0-9]{2}:[0-9]{2}:[0-9]{2}))?/i);
 if(!match)return null;
 const value=match[1]+"T"+(match[2]||"23:59:59")+"+06:00";
 const parsed=new Date(value);
 return Number.isNaN(parsed.getTime())?null:parsed;
}
function formatHotspotExpiry(dateValue) {
 const date=dateValue instanceof Date?dateValue:new Date(dateValue);
 if(Number.isNaN(date.getTime()))return "";
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date);
 const field=type=>parts.find(part=>part.type===type)?.value||"00";
 return "Exp: "+field("year")+"-"+field("month")+"-"+field("day")+" "+field("hour")+":"+field("minute")+":"+field("second");
}
async function importFromMikrotik(req,res) {
 try {
  const routerUsers=await mikrotikService.getHotspotUsers();
  let imported=0,skipped=0,skippedExisting=0;
  for(const routerUser of (Array.isArray(routerUsers)?routerUsers:[])) {
   const routerName=clean(routerUser?.username||routerUser?.name,100);
   const mac=normalizeHotspotMac(routerName);
   if(!mac){skipped++;continue;}
   const profile=clean(routerUser?.profile,100)||"default";
   const expiry=parseHotspotExpiry(routerUser?.comment);
   const comment=clean(routerUser?.comment,500);
   const phone=clean(routerUser?.comment_phone,40)||"Unlinked";
   const server=clean(routerUser?.server,100)||"all";
   try {
    const outcome=await db.withTransaction(async client=>{
     // Serialize imports of the same MAC without relying on a schema-specific ON CONFLICT target.
     await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-hotspot-import:"+mac]);
     const match=await client.query(
      "SELECT id,status FROM hotspot_vouchers WHERE LOWER(mac_address)=LOWER($1) OR LOWER(username)=LOWER($1) ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [mac]
     );
     const existing=match.rows?.[0];
     // Panel is the master: an existing panel row is never overwritten by
     // the router, and an expired/deleted/archived row is never resurrected.
     // Import only discovers router users the panel has never seen.
     if(existing) return "skippedExisting";
     await client.query(
      "INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment,phone,customer_name,server,expires_at,mac_address,first_login_at) VALUES($1,$2,$3,'imported',0,'active',$4,$5,'Imported Subscriber',$6,$7,$8,NOW()) RETURNING id",
      [mac,clean(routerUser?.password,100)||mac,profile,comment,phone,server,expiry,mac]
     );
     return "imported";
    });
    if(outcome==="imported")imported++;else skippedExisting++;
   } catch(error) {
    // A concurrent provisioning path may win the unique username/MAC index race.
    // The failed transaction is rolled back before re-reading; the existing
    // panel row is left untouched — Panel is the master, so the router must
    // never overwrite it or resurrect a terminal row.
    if(error?.code!=="23505")throw error;
    const raced=await db.query(
     "SELECT id,status FROM hotspot_vouchers WHERE LOWER(mac_address)=LOWER($1) OR LOWER(username)=LOWER($1) ORDER BY id DESC LIMIT 1",
     [mac]
    );
    if(!raced.rows?.[0])throw error;
    skippedExisting++;
   }
  }
  hotspotListCache.expiresAt=0;
  return res.json({success:true,imported,skipped,skippedExisting});
 } catch(error) { return errorResponse(res,error); }
}
async function pushToMikrotik(req,res) {
 try {
  // Panel is the master: only live 'active' vouchers are pushed. Expired,
  // deleted and archived rows are never sent to the router, and PIN/scratch
  // vouchers without a bound MAC are pushed by their voucher username.
  const result=await db.query("SELECT id,username,password,profile,validity,status,comment,server,mac_address,data_limit,time_limit,expires_at,created_at FROM hotspot_vouchers WHERE status='active' ORDER BY id ASC");
  let meta={};
  try{meta=await readProfileMetadata();}catch(_){meta={};}
  const vouchers=[];
  let skipped=0;
  for(const row of (result.rows||[])) {
   // Defence in depth: the SELECT already excludes them, but a non-active
   // row must never reach the router even if the query changes.
   if(String(row.status||"").toLowerCase()!=="active"){skipped++;continue;}
   const profile=clean(row.profile,100);
   if(!profile){skipped++;continue;}
   const mac=normalizeHotspotMac(row.mac_address);
   const pin=clean(row.username,100);
   const username=mac||pin;
   const password=mac||clean(row.password,100);
   if(!username||!password){skipped++;continue;}
   // Data-only package: no time expiry; quota from the voucher row, else
   // from core profile metadata. A data package with no quota is skipped.
   const quotaBytes=Math.max(0,Math.floor(Number(String(row.data_limit||"").trim())||0))||Math.max(0,Math.floor(Number((meta[profile]||{}).limitBytesTotal||0)));
   const durationMs=validityMs(row.validity||row.time_limit||"");
   if(quotaBytes>0&&durationMs<=0){
    vouchers.push({username,password,macAddress:mac||"",profile,server:clean(row.server,100)||"all",comment:"FAZ|DATA_ONLY",limitBytesTotal:quotaBytes,expired:false,dataOnly:true});
    continue;
   }
   const expiry=row.expires_at?new Date(row.expires_at):(parseHotspotExpiry(row.comment)||voucherValidUntil(row.created_at,row.validity));
   if(!expiry||Number.isNaN(expiry.getTime())){skipped++;continue;}
   if(expiry.getTime()<=Date.now()){skipped++;continue;}
   vouchers.push({username,password,macAddress:mac||"",profile,server:clean(row.server,100)||"all",comment:formatHotspotExpiry(expiry),limitBytesTotal:quotaBytes,expired:false});
  }
  const sync=vouchers.length?await mikrotikService.syncHotspotUsers(vouchers):{provisioned:0,refreshed:0,skipped:0,disconnected:0,failed:[]};
  hotspotListCache.expiresAt=0;
  return res.json({success:true,provisioned:Number(sync.provisioned||0),refreshed:Number(sync.refreshed||0),skipped:skipped+Number(sync.skipped||0),failed:Array.isArray(sync.failed)?sync.failed:[],disconnected:0});
 } catch(error) { return errorResponse(res,error); }
}

async function list(req,res){try{const filter=normalizeFilter(req.query.filter);const c=hotspotListCache.users&&hotspotListCache.expiresAt>Date.now()?hotspotListCache:await refreshHotspotListCache();if(c===hotspotListCache&&c.expiresAt>Date.now())refreshHotspotListCache().catch(e=>console.warn("[Hotspot API] Background refresh failed:",e.message));const users=(c.users||[]).filter(user=>{if(filter==="online")return user.is_online;if(filter==="expired")return user.status==="expired";if(filter==="active")return !user.is_online&&user.status==="active"&&(!user.expires_at||new Date(user.expires_at).getTime()>Date.now());if(filter==="offline")return !user.is_online;return true;});return res.json({success:true,filter,count:users.length,users,activeUsers:c.activeUsers,cached:Boolean(c.expiresAt>Date.now())});}catch(e){return errorResponse(res,e);}}
async function active(req,res){
 try{
  const sessions=await mikrotikService.getActiveHotspotSessions();
  const users=(Array.isArray(sessions)?sessions:[]).filter(s=>{
    const name=String(s?.username||"").trim().toLowerCase();
    return name&&name!=="default-trial";
  }).map(s=>({
    id:s.id,
    user:s.username,
    address:s.address||"",
    macAddress:s.macAddress||"",
    uptime:s.uptime||"",
    sessionTimeLeft:s.sessionTimeLeft||"",
    idleTime:s.idleTime||"",
    bytesIn:Number(s.bytesIn||0),
    bytesOut:Number(s.bytesOut||0)
  }));
  return res.json({success:true,filter:"active",count:users.length,users});
 }catch(e){return errorResponse(res,e);}
}
async function disconnectActive(req,res){
 try{
  const id=clean(req.body.id,100);
  if(!id)return res.status(400).json({success:false,error:"Active session id is required."});
  const result=await mikrotikService.kickActiveHotspotUser("",id);
  return res.json({success:true,...result});
 }catch(e){return errorResponse(res,e);}
}
async function generate(req,res){
 const body=req.body&&typeof req.body==="object"?req.body:{};
 const quantity=Number(body.quantity??body.count??1);
 const requestedProfile=clean(body.profile_id||body.profileId||body.profile||"",100);
 const price=Number(body.price??0);
 const server=clean(body.server||"all",100)||"all";
 const userPrefix=clean(body.userPrefix??body.user_prefix??"",20).replace(/[^a-zA-Z0-9_-]/g,"").toUpperCase();
 const charLength=Number(body.charLength??body.char_length??6);
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>500)return res.status(400).json({success:false,code:"INVALID_QUANTITY",error:"Quantity must be a whole number from 1 to 500."});
 if(!requestedProfile)return res.status(400).json({success:false,code:"PROFILE_REQUIRED",error:"Select an existing Hotspot profile."});
 if(!Number.isFinite(price)||price<0||price>1000000)return res.status(400).json({success:false,code:"INVALID_PRICE",error:"Enter a valid non-negative price."});
 if(!Number.isSafeInteger(charLength)||charLength<4||charLength>16)return res.status(400).json({success:false,code:"INVALID_PIN_LENGTH",error:"Voucher PIN length must be between 4 and 16 characters."});
 try{
  const routerProfiles=await mikrotikService.getHotspotProfiles();
  const meta=await readProfileMetadata();
  const available=(Array.isArray(routerProfiles)?routerProfiles:[]).filter(p=>p&&p.name&&String(p.name).toLowerCase()!=="default");
  const profile=available.find(p=>String(p.name)===requestedProfile||String(meta[p.name]?.id||meta[p.name]?.profileId||meta[p.name]?.profile_id||"")===requestedProfile);
  if(!profile)return res.status(400).json({success:false,code:"PROFILE_NOT_FOUND",error:"The selected profile is not available on the configured Hotspot profile list."});
  const profileName=String(profile.name);
  const profileMeta=meta[profileName]||{};
  let profileValidity;
  try {
   profileValidity=profileMeta.validityValue!==undefined&&profileMeta.validityValue!==null&&profileMeta.validityUnit
    ? normalizeProfileValidity(profileMeta.validityValue,profileMeta.validityUnit)
    : parseStoredValidity(profile);
  } catch (_) { profileValidity=parseStoredValidity(profile); }
  const hasRouterTimeout=Boolean(String(profile.sessionTimeout||profile["session-timeout"]||"").trim());
  const hasConfiguredMetadata=profileMeta.validityValue!==undefined&&profileMeta.validityValue!==null&&Boolean(profileMeta.validityUnit);
  const quota=Number(profileMeta.limitBytesTotal||profileValidity.limitBytesTotal||0);
  if(!hasRouterTimeout&&!hasConfiguredMetadata&&!quota)return res.status(400).json({success:false,code:"PROFILE_VALIDITY_MISSING",error:"The selected profile has no saved time validity or data quota. Configure validity in Hotspot Profile settings first."});
  const normalizedValidity=String(profileValidity.validity||"").trim()||(quota?"0m":"");
  const batchId=crypto.randomUUID();
  const generated=await db.withTransaction(client=>hotspotVoucherGenerator.generateVoucherBatch({
   client,profileName,validity:normalizedValidity,price,server,quantity,userPrefix,charLength,batchId,
   timeLimit:String(profileValidity.validity||"").trim(),dataLimit:quota>0?String(quota):"",
   comment:"Scratch voucher; profile validity applies on first successful login."
  }));
  const created=generated.vouchers;
  hotspotListCache.expiresAt=0;
  return res.status(201).json({success:true,batchId,count:created.length,profile:profileName,validity:normalizedValidity,vouchers:created,message:"Voucher PINs generated successfully using the selected Hotspot profile validity."});
 }catch(error){return errorResponse(res,error);}
}
async function createUser(req, res) {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const requestedProfile = clean(body.profile_id || body.profileId || body.profile || "", 100);
    const customerName = clean(body.customer_name || body.name || "", 160);
    const phone = normalizeHotspotPhone(body.phone || body.customer_phone || "");
    const note = clean(body.note || body.address || "", 1000);
    const server = clean(body.server || "all", 100) || "all";
    const customExpiryRaw = String(body.custom_expiry || body.expires_at || "").trim();

    if (!requestedProfile) {
      return res.status(400).json({
        success: false,
        code: "PROFILE_REQUIRED",
        message: "Select a Hotspot package/profile."
      });
    }

    if (body.phone && !phone) {
      return res.status(400).json({
        success: false,
        code: "INVALID_ACCOUNT_PHONE",
        message: "The supplied phone number is invalid. Leave it empty to skip SMS."
      });
    }

    let customExpiry = null;
    if (customExpiryRaw) {
      const match = customExpiryRaw.match(
        /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
      );
      if (!match) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EXPIRY",
          message: "Custom expiry must be a valid YYYY-MM-DDTHH:mm date/time value."
        });
      }

      const [, year, month, day, hour, minute, second = "00"] = match;
      const daysInMonth = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
      const calendarIsValid =
        Number(month) >= 1 && Number(month) <= 12 &&
        Number(day) >= 1 && Number(day) <= daysInMonth &&
        Number(hour) >= 0 && Number(hour) <= 23 &&
        Number(minute) >= 0 && Number(minute) <= 59 &&
        Number(second) >= 0 && Number(second) <= 59;
      if (!calendarIsValid) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EXPIRY",
          message: "Custom expiry contains an invalid date or time."
        });
      }

      // datetime-local has no timezone; interpret it explicitly as Asia/Dhaka (UTC+06:00).
      customExpiry = new Date(
        year + "-" + month + "-" + day + "T" + hour + ":" + minute + ":" + second + "+06:00"
      );
      if (Number.isNaN(customExpiry.getTime()) || customExpiry.getTime() <= Date.now()) {
        return res.status(400).json({
          success: false,
          code: "INVALID_EXPIRY",
          message: "Custom expiry must be a valid future date/time in Asia/Dhaka."
        });
      }
    }

    const [routerProfiles, metadata] = await Promise.all([
      mikrotikService.getHotspotProfiles(),
      readProfileMetadata()
    ]);
    if (!Array.isArray(routerProfiles)) {
      throw hotspotError("HOTSPOT_PROFILE_LOOKUP_FAILED", 502, "MikroTik returned an invalid Hotspot profile list.");
    }

    const candidates = routerProfiles.filter(profileRow => {
      if (!profileRow || !profileRow.name) return false;
      const name = String(profileRow.name);
      if (name.toLowerCase() === "default") return false;
      return profileIdentifierMatches(name, metadata[name] || {}, requestedProfile);
    });
    if (candidates.length !== 1) {
      return res.status(400).json({
        success: false,
        code: candidates.length === 0 ? "PROFILE_NOT_FOUND" : "PROFILE_AMBIGUOUS",
        message: candidates.length === 0
          ? "The selected package/profile was not found."
          : "The selected package matches more than one profile. Select a unique package."
      });
    }

    const profileRow = candidates[0];
    const profileName = String(profileRow.name).trim();
    const profileMeta = metadata[profileName] || {};
    let validity = "";
    let quota = Number(profileMeta.limitBytesTotal || 0);
    const hasConfiguredValidity =
      profileMeta.validityValue !== undefined &&
      profileMeta.validityValue !== null &&
      String(profileMeta.validityValue).trim() !== "" &&
      String(profileMeta.validityUnit || "").trim() !== "";

    if (hasConfiguredValidity) {
      const normalized = normalizeProfileValidity(profileMeta.validityValue, profileMeta.validityUnit);
      validity = String(normalized.validity || "").trim();
      quota = Number(profileMeta.limitBytesTotal || normalized.limitBytesTotal || quota || 0);
    } else if (quota <= 0) {
      // A data package (quota > 0, no configured time validity) must never
      // inherit a time validity from the router's session-timeout (F5).
      const routerTimeout = String(
        profileRow.sessionTimeout || profileRow["session-timeout"] || ""
      ).trim().toLowerCase();
      if (routerTimeout && routerTimeout !== "none") {
        const compact = routerTimeout.replace(/\s+/g, "");
        const durationPattern = /(\d+)(w|d|h|m|s)/g;
        const unitMilliseconds = { w: 604800000, d: 86400000, h: 3600000, m: 60000, s: 1000 };
        let match;
        let consumed = "";
        let totalMilliseconds = 0;
        while ((match = durationPattern.exec(compact)) !== null) {
          consumed += match[0];
          totalMilliseconds += Number(match[1]) * unitMilliseconds[match[2]];
        }
        if (
          consumed !== compact ||
          !Number.isSafeInteger(totalMilliseconds) ||
          totalMilliseconds <= 0
        ) {
          return res.status(400).json({
            success: false,
            code: "PROFILE_VALIDITY_UNRECOGNIZED",
            message: "The selected profile has an unrecognized RouterOS session timeout. Configure a supported validity before creating vouchers."
          });
        }
        validity = compact;
      }
    }

    if (!validity && (!Number.isFinite(quota) || quota <= 0) && !customExpiry) {
      return res.status(400).json({
        success: false,
        code: "PROFILE_VALIDITY_MISSING",
        message: "The selected package has no configured time validity or data quota. Configure the package before creating a voucher."
      });
    }
    if (!Number.isFinite(quota) || quota < 0) {
      throw hotspotError("INVALID_PROFILE_QUOTA", 400, "The selected package has an invalid data quota.");
    }

    const profileId = String(
      profileMeta.id ||
      profileMeta.profileId ||
      profileMeta.profile_id ||
      profileMeta.packageId ||
      profileMeta.package_id ||
      profileMeta.packageName ||
      profileMeta.package_name ||
      profileMeta.alias ||
      requestedProfile
    );
    const price = Number(profileMeta.price ?? 0);
    if (!Number.isFinite(price) || price < 0) {
      throw hotspotError("INVALID_PROFILE_PRICE", 400, "The selected package has an invalid price.");
    }

    const dhakaStamp = date => {
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Dhaka",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }).formatToParts(date);
      const field = type => parts.find(part => part.type === type)?.value || "00";
      return field("year") + "-" + field("month") + "-" + field("day") + " " +
        field("hour") + ":" + field("minute") + ":" + field("second");
    };
    const comment = customExpiry
      ? "FAZ NETWORK manual voucher; Exp: " + dhakaStamp(customExpiry)
      : "FAZ NETWORK manual voucher; package validity applies on first successful login.";

    const batchId = crypto.randomUUID();
    const stored = await db.withTransaction(async client => {
      const generated = await hotspotVoucherGenerator.generateVoucherBatch({
        client,
        profileName,
        validity,
        price,
        server,
        quantity: 1,
        charLength: 8,
        passwordEqualsUsername: false,
        batchId,
        transactionId: null,
        comment
      });
      const voucher = generated.vouchers && generated.vouchers[0];
      if (!voucher || !voucher.id || !voucher.username || !voucher.password) {
        throw new Error("Voucher generator did not return a complete persisted voucher.");
      }

      const updated = await client.query(
        `
          UPDATE hotspot_vouchers
          SET
            phone = NULLIF($2::text, ''),
            customer_name = NULLIF($3::text, ''),
            note = NULLIF($4::text, ''),
            profile_id = NULLIF($5::text, ''),
            time_limit = NULLIF($6::text, ''),
            data_limit = NULLIF($7::text, ''),
            expires_at = $8::timestamptz,
            mac_address = NULL,
            mac_lock = FALSE,
            status = 'unused',
            subscriber_type = 'admin_voucher',
            activation_type = 'first_login',
            server = $9::text,
            comment = $10::text,
            updated_at = NOW()
          WHERE id = $1::bigint
            AND status = 'unused'
            AND subscriber_type = 'scratch_voucher'
          RETURNING
            id, username, password, profile, profile_id, validity, price,
            status, phone, customer_name, server, time_limit, data_limit,
            expires_at, batch_id, created_at
        `,
        [
          voucher.id,
          phone,
          customerName,
          note,
          profileId,
          validity,
          quota > 0 ? String(Math.trunc(quota)) : "",
          customExpiry,
          server,
          comment
        ]
      );
      if (!updated.rows || updated.rows.length !== 1) {
        throw new Error("Generated voucher package metadata could not be persisted.");
      }

      // A voucher created at the ISP counter is a cash sale immediately, not a sale
      // deferred until the customer first logs in. Keep all ledger links atomic.
      const trxId = "ADM-MANUAL-" + voucher.id;
      const sale = await client.query(
        "INSERT INTO transactions(channel,trx_id,sender_phone,amount,status,matched_username,raw_sms,used,claim_flow,sale_type,claimed_at,claimed_by) " +
        "VALUES('cash',$1::text,NULLIF($2::text,''),$3::numeric,'processed',$4::text,$5::text,TRUE,'manual_hotspot','manual',NOW(),$6::text) " +
        "RETURNING id,trx_id",
        [
          trxId,
          phone,
          Number(updated.rows[0].price || 0),
          updated.rows[0].username,
          "Admin manual counter cash sale for voucher " + voucher.id,
          "admin_manual:" + voucher.id
        ]
      );
      if (!sale.rows || sale.rows.length !== 1 || !sale.rows[0].id) {
        throw new Error("Admin manual cash sale transaction could not be persisted.");
      }

      const payment = await client.query(
        "INSERT INTO hotspot_voucher_payments(transaction_id,voucher_id,phone,amount,profile,sale_type) " +
        "VALUES($1::bigint,$2::bigint,COALESCE(NULLIF($3::text,''),'Unlinked'),$4::numeric,$5::text,'manual') " +
        "RETURNING transaction_id",
        [sale.rows[0].id, voucher.id, phone, Number(updated.rows[0].price || 0), updated.rows[0].profile]
      );
      if (!payment.rows || payment.rows.length !== 1) {
        throw new Error("Admin manual cash sale payment ledger could not be persisted.");
      }

      const linked = await client.query(
        "UPDATE hotspot_vouchers SET transaction_id=$1::bigint,updated_at=NOW() " +
        "WHERE id=$2::bigint AND subscriber_type='admin_voucher' AND transaction_id IS NULL " +
        "RETURNING id,transaction_id",
        [sale.rows[0].id, voucher.id]
      );
      if (!linked.rows || linked.rows.length !== 1) {
        throw new Error("Admin manual cash sale could not be linked to its voucher.");
      }

      return { ...updated.rows[0], transaction_id: sale.rows[0].id, trx_id: sale.rows[0].trx_id };
    });

    hotspotListCache.expiresAt = 0;
    let sms = { requested: false, accepted: false };
    if (phone) {
      const customerLabel = customerName || "গ্রাহক";
      const packageName = stored.profile || profileName;
      const expiryLabel = stored.expires_at
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Dhaka",
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23"
          }).format(new Date(stored.expires_at))
        : "";
      const message =
        "FAZ NETWORK Hotspot Voucher\n" +
        "Package: " + packageName + "\n" +
        "Username/PIN: " + stored.username + "\n" +
        "Password: " + stored.password + "\n" +
        (expiryLabel ? "Expiry: " + expiryLabel : "Validity: " + (stored.validity || "Package data limit")) +
        "\nCustomer: " + customerLabel + "\nThank you, FAZ NETWORK.";

      const dispatch = notificationDispatcher.dispatchNotification({
        userType: "hotspot",
        event: "hotspot_voucher_created",
        to: phone,
        recipient: phone,
        phone,
        username: stored.username,
        customer: { username: stored.username, name: customerLabel, phone, profile: packageName },
        customerName: customerLabel,
        message,
        useMessageDirectly: true,
        variables: {
          name: customerLabel,
          customer_name: customerLabel,
          username: stored.username,
          password: stored.password,
          pin: stored.username,
          package: packageName,
          profile: packageName,
          expiry_date: expiryLabel,
          validity: stored.validity || ""
        }
      });
      sms = { requested: true, accepted: Boolean(dispatch && dispatch.accepted) };
    }

    return res.status(201).json({
      success: true,
      message: phone
        ? "Hotspot voucher created successfully. Notification Hub dispatch was requested."
        : "Hotspot voucher created successfully. No notification was requested because no phone number was provided.",
      subscriber_type: stored.subscriber_type || "admin_voucher",
      activation_type: stored.activation_type || "first_login",
      voucher: {
        id: stored.id,
        username: stored.username,
        pin: stored.username,
        password: stored.password,
        profile: stored.profile,
        profile_id: stored.profile_id,
        validity: stored.validity,
        time_limit: stored.time_limit,
        data_limit: stored.data_limit,
        price: Number(stored.price || 0),
        status: stored.status,
        server: stored.server,
        customer_name: stored.customer_name || "",
        phone: stored.phone || "",
        expires_at: stored.expires_at ? new Date(stored.expires_at).toISOString() : null,
        transaction_id: stored.transaction_id,
        trx_id: stored.trx_id,
        batch_id: stored.batch_id
      },
      sms
    });
  } catch (error) {
    return errorResponse(res, error);
  }
}
async function dashboardMetrics(req,res){
  try{
    const [allUsers,activeSessions,voucherRows,salesRows,expiredRows,expiringRows,cleanupRows]=await Promise.all([
      mikrotikService.getHotspotUsers(),
      mikrotikService.getActiveHotspotSessions(),
      db.query("SELECT COUNT(*)::int AS count FROM hotspot_vouchers"),
      db.query("SELECT COUNT(*)::int AS count,COALESCE(SUM(t.amount),0)::numeric(12,2) AS total_amount FROM transactions t WHERE t.status='processed' AND (EXISTS (SELECT 1 FROM hotspot_voucher_payments hp WHERE hp.transaction_id=t.id) OR EXISTS (SELECT 1 FROM hotspot_vouchers v WHERE v.transaction_id=t.id)) AND t.created_at >= (((NOW() AT TIME ZONE 'Asia/Dhaka')::date)::timestamp AT TIME ZONE 'Asia/Dhaka') AND t.created_at < ((((NOW() AT TIME ZONE 'Asia/Dhaka')::date + 1)::timestamp) AT TIME ZONE 'Asia/Dhaka')"),
      db.query("SELECT COUNT(*)::int AS count FROM hotspot_vouchers WHERE status='expired' AND expired_at >= (((NOW() AT TIME ZONE 'Asia/Dhaka')::date)::timestamp AT TIME ZONE 'Asia/Dhaka') AND expired_at < ((((NOW() AT TIME ZONE 'Asia/Dhaka')::date + 1)::timestamp) AT TIME ZONE 'Asia/Dhaka')"),
      db.query("SELECT COUNT(*)::int AS count FROM hotspot_vouchers WHERE status='active' AND expires_at > NOW() AND expires_at <= NOW() + INTERVAL '1 hour'"),
      db.query("SELECT COUNT(*) FILTER (WHERE status='expired' AND cleanup_status IN ('pending','failed'))::int AS cleanup_pending, COUNT(*) FILTER (WHERE status='expired' AND expired_at >= date_trunc('day',NOW()))::int AS evicted_today FROM hotspot_vouchers")
    ]);
    const customerUsers=(Array.isArray(allUsers)?allUsers:[]).filter(user=>{
      const username=String(user?.username||"").trim().toLowerCase();
      return username&&username!=="default-trial";
    });
    const activeRes=Array.isArray(activeSessions)?activeSessions:[];
    const totalUsers=customerUsers.length;
    const activeUsers=activeRes.filter(session=>{
      const username=String(session?.username||"").trim().toLowerCase();
      return username&&username!=="default-trial";
    }).length;
    const voucherCommentCount=customerUsers.filter(user=>String(user?.comment||"").toLowerCase().includes("voucher")).length;
    const totalVouchers=Math.max(voucherCommentCount,Number(voucherRows?.rows?.[0]?.count||0));
    const vouchersSoldToday=Number(salesRows?.rows?.[0]?.count||0);
    const activeRevenue=Number(salesRows?.rows?.[0]?.total_amount||0);
    const expiredToday=Number(expiredRows?.rows?.[0]?.count||0);
    const expiringWithinHour=Number(expiringRows?.rows?.[0]?.count||0);
    const cleanupPending=Number(cleanupRows?.rows?.[0]?.cleanup_pending||0);
    const evictedToday=Number(cleanupRows?.rows?.[0]?.evicted_today||0);
    return res.json({success:true,totalUsers,activeUsers,onlineClients:activeUsers,offlineUsers:Math.max(0,totalUsers-activeUsers),totalVouchers,vouchersSoldToday,activeRevenue,todayRevenue:activeRevenue,expiredToday,expiringWithinHour,cleanupPending,evictedToday});
  }catch(e){return errorResponse(res,e);}
}
async function voucherStats(req,res){
 try{
  const result=await db.query(
   "SELECT COUNT(*)::int AS total_vouchers, COUNT(*) FILTER (WHERE status='unused')::int AS unused_vouchers, COUNT(*) FILTER (WHERE status='active')::int AS active_vouchers, COUNT(*) FILTER (WHERE status='expired')::int AS expired_vouchers, COUNT(*) FILTER (WHERE status IN ('active','expired'))::int AS used_vouchers, COUNT(*) FILTER (WHERE status='expired' AND cleanup_status IN ('pending','failed'))::int AS cleanup_pending FROM hotspot_vouchers"
  );
  const row=result.rows?.[0]||{};
  return res.json({success:true,totalVouchers:Number(row.total_vouchers||0),unusedVouchers:Number(row.unused_vouchers||0),usedVouchers:Number(row.used_vouchers||0),activeVouchers:Number(row.active_vouchers||0),expiredVouchers:Number(row.expired_vouchers||0),cleanupPending:Number(row.cleanup_pending||0)});
 }catch(e){return errorResponse(res,e);}
}
async function voucherBatches(req,res){
 try{
  const result=await db.query(
   "SELECT batch_id,MIN(created_at) AS created_at,MAX(profile) AS profile,MAX(validity) AS validity,MAX(price) AS price,COUNT(*)::int AS total_count,COUNT(*) FILTER (WHERE status='unused')::int AS unused_count FROM hotspot_vouchers WHERE subscriber_type='scratch_voucher' AND batch_id IS NOT NULL AND status='unused' GROUP BY batch_id ORDER BY MIN(created_at) DESC LIMIT 200",
   []
  );
  return res.json({success:true,batches:result.rows||[]});
 }catch(e){return errorResponse(res,e);}
}
async function voucherBatch(req,res){
 try{
  const batchId=clean(req.params.batchId,64);
  if(!/^[0-9a-f-]{36}$/i.test(batchId))return res.status(400).json({success:false,message:"Invalid voucher batch id."});
  const result=await db.query(
   "SELECT id,batch_id,username,password,profile,validity,price,status,created_at FROM hotspot_vouchers WHERE batch_id=$1 AND subscriber_type='scratch_voucher' AND status='unused' ORDER BY id ASC",
   [batchId]
  );
  return res.json({success:true,batchId,count:result.rows.length,vouchers:result.rows});
 }catch(e){return errorResponse(res,e);}
}
async function voucherRecords(req,res){
 try{
  const allowed=new Set(["all","unused","active","online","offline","expired","cleanup"]);
  const filter=String(req.query.status||"all").trim().toLowerCase();
  if(!allowed.has(filter))return res.status(400).json({success:false,message:"Invalid Hotspot user status filter."});
  const [result,sessionRows]=await Promise.all([
   db.query("SELECT id,username,password,profile,profile_id,validity,price,status,phone,customer_name,mac_address,server,time_limit,data_limit,first_login_at,expires_at,expired_at,cleanup_status,cleanup_attempts,cleanup_error,router_removed_at,subscriber_type,activation_type,batch_id,created_at,updated_at FROM hotspot_vouchers WHERE LOWER(COALESCE(status,'')) NOT IN ('archived','deleted') ORDER BY created_at DESC,id DESC LIMIT 2000"),
   mikrotikService.getActiveHotspotSessions().catch(error=>{console.warn("[Hotspot users] Live-session enrichment unavailable:",error.message);return [];})
  ]);
  const sessions=(Array.isArray(sessionRows)?sessionRows:[]).map(row=>({...row,username:String(row.user||row.username||"").trim(),macAddress:normalizeHotspotMac(row.macAddress||row.mac_address||row["mac-address"]||"")}));
  const byUsername=new Map(),byMac=new Map();
  for(const session of sessions){if(session.username)byUsername.set(session.username.toLowerCase(),session);if(session.macAddress)byMac.set(session.macAddress,session);}
  const now=Date.now();
  const all=(result.rows||[]).map(row=>{
   const username=String(row.username||"").trim(),mac=normalizeHotspotMac(row.mac_address)||normalizeHotspotMac(username);
   const session=byUsername.get(username.toLowerCase())||(mac?byMac.get(mac):null)||null;
   const expiry=row.expires_at?new Date(row.expires_at):null;
   const expired=String(row.status||"").toLowerCase()==="expired"||Boolean(expiry&&Number.isFinite(expiry.getTime())&&expiry.getTime()<=now);
   const online=Boolean(session&&String(session.address||session.ip||"").trim())&&!expired;
   const status=expired?"expired":online?"online":String(row.status||"").toLowerCase()==="pending_claim"?"pending_claim":String(row.status||"").toLowerCase()==="unused"?"unused":"offline";
   const scratchUnused=String(row.subscriber_type||"").toLowerCase()==="scratch_voucher"&&String(row.status||"").toLowerCase()==="unused";
   return {...row,mac_address:scratchUnused?"":(mac||row.mac_address||""),is_scratch_unused:scratchUnused,is_online:online,online,live_status:online?"online":"offline",status,display_status:expired?"Expired":online?"Online":String(row.status||"").toLowerCase()==="pending_claim"?"Pending first login":expiry&&expiry.getTime()>now?"Active · Offline":"Offline",db_status:row.status,subscriber_type:row.subscriber_type||"legacy",activation_type:row.activation_type||"legacy",session_ip:session?.address||session?.ip||"",session_uptime:session?.uptime||"",bytesIn:Number(session?.bytesIn||0),bytesOut:Number(session?.bytesOut||0),price:Number(row.price||0)};
  });
  let rows=all;
  if(filter==="cleanup")rows=all.filter(row=>row.db_status==="expired"&&["pending","failed"].includes(row.cleanup_status));
  else if(filter==="unused")rows=all.filter(row=>row.db_status==="unused");
  else if(filter==="expired")rows=all.filter(row=>row.status==="expired");
  else if(filter==="online")rows=all.filter(row=>row.is_online);
  else if(filter==="active")rows=all.filter(row=>!row.is_online&&row.db_status==="active"&&(!row.expires_at||new Date(row.expires_at).getTime()>now));
  else if(filter==="offline")rows=all.filter(row=>!row.is_online);
  return res.json({success:true,filter,count:rows.length,vouchers:rows,users:rows,activeUsers:sessions.map(row=>({id:row.id||row.sessionId||"",user:row.username,username:row.username,address:row.address||row.ip||"",macAddress:row.macAddress||"",uptime:row.uptime||"",bytesIn:Number(row.bytesIn||0),bytesOut:Number(row.bytesOut||0),profile:row.profile||""}))});
 }catch(e){return errorResponse(res,e);}
}
async function voucherSales(req,res){
 try{
  const startDate=String(req.query?.startDate||"").trim();
  const endDate=String(req.query?.endDate||"").trim();
  const category=normalizeSalesCategory(req.query?.category||"all");
  const allowedCategories=new Set(["all","mfs","scratch_voucher","admin_voucher"]);
  if(!allowedCategories.has(category))return res.status(400).json({success:false,code:"INVALID_SALES_CATEGORY",message:"Select Online MFS, Scratch Card, Admin Manual, or All categories."});
  const isDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value+"T00:00:00Z"))&&new Date(value+"T00:00:00Z").toISOString().slice(0,10)===value;
  if((startDate&&!isDate(startDate))||(endDate&&!isDate(endDate)))return res.status(400).json({success:false,message:"Dates must use YYYY-MM-DD format."});
  if(startDate&&endDate&&startDate>endDate)return res.status(400).json({success:false,message:"Start date must be on or before end date."});
  const params=[];let dateFilter="";
  if(startDate){params.push(startDate);dateFilter+=" AND created_at >= ($"+params.length+"::date AT TIME ZONE 'Asia/Dhaka')";}
  if(endDate){params.push(endDate);dateFilter+=" AND created_at < (($"+params.length+"::date + INTERVAL '1 day') AT TIME ZONE 'Asia/Dhaka')";}
  let categoryFilter="";if(category!=="all"){params.push(category);categoryFilter+=" AND subscriber_type = $"+params.length;}
  const salesCte="WITH sales AS ("+
   "SELECT t.id AS transaction_id,t.channel,t.trx_id,t.sender_phone,t.amount,t.status,t.matched_username,t.created_at,"+
   "COALESCE((SELECT COUNT(DISTINCT COALESCE(hp.voucher_id,v.id))::int FROM hotspot_voucher_payments hp LEFT JOIN hotspot_vouchers v ON v.transaction_id=t.id OR v.id=hp.voucher_id WHERE hp.transaction_id=t.id OR v.transaction_id=t.id),0)::int AS voucher_count,true AS voucher_count_known,"+
   transactionCategorySql("t")+" AS subscriber_type "+
   "FROM transactions t WHERE t.status IN ('processed','PAID') AND (EXISTS (SELECT 1 FROM hotspot_voucher_payments hp WHERE hp.transaction_id=t.id) OR EXISTS (SELECT 1 FROM hotspot_vouchers v WHERE v.transaction_id=t.id)) "+
   "UNION ALL SELECT a.transaction_id,a.channel,a.trx_id,a.sender_phone,a.amount,a.status,a.matched_username,a.created_at,COALESCE(a.voucher_count,0)::int AS voucher_count,(a.voucher_count IS NOT NULL) AS voucher_count_known,"+
   "COALESCE(a.subscriber_type,CASE a.sale_type WHEN 'online_mfs' THEN 'mfs' WHEN 'scratch_card' THEN 'scratch_voucher' WHEN 'manual' THEN 'admin_voucher' ELSE 'other' END) AS subscriber_type "+
   "FROM hotspot_voucher_sales_archive a WHERE a.status IN ('processed','PAID') AND NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id=a.transaction_id))";
  const [summary,rows]=await Promise.all([
   db.query(salesCte+" SELECT COALESCE(SUM(voucher_count),0)::int AS total_vouchers_sold,COUNT(*)::int AS matched_transactions,COALESCE(SUM(amount),0)::numeric(12,2) AS total_amount,BOOL_AND(voucher_count_known) AS voucher_count_complete FROM sales WHERE TRUE"+dateFilter+categoryFilter,params),
   db.query(salesCte+" SELECT channel,trx_id,sender_phone,amount,status,matched_username,created_at,subscriber_type FROM sales WHERE TRUE"+dateFilter+categoryFilter+" ORDER BY created_at DESC,transaction_id DESC LIMIT 500",params)
  ]);
  const summaryRow=summary.rows?.[0]||{};
  return res.json({success:true,category,totalVouchersSold:Number(summaryRow.total_vouchers_sold||0),matchedTransactions:Number(summaryRow.matched_transactions||0),voucherCountComplete:summaryRow.voucher_count_complete===true,totalAmount:Number(summaryRow.total_amount||0),startDate:startDate||null,endDate:endDate||null,transactions:(rows.rows||[]).map(t=>({...t,amount:Number(t.amount||0)}))});
 }catch(e){return errorResponse(res,e);}
}
async function kick(req,res){try{const username=clean(req.body.username,100),id=clean(req.body.id,100);if(!username&&!id)return res.status(400).json({success:false,error:"Username or session id is required."});const result=await mikrotikService.kickActiveHotspotUser(username,id);res.json({success:true,...result});}catch(e){return errorResponse(res,e);}}
async function updateUser(req,res){try{const rawUsername=clean(req.body.username,100),username=normalizeHotspotMac(rawUsername),profile=clean(req.body.profile,100),comment=clean(req.body.comment,500);if(!rawUsername)return res.status(400).json({success:false,message:"Username is required."});if(!username)return res.status(400).json({success:false,code:"MAC_REQUIRED",message:"Hotspot credentials are MAC-based; username must be a normalized device MAC address."});if(!profile)return res.status(400).json({success:false,message:"Profile is required."});const result=await mikrotikService.updateHotspotUser(username,profile,comment,username,username);hotspotListCache.expiresAt=0;return res.json({success:true,message:"Hotspot user updated on MikroTik; username and password are the device MAC.",...result});}catch(e){return errorResponse(res,e);}}
async function deleteHotspotUser({ username: usernameValue, database = db, router = mikrotikService, logger = console } = {}) {
 const requestedUsername=clean(usernameValue,160);
 if(!requestedUsername)throw hotspotError("HOTSPOT_USERNAME_REQUIRED",400,"Username is required.");
 return deleteHotspotSubscriber({identifier:requestedUsername,database,router,logger});
}
async function remove(req,res){try{const result=await deleteHotspotUser({username:req.body?.username});hotspotListCache.expiresAt=0;return res.json({success:true,...result});}catch(e){return errorResponse(res,e);}}

async function manualRenew(req,res){
 const body=req.body&&typeof req.body==="object"?req.body:{},requestedId=clean(body.voucherId??body.voucher_id??body.id??req.params?.id,100),requestedMac=normalizeHotspotMac(body.mac||body.mac_address||""),username=clean(body.username||requestedMac||requestedId,100),requestedProfile=clean(body.profile_id||body.profileId||body.profile||"",100),notify=body.send_notification!==false&&body.notify!==false;
 if(!username||!requestedProfile)return res.status(400).json({success:false,message:"Username and package profile are required."});
 let operationId="";
 try{
  const prepared=await db.withTransaction(async client=>{
   await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-renew:"+username.toLowerCase()]);
   const found=await client.query("SELECT * FROM hotspot_vouchers WHERE ($1<>'' AND id::text=$1) OR LOWER(username)=LOWER($2) OR ($3<>'' AND LOWER(mac_address)=LOWER($3)) ORDER BY CASE WHEN ($1<>'' AND id::text=$1) THEN 0 ELSE 1 END,id DESC LIMIT 1 FOR UPDATE",[requestedId,username,requestedMac]),voucher=found.rows?.[0];
   if(!voucher)throw hotspotError("HOTSPOT_VOUCHER_NOT_FOUND",404,"The Hotspot voucher was not found in PostgreSQL.");
   await hotspotRenewalOperations.cleanupStaleRenewals(client,60);
   const pending=await client.query("SELECT id FROM hotspot_renewal_operations WHERE voucher_id=$1 AND status='pending' LIMIT 1",[voucher.id]);
   if(pending.rows?.length)throw hotspotError("HOTSPOT_RENEWAL_PENDING",409,"A previous Hotspot renewal is still being synchronized. Wait for reconciliation before retrying.");
   const [routerProfiles,meta]=await Promise.all([mikrotikService.getHotspotProfiles(),readProfileMetadata()]);
   let candidates=(Array.isArray(routerProfiles)?routerProfiles:[]).filter(item=>profileIdentifierMatches(item.name,meta[String(item.name||"")]||{},requestedProfile));
   if(!candidates.length)candidates=Object.entries(meta).filter(([name,details])=>profileIdentifierMatches(name,details,requestedProfile)).map(([name,details])=>({name,sessionTimeout:details?.validityValue&&details?.validityUnit?normalizeProfileValidity(details.validityValue,details.validityUnit).validity:"",sharedUsers:1,raw:{}}));
   if(candidates.length!==1)throw hotspotError("HOTSPOT_PROFILE_INVALID",400,"Selected package could not be mapped to exactly one RouterOS profile.");
   const selected=candidates[0],profile=String(selected.name||"").trim(),pm=meta[profile]||{},packageConfig=resolveHotspotPackage(selected,pm),validity=packageConfig.validity,quota=packageConfig.limitBytesTotal,duration=packageConfig.durationMs;
   if(packageConfig.type==="INVALID")throw hotspotError("HOTSPOT_PROFILE_DURATION_INVALID",400,"Selected package has no supported time validity or data quota.");
   const stamp=d=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day+" "+p.hour+":"+p.minute+":"+p.second;};
   const now=new Date(),currentExpiry=voucher.expires_at?new Date(voucher.expires_at):null,renewalStacked=Boolean(duration&&currentExpiry&&!Number.isNaN(currentExpiry.getTime())&&currentExpiry.getTime()>now.getTime()),expiry=duration?new Date((renewalStacked?currentExpiry:now).getTime()+duration):null;
   const phoneCandidate=normalizeHotspotPhone(voucher.phone||voucher.password||""),phone=/^01\d{9}$/.test(phoneCandidate)?phoneCandidate:"",mac=normalizeHotspotMac(voucher.mac_address)||normalizeHotspotMac(voucher.username)||"";if(!mac)throw hotspotError("HOTSPOT_MAC_REQUIRED",409,"MAC-based Hotspot renewal requires a bound device MAC. Bind the device before renewing.");
   let stackedQuota=Math.max(0,Math.floor(Number(quota)||0));
   if(stackedQuota>0){
    const snapshot=await mikrotikService.getHotspotExpirationSnapshot(),deviceNames=new Set([mac,voucher.username].map(value=>String(value||"").trim().toUpperCase()).filter(Boolean)),routerUser=(snapshot.users||[]).find(item=>deviceNames.has(String(item.username||"").trim().toUpperCase()));
    if(routerUser){const currentLimit=Math.max(0,Math.floor(Number(routerUser.limitBytesTotal)||0)),usedBytes=Math.max(0,Math.floor(Number(routerUser.bytesIn)||0))+Math.max(0,Math.floor(Number(routerUser.bytesOut)||0)),remainingBytes=currentLimit>0?Math.max(0,currentLimit-usedBytes):0;stackedQuota+=remainingBytes;}
   }
   const comment=expiry?"Exp: "+stamp(expiry):packageConfig.comment;
   operationId=crypto.randomUUID();
   const payload={voucherId:voucher.id,mac,profile,validity,limitBytesTotal:stackedQuota,expiryDate:expiry?stamp(expiry).slice(0,10):"",comment,previousUsername:voucher.username!==mac?voucher.username:"",server:voucher.server||"all",phone,customerName:clean(body.customer_name||voucher.customer_name,160),price:Number(pm.price??voucher.price??0),expiresAt:expiry?expiry.toISOString():null,renewalStacked,packageName:pm.packageName||pm.package_name||profile,expiryLabel:expiry?stamp(expiry):null};
   await client.query("INSERT INTO hotspot_renewal_operations(id,voucher_id,payload,status,next_attempt_at) VALUES($1::uuid,$2::bigint,$3::jsonb,'pending',NOW()+INTERVAL '5 minutes')",[operationId,voucher.id,JSON.stringify(payload)]);
   return payload;
  });
  await hotspotRenewalOperations.applyRouterRenewal(prepared);
  const routerMarked=await db.query("UPDATE hotspot_renewal_operations SET router_applied=true,attempts=attempts+1,last_error=NULL,next_attempt_at=NOW(),updated_at=NOW() WHERE id=$1::uuid AND status='pending' RETURNING id",[operationId]);
  if(!routerMarked.rows?.length)throw new Error("RouterOS renewal was applied but its PostgreSQL operation record could not be marked.");
  const renewed=await db.withTransaction(async client=>{
   const locked=await client.query("SELECT id FROM hotspot_vouchers WHERE id=$1::bigint FOR UPDATE",[String(prepared.voucherId)]);
   if(locked.rowCount!==1)throw new Error("Hotspot voucher ID "+prepared.voucherId+" no longer exists during renewal finalization.");
   const saved=await hotspotRenewalOperations.finalizeRenewal(client,operationId,prepared);
   return {voucher:saved,expiryLabel:prepared.expiryLabel,packageName:prepared.packageName,phone:prepared.phone};
  });
  hotspotListCache.expiresAt=0;
  if(notify&&/^01\d{9}$/.test(String(renewed.phone||""))){
   const customerLabel=String(renewed.voucher.customer_name||"গ্রাহক").trim()||"গ্রাহক";
   const newExpiryStr=renewed.expiryLabel||"Data quota";
   notificationDispatcher.dispatchNotification({userType:"hotspot",event:"hotspot_renewal",to:renewed.phone,recipient:renewed.phone,phone:renewed.phone,username:renewed.voucher.username,customer:{username:renewed.voucher.username,name:customerLabel,phone:renewed.phone,profile:renewed.voucher.profile},customerName:customerLabel,message:`আসসালামু আলাইকুম ${customerLabel}, আপনার হটস্পট প্যাকেজটি সফলভাবে রিনিউ করা হয়েছে।\nপ্যাকেজ: ${renewed.packageName}\nনতুন মেয়াদ: ${newExpiryStr} পর্যন্ত।\nধন্যবাদ, FAZ NETWORK।`,useMessageDirectly:true,variables:{name:customerLabel,username:renewed.voucher.username,package:renewed.packageName,profile:renewed.voucher.profile,expiry_date:newExpiryStr},channels:["sms","whatsapp"]});
  }
  return res.json({success:true,message:"Hotspot package renewed; RouterOS credentials remain MAC-based.",voucher:renewed.voucher,expiry:renewed.expiryLabel,new_expiry:renewed.expiryLabel});
 }catch(e){if(operationId)await hotspotRenewalOperations.failRenewal(db,operationId,e).catch(()=>{});return errorResponse(res,e);}
}

module.exports={page,servers,profiles,listServerProfiles,listMikrotikFiles,listServerProfileOptions,createServerProfile,updateServerProfile,previewProfileScript,createProfile,updateProfile,deleteProfile,syncProfiles,list,active,disconnectActive,generate,voucherBatches,voucherBatch,createUser,manualRenew,dashboardMetrics,voucherStats,voucherRecords,voucherSales,kick,remove,updateUser,deleteHotspotUser,importFromMikrotik,pushToMikrotik,invalidateListCache:()=>{hotspotListCache.expiresAt=0;},refreshHotspotListCache};
