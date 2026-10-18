const crypto=require("crypto");const db=require("../db");const mikrotikService=require("../services/mikrotikService");const {normalizeProfileValidity,parseStoredValidity,buildHotspotOnLoginScript}=require("../services/hotspotProfileConfig");const {syncHotspotProfileScripts}=require("../jobs/hotspotProfileScriptSync");
const notificationDispatcher=require("../services/notificationDispatcher");
function clean(v,max=255){return String(v??"").trim().slice(0,max)}
function normalizeHotspotPhone(value){const bangla="০১২৩৪৫৬৭৮৯";let digits=String(value??"").replace(/[০-৯]/g,ch=>String(bangla.indexOf(ch))).replace(/\D/g,"");if(digits.startsWith("880")&&digits.length===13)digits="0"+digits.slice(3);return digits;}
function normalizeHotspotMac(value){const compact=String(value??"").trim().replace(/[:-]/g,"");return /^[0-9a-fA-F]{12}$/.test(compact)?compact.match(/.{2}/g).join(":").toUpperCase():"";}
function normalizeProfileIdentifier(value){return String(value??"").normalize("NFKC").trim().toLowerCase().replace(/\b(hours?|hrs?)\b/g,"h").replace(/\b(minutes?|mins?)\b/g,"m").replace(/\b(seconds?|secs?)\b/g,"s").replace(/\b(days?)\b/g,"d").replace(/\b(weeks?)\b/g,"w").replace(/\b(months?)\b/g,"mo").replace(/[^a-z0-9]/g,"");}
function profileIdentifierMatches(profileName,metadata,requested){if(!requested)return false;const aliases=[profileName,metadata?.id,metadata?.profileId,metadata?.profile_id,metadata?.packageId,metadata?.package_id,metadata?.packageName,metadata?.package_name,metadata?.alias,metadata?.aliases];const target=normalizeProfileIdentifier(requested);return Boolean(target)&&aliases.flatMap(value=>Array.isArray(value)?value:[value]).filter(value=>value!==undefined&&value!==null&&String(value).trim()!=="").some(value=>normalizeProfileIdentifier(value)===target);}
function hotspotError(code,statusCode,message){const error=new Error(message);error.code=code;error.statusCode=statusCode;return error;}
function errorResponse(res,e){console.error("[Hotspot API]",e);const message=e?.message||"Hotspot operation failed.";return res.status(e?.statusCode||503).json({success:false,users:[],profiles:[],message,error:message});}
function randomPin(length=8){return crypto.randomBytes(Math.ceil(length*1.5)).toString("base64url").replace(/[^A-Za-z0-9]/g,"").slice(0,length).toUpperCase();}
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
async function servers(req,res){try{const data=await mikrotikService.getHotspotServers();return res.json({success:true,servers:data.map(s=>({name:s.name,interface:s.interface,profile:s.profile}))});}catch(e){return errorResponse(res,e);}}
async function profiles(req,res){try{const [routerProfiles,meta]=await Promise.all([mikrotikService.getHotspotProfiles().catch(()=>[]),readProfileMetadata()]);const data=Array.isArray(routerProfiles)&&routerProfiles.length?routerProfiles:Object.entries(meta).map(([name,m])=>({name,rateLimit:String(m?.rateLimit||""),sharedUsers:"1",sessionTimeout:"",raw:{}}));return res.json({success:true,profiles:data.filter(p=>p.name&&String(p.name).toLowerCase()!=="default").map(p=>{const m=meta[p.name]||{};let v;try{v=m.validityValue?normalizeProfileValidity(m.validityValue,m.validityUnit):parseStoredValidity(p);}catch(_){v=parseStoredValidity(p);}return {...p,profile_id:String(m.id||m.profileId||m.profile_id||m.packageId||m.package_id||m.packageName||m.package_name||m.alias||p.name),price:Number(m.price||0),validityValue:v.value,validityUnit:v.unit,validityLabel:m.validityLabel||v.validityLabel,limitBytesTotal:Number(m.limitBytesTotal||v.limitBytesTotal||0)};})});}catch(e){return errorResponse(res,e);}}
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
 return res.json({success:true,message:"Hotspot profile created and metadata saved.",profile:{...result,rateLimit,sharedUsers,price,...v,onLogin}});
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
 return res.json({success:true,message:"Hotspot profile updated and metadata saved.",profile:{...result,rateLimit,sharedUsers,price,...v,onLogin}});
}catch(e){return errorResponse(res,e);}}
async function syncProfiles(req,res){
 try{
  const sync=await syncHotspotProfileScripts();
  const serverAuth=sync.serverAuth||{checked:0,updated:0,skipped:0,failed:0};
  const success=Number(sync.failed||0)===0&&Number(serverAuth.failed||0)===0;
  return res.status(success?200:502).json({success,message:success?"Hotspot profile sync completed.":"Hotspot profile sync completed with errors; review the per-profile results.",sync});
 }catch(e){return errorResponse(res,e);}
}
async function deleteProfile(req,res){try{const name=clean(req.body.name,100);if(!name||name.toLowerCase()==="default")return res.status(400).json({success:false,message:"The default profile cannot be deleted here."});const result=await mikrotikService.deleteHotspotProfile(name);const meta=await readProfileMetadata();delete meta[name];await writeProfileMetadata(meta);return res.json({success:true,message:"Hotspot profile deleted successfully from MikroTik.",profile:result});}catch(e){return errorResponse(res,e);}}
let hotspotListCache={expiresAt:0,users:null,activeUsers:[]},hotspotListRefresh=null;
async function refreshHotspotListCache(){
 if(hotspotListRefresh)return hotspotListRefresh;
 hotspotListRefresh=(async()=>{
  // Persist expiry state first so both this response and downstream cleanup observe the same lifecycle state.
  await db.query("UPDATE hotspot_vouchers SET status='expired',profile='expired_profile',cleanup_status=CASE WHEN LOWER(COALESCE(cleanup_status,'')) IN ('completed','not_required') THEN cleanup_status ELSE 'pending' END,expired_at=COALESCE(expired_at,expires_at,NOW()),updated_at=NOW() WHERE expires_at < NOW() AND LOWER(COALESCE(status,'')) NOT IN ('archived','expired')");
  // PostgreSQL is the subscriber source of truth. RouterOS contributes live-session telemetry only.
  const ledgerPromise=db.query("SELECT id,username,password,status,comment,expires_at,first_login_at,validity,customer_name,phone,mac_address,server,transaction_id,profile,price,mac_lock,subscriber_type,activation_type,profile_id,created_at,updated_at FROM hotspot_vouchers WHERE LOWER(COALESCE(status,'')) <> 'archived' ORDER BY id DESC");
  const sessionsPromise=mikrotikService.getActiveHotspotSessions().catch(error=>{console.warn("[Hotspot API] Active-session lookup unavailable; returning database records as offline:",error.message);return [];});
  const [ledger,sessionRows]=await Promise.all([ledgerPromise,sessionsPromise]);
  const activeUsers=(Array.isArray(sessionRows)?sessionRows:[]).filter(row=>String(row?.username||"").trim()&&String(row.username).toLowerCase()!=="default-trial").map(row=>({id:row.id||"",sessionId:row.id||"",user:row.username,username:row.username,address:row.address||"",macAddress:normalizeHotspotMac(row.macAddress||row.mac_address||row["mac-address"]||""),uptime:row.uptime||"",sessionTimeLeft:row.sessionTimeLeft||"",bytesIn:Number(row.bytesIn||0),bytesOut:Number(row.bytesOut||0),server:row.server||"",profile:row.profile||""}));
  const now=Date.now();
  const users=(ledger.rows||[]).map(row=>{
   const mac=normalizeHotspotMac(row.mac_address)||normalizeHotspotMac(row.username);
   const session=activeUsers.find(item=>(mac&&normalizeHotspotMac(item.macAddress)===mac)||String(item.username||"").trim().toLowerCase()===String(row.username||"").trim().toLowerCase())||null;
   const expiry=row.expires_at?new Date(row.expires_at):null;
   const isExpired=Boolean((expiry&&!Number.isNaN(expiry.getTime())&&expiry.getTime()<=now)||String(row.status||"").toLowerCase()==="expired"||String(row.profile||"").toLowerCase()==="expired_profile");
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
  let imported=0,updated=0,skipped=0;
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
      "SELECT id FROM hotspot_vouchers WHERE LOWER(mac_address)=LOWER($1) OR LOWER(username)=LOWER($1) ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [mac]
     );
     const existing=match.rows?.[0];
     if(existing) {
      await client.query(
       "UPDATE hotspot_vouchers SET profile=COALESCE(NULLIF($2,''),profile),expires_at=COALESCE($3,expires_at),status='active',updated_at=NOW() WHERE id=$1",
       [existing.id,profile,expiry]
      );
      return "updated";
     }
     await client.query(
      "INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment,phone,customer_name,server,expires_at,mac_address,first_login_at) VALUES($1,$2,$3,'imported',0,'active',$4,$5,'Imported Subscriber',$6,$7,$8,NOW()) RETURNING id",
      [mac,clean(routerUser?.password,100)||mac,profile,comment,phone,server,expiry,mac]
     );
     return "imported";
    });
    if(outcome==="updated")updated++;else imported++;
   } catch(error) {
    // A concurrent provisioning path may win the unique username/MAC index race.
    // The failed transaction is rolled back before re-reading; only router-owned fields are updated.
    if(error?.code!=="23505")throw error;
    const raced=await db.query(
     "SELECT id FROM hotspot_vouchers WHERE LOWER(mac_address)=LOWER($1) OR LOWER(username)=LOWER($1) ORDER BY id DESC LIMIT 1",
     [mac]
    );
    if(!raced.rows?.[0])throw error;
    await db.query(
     "UPDATE hotspot_vouchers SET profile=COALESCE(NULLIF($2,''),profile),expires_at=COALESCE($3,expires_at),status='active',updated_at=NOW() WHERE id=$1",
     [raced.rows[0].id,profile,expiry]
    );
    updated++;
   }
  }
  hotspotListCache.expiresAt=0;
  return res.json({success:true,imported,updated,skipped});
 } catch(error) { return errorResponse(res,error); }
}
async function pushToMikrotik(req,res) {
 try {
  const result=await db.query("SELECT id,username,profile,validity,status,comment,server,mac_address,expires_at,created_at FROM hotspot_vouchers WHERE status IN ('active','unused') AND mac_address IS NOT NULL AND BTRIM(mac_address)<>'' ORDER BY id ASC");
  const vouchers=[];
  let skipped=0;
  for(const row of (result.rows||[])) {
   const mac=normalizeHotspotMac(row.mac_address);
   const profile=clean(row.profile,100);
   if(!mac||!profile){skipped++;continue;}
   const expiry=row.expires_at?new Date(row.expires_at):(parseHotspotExpiry(row.comment)||voucherValidUntil(row.created_at,row.validity));
   if(!expiry||Number.isNaN(expiry.getTime())){skipped++;continue;}
   vouchers.push({macAddress:mac,profile,server:clean(row.server,100)||"all",comment:formatHotspotExpiry(expiry),expired:expiry.getTime()<=Date.now()});
  }
  const sync=vouchers.length?await mikrotikService.syncHotspotUsers(vouchers):{provisioned:0,refreshed:0,skipped:0,disconnected:0};
  hotspotListCache.expiresAt=0;
  return res.json({success:true,provisioned:Number(sync.provisioned||0),refreshed:Number(sync.refreshed||0),skipped:skipped+Number(sync.skipped||0),disconnected:Number(sync.disconnected||0)});
 } catch(error) { return errorResponse(res,error); }
}

async function list(req,res){try{const filter=normalizeFilter(req.query.filter);const c=hotspotListCache.users&&hotspotListCache.expiresAt>Date.now()?hotspotListCache:await refreshHotspotListCache();if(c===hotspotListCache&&c.expiresAt>Date.now())refreshHotspotListCache().catch(e=>console.warn("[Hotspot API] Background refresh failed:",e.message));const users=(c.users||[]).filter(user=>{if(filter==="online")return user.is_online;if(filter==="expired")return user.status==="expired";if(filter==="active")return !user.is_online&&user.status!=="expired"&&user.expires_at&&new Date(user.expires_at).getTime()>Date.now();if(filter==="offline")return !user.is_online;return true;});return res.json({success:true,filter,count:users.length,users,activeUsers:c.activeUsers,cached:Boolean(c.expiresAt>Date.now())});}catch(e){return errorResponse(res,e);}}
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
  const created=await db.withTransaction(async client=>{
   const vouchers=[];
   for(let i=0;i<quantity;i++){
    let username,password,inserted=null;
    for(let attempt=0;attempt<8&&!inserted;attempt++){
     username=(userPrefix||"")+randomPin(charLength);
     password=randomPin(8);
     const result=await client.query(
      "INSERT INTO hotspot_vouchers (username,password,profile,validity,price,status,comment,subscriber_type,activation_type,server,mac_lock) VALUES ($1,$2,$3,$4,$5,'unused',$6,'scratch_voucher','first_login',$7,false) ON CONFLICT DO NOTHING RETURNING id,username,password,profile,validity,price,status,created_at",
      [username,password,profileName,normalizedValidity,price,"Scratch voucher; profile validity applies on first successful login.",server]
     );
     inserted=result.rows[0]||null;
    }
    if(!inserted)throw new Error("Could not allocate a unique voucher PIN. Change the prefix or retry.");
    vouchers.push(inserted);
   }
   return vouchers;
  });
  hotspotListCache.expiresAt=0;
  return res.status(201).json({success:true,count:created.length,profile:profileName,validity:normalizedValidity,vouchers:created,message:"Voucher PINs generated successfully using the selected Hotspot profile validity."});
 }catch(error){return errorResponse(res,error);}
}
async function createUser(req,res){
  let savedId=null,routerProvisioned=false,previousRecord=null,createdNewRecord=false;
  try{
    const body=req.body&&typeof req.body==="object"?req.body:{};
    const phone=normalizeHotspotPhone(body.phone||body.customer_phone||"");
    const rawMac=String(body.mac||body.mac_address||"").trim();
    const mac=normalizeHotspotMac(rawMac);
    const requestedProfile=clean(body.profile_id||body.profileId||body.profile||"",100);
    const server=clean(body.server||"all",100)||"all";
    const mode=String(body.activation_type||body.activationMode||(rawMac?"preassigned":"first_login")).trim().toLowerCase();
    const preassigned=mode==="preassigned";
    const customerName=clean(body.customer_name||body.name,160);
    const note=clean(body.note||body.address,1000);
    const customRaw=String(body.expires_at||body.custom_expiry||"").trim();
    const customExpiry=customRaw?new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(customRaw)?customRaw+":00+06:00":customRaw):null;
    if(!["preassigned","first_login"].includes(mode))return res.status(400).json({success:false,code:"INVALID_ACTIVATION_MODE",message:"Choose Pre-Assigned or On First Login."});
    if(!customerName)return res.status(400).json({success:false,code:"CUSTOMER_NAME_REQUIRED",message:"Customer name is required for a direct subscriber."});
    if(!/^01\d{9}$/.test(phone))return res.status(400).json({success:false,code:"INVALID_ACCOUNT_PHONE",message:"Enter a valid 11-digit Bangladeshi phone number (01XXXXXXXXX)."});
    if(preassigned&&(!rawMac||!mac))return res.status(400).json({success:false,code:"MAC_REQUIRED",message:"Pre-Assigned mode requires a valid device MAC address."});
    if(!preassigned&&rawMac)return res.status(400).json({success:false,code:"ACTIVATION_MODE_MISMATCH",message:"Leave the MAC field empty for On First Login, or select Pre-Assigned."});
    if(!requestedProfile)return res.status(400).json({success:false,code:"PROFILE_REQUIRED",message:"Select a Hotspot package/profile."});
    if(customRaw&&(!preassigned||!customExpiry||Number.isNaN(customExpiry.getTime())||customExpiry.getTime()<=Date.now()))return res.status(400).json({success:false,code:"INVALID_EXPIRY",message:"Custom expiry is allowed only in Pre-Assigned mode and must be a valid future date and time."});
    const [routerProfiles,meta]=await Promise.all([mikrotikService.getHotspotProfiles().catch(()=>[]),readProfileMetadata()]);
    let candidates=(Array.isArray(routerProfiles)?routerProfiles:[]).filter(item=>profileIdentifierMatches(item.name,meta[String(item.name||"")]||{},requestedProfile));
    if(!candidates.length)candidates=Object.entries(meta).filter(([name,details])=>profileIdentifierMatches(name,details,requestedProfile)).map(([name,details])=>({name,sessionTimeout:details?.validityValue&&details?.validityUnit?normalizeProfileValidity(details.validityValue,details.validityUnit).validity:"",sharedUsers:1,raw:{}}));
    if(candidates.length!==1)return res.status(400).json({success:false,code:"PROFILE_NOT_FOUND_OR_AMBIGUOUS",message:"The selected package/profile could not be mapped to exactly one saved Hotspot profile."});
    const profileRow=candidates[0],profile=String(profileRow.name||"").trim(),profileMeta=meta[profile]||{};
    const profileValidity=profileMeta.validityValue?normalizeProfileValidity(profileMeta.validityValue,profileMeta.validityUnit):parseStoredValidity(profileRow);
    const validity=String(profileValidity.validity||"").trim(),quota=Number(profileMeta.limitBytesTotal||profileValidity.limitBytesTotal||0);
    if(!validity&&!quota&&!customExpiry)return res.status(400).json({success:false,code:"PROFILE_INVALID",message:"Configure a time validity or data quota for this package before creating an account."});
    const durationMs=validityMs(validity);
    const now=new Date();
    const expiresAt=preassigned?(customExpiry||(durationMs?new Date(now.getTime()+durationMs):null)):null;
    if(preassigned&&!expiresAt&&!quota)return res.status(400).json({success:false,code:"PROFILE_INVALID",message:"The selected profile must have a validity duration or data quota."});
    const dhakaStamp=date=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date).reduce((o,x)=>(o[x.type]=x.value,o),{});return p.year+"-"+p.month+"-"+p.day+" "+p.hour+":"+p.minute+":"+p.second;};
    const comment=preassigned?(expiresAt?"Exp: "+dhakaStamp(expiresAt):(quota?"FAZ|DATA_ONLY":"")):"FAZ|PENDING|DIRECT_SUBSCRIBER|PROFILE="+profile;
    const priceResult=await db.query("SELECT price FROM hotspot_vouchers WHERE LOWER(profile)=LOWER($1) AND price IS NOT NULL ORDER BY created_at DESC,id DESC LIMIT 1",[profile]).catch(()=>({rows:[]}));
    const price=Number(profileMeta.price??priceResult.rows?.[0]?.price??0);
    const profileId=String(profileMeta.id||profileMeta.profileId||profileMeta.profile_id||profileMeta.packageId||profileMeta.package_id||profileMeta.packageName||profileMeta.package_name||profileMeta.alias||requestedProfile);
    const stagedUsername="STAGED-"+crypto.randomUUID();
    const initialUsername=preassigned?mac:stagedUsername;
    const initialPassword=preassigned?mac:crypto.randomBytes(24).toString("base64url");
    const stored=await db.withTransaction(async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-direct-phone:"+phone]);
      if(preassigned)await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-direct-mac:"+mac]);
      const existingPhone=await client.query("SELECT * FROM hotspot_vouchers WHERE REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($1,'880'||SUBSTRING($1 FROM 2)) AND COALESCE(subscriber_type,'legacy')='direct_subscriber' AND LOWER(COALESCE(status,'')) IN ('pending_claim','unused','active','expired') ORDER BY id DESC FOR UPDATE",[phone]);
      const phoneRows=existingPhone.rows||[];
      if(phoneRows.some(row=>String(row.status||"").toLowerCase()==="active"&&(!row.expires_at||new Date(row.expires_at).getTime()>Date.now())))throw hotspotError("ACTIVE_PACKAGE_EXISTS",409,"This phone already has an active direct Hotspot subscriber/package.");
      const existingMac=preassigned?await client.query("SELECT * FROM hotspot_vouchers WHERE (LOWER(COALESCE(mac_address,''))=LOWER($1) OR LOWER(username)=LOWER($1)) AND COALESCE(subscriber_type,'legacy')='direct_subscriber' AND LOWER(COALESCE(status,'')) IN ('pending_claim','unused','active','expired') ORDER BY id DESC FOR UPDATE",[mac]):{rows:[]};
      if(preassigned&&(existingMac.rows||[]).some(row=>normalizeHotspotPhone(row.phone)&&normalizeHotspotPhone(row.phone)!==phone))throw hotspotError("MAC_ALREADY_BOUND",409,"This MAC address is already bound to another direct subscriber.");
      const reusable=phoneRows.find(row=>["expired","unused","pending_claim"].includes(String(row.status||"").toLowerCase())||Boolean(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()));
      const params=[initialUsername,initialPassword,profile,validity,price,comment,phone,server,validity||null,quota?String(quota):null,profileId,preassigned?mac:null,customerName,note,preassigned?now:null,expiresAt,true];
      if(reusable){
        previousRecord=reusable;
        const result=await client.query("UPDATE hotspot_vouchers SET username=$1,password=$2,profile=$3,validity=$4,price=$5,status=$18,comment=$6,phone=$7,server=$8,time_limit=$9,data_limit=$10,profile_id=$11,mac_address=$12,customer_name=$13,note=$14,first_login_at=$15,expires_at=$16,mac_lock=$17,subscriber_type='direct_subscriber',activation_type=$19,expired_at=NULL,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$20 RETURNING id,username,profile,profile_id,phone,status,mac_address,customer_name,note,expires_at,first_login_at",[...params,preassigned?"active":"pending_claim",mode,reusable.id]);
        if(!result.rows?.length)throw new Error("Direct subscriber could not be saved in PostgreSQL.");
        return result.rows[0];
      }
      const result=await client.query("INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment,phone,server,time_limit,data_limit,profile_id,mac_address,customer_name,note,cleanup_status,first_login_at,expires_at,mac_lock,subscriber_type,activation_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'not_required',$16,$17,$18,'direct_subscriber',$19) RETURNING id,username,profile,profile_id,phone,status,mac_address,customer_name,note,expires_at,first_login_at",[initialUsername,initialPassword,profile,validity,price,preassigned?"active":"pending_claim",comment,phone,server,validity||null,quota?String(quota):null,profileId,preassigned?mac:null,customerName,note,preassigned?now:null,expiresAt,true,mode]);
      if(!result.rows?.length)throw new Error("Direct subscriber could not be saved in PostgreSQL.");
      createdNewRecord=true;
      return result.rows[0];
    });
    savedId=stored.id;
    if(preassigned){
      await mikrotikService.rechargeHotspotUser({username:mac,password:mac,profile,validity,limitBytesTotal:quota,comment,server,macAddress:mac,previousUsername:previousRecord?.username});
      routerProvisioned=true;
      await db.query("UPDATE hotspot_vouchers SET status='active',username=$2,password=$2,mac_address=$2,first_login_at=COALESCE(first_login_at,$3),expires_at=$4,comment=$5,expired_at=NULL,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$1",[stored.id,mac,now,expiresAt,comment]);
    }
    if(phone){
      const customerLabel=String(stored.customer_name||customerName||"গ্রাহক").trim()||"গ্রাহক";
      if(preassigned){
        const expiryStr=expiresAt?new Date(expiresAt).toLocaleString("en-BD",{timeZone:"Asia/Dhaka"}):"প্যাকেজ অনুযায়ী";
        notificationDispatcher.dispatchNotification({userType:"hotspot",event:"hotspot_account_created",to:phone,recipient:phone,phone,username:preassigned?mac:stagedUsername,customer:{username:preassigned?mac:stagedUsername,name:customerLabel,phone,profile},customerName:customerLabel,message:"আসসালামু আলাইকুম "+customerLabel+", FAZ NETWORK-এ আপনার হটস্পট অ্যাকাউন্ট "+(preassigned?"সফলভাবে চালু করা হয়েছে।":"তৈরি করা হয়েছে; প্রথম লগইনে সক্রিয় হবে।")+"\nপ্যাকেজ: "+profile+"\nমেয়াদ: "+expiryStr+" পর্যন্ত।\nধন্যবাদ!",useMessageDirectly:true,channels:["whatsapp"],variables:{name:customerLabel,username:preassigned?mac:stagedUsername,profile,package:profile,expiry_date:expiryStr}});
      }
    }
    hotspotListCache.expiresAt=0;
    return res.status(201).json({success:true,subscriber_type:"direct_subscriber",activation_type:mode,pending_activation:!preassigned,instant_provisioned:preassigned,message:preassigned?"Direct subscriber created and provisioned on MikroTik immediately.":"Direct subscriber staged in PostgreSQL; MAC binding and validity countdown begin on first captive-portal authentication.",user:{id:stored.id,username:preassigned?mac:null,phone,customer_name:customerName,profile:stored.profile,profile_id:stored.profile_id,status:stored.status,mac_address:preassigned?mac:null,first_login_at:stored.first_login_at||null,expires_at:expiresAt?expiresAt.toISOString():null}});
  }catch(e){
    if(savedId&&!routerProvisioned){
      if(previousRecord){
        await db.query("UPDATE hotspot_vouchers SET username=$2,password=$3,profile=$4,validity=$5,price=$6,status=$7,comment=$8,phone=$9,server=$10,time_limit=$11,data_limit=$12,profile_id=$13,mac_address=$14,customer_name=$15,note=$16,first_login_at=$17,expires_at=$18,mac_lock=$19,expired_at=$20,cleanup_status=$21,cleanup_error=$22,router_removed_at=$23,subscriber_type=$24,activation_type=$25,updated_at=NOW() WHERE id=$1",[savedId,previousRecord.username,previousRecord.password,previousRecord.profile,previousRecord.validity,previousRecord.price,previousRecord.status,previousRecord.comment,previousRecord.phone,previousRecord.server,previousRecord.time_limit,previousRecord.data_limit,previousRecord.profile_id,previousRecord.mac_address,previousRecord.customer_name,previousRecord.note,previousRecord.first_login_at,previousRecord.expires_at,previousRecord.mac_lock,previousRecord.expired_at,previousRecord.cleanup_status,previousRecord.cleanup_error,previousRecord.router_removed_at,previousRecord.subscriber_type,previousRecord.activation_type]).catch(()=>{});
      }else if(createdNewRecord&&preassigned)await db.query("DELETE FROM hotspot_vouchers WHERE id=$1 AND subscriber_type='direct_subscriber' AND LOWER(username)=LOWER($2)",[savedId,normalizeHotspotMac(req.body?.mac||req.body?.mac_address||"")]).catch(()=>{});
    }
    return errorResponse(res,e);
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
async function voucherRecords(req,res){
 try{
  const allowed=new Set(["all","unused","active","online","offline","expired","cleanup"]);
  const filter=String(req.query.status||"all").trim().toLowerCase();
  if(!allowed.has(filter))return res.status(400).json({success:false,message:"Invalid Hotspot user status filter."});
  const [result,sessionRows]=await Promise.all([
   db.query("SELECT id,username,password,profile,profile_id,validity,price,status,phone,customer_name,mac_address,server,time_limit,data_limit,first_login_at,expires_at,expired_at,cleanup_status,cleanup_attempts,cleanup_error,router_removed_at,subscriber_type,activation_type,created_at,updated_at FROM hotspot_vouchers WHERE LOWER(COALESCE(status,'')) <> 'archived' ORDER BY created_at DESC,id DESC LIMIT 2000"),
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
   const expired=String(row.status||"").toLowerCase()==="expired"||String(row.profile||"").toLowerCase()==="expired_profile"||Boolean(expiry&&Number.isFinite(expiry.getTime())&&expiry.getTime()<=now);
   const online=Boolean(session&&String(session.address||session.ip||"").trim())&&!expired;
   const status=expired?"expired":online?"online":String(row.status||"").toLowerCase()==="pending_claim"?"pending_claim":String(row.status||"").toLowerCase()==="unused"?"unused":"offline";
   return {...row,mac_address:mac||row.mac_address||"",is_online:online,online,live_status:online?"online":"offline",status,display_status:expired?"Expired":online?"Online":String(row.status||"").toLowerCase()==="pending_claim"?"Pending first login":expiry&&expiry.getTime()>now?"Active · Offline":"Offline",db_status:row.status,subscriber_type:row.subscriber_type||"legacy",activation_type:row.activation_type||"legacy",session_ip:session?.address||session?.ip||"",session_uptime:session?.uptime||"",bytesIn:Number(session?.bytesIn||0),bytesOut:Number(session?.bytesOut||0),price:Number(row.price||0)};
  });
  let rows=all;
  if(filter==="cleanup")rows=all.filter(row=>row.db_status==="expired"&&["pending","failed"].includes(row.cleanup_status));
  else if(filter==="unused")rows=all.filter(row=>row.db_status==="unused");
  else if(filter==="expired")rows=all.filter(row=>row.status==="expired");
  else if(filter==="online")rows=all.filter(row=>row.is_online);
  else if(filter==="active")rows=all.filter(row=>!row.is_online&&row.status!=="expired"&&row.expires_at&&new Date(row.expires_at).getTime()>now);
  else if(filter==="offline")rows=all.filter(row=>!row.is_online);
  return res.json({success:true,filter,count:rows.length,vouchers:rows,users:rows,activeUsers:sessions.map(row=>({id:row.id||row.sessionId||"",user:row.username,username:row.username,address:row.address||row.ip||"",macAddress:row.macAddress||"",uptime:row.uptime||"",bytesIn:Number(row.bytesIn||0),bytesOut:Number(row.bytesOut||0),profile:row.profile||""}))});
 }catch(e){return errorResponse(res,e);}
}
async function voucherSales(req,res){
 try{
  const salesCte="WITH sales AS (SELECT t.id AS transaction_id,t.channel,t.trx_id,t.sender_phone,t.amount,t.status,t.matched_username,t.created_at FROM transactions t WHERE t.status='processed' AND (EXISTS (SELECT 1 FROM hotspot_voucher_payments hp WHERE hp.transaction_id=t.id) OR EXISTS (SELECT 1 FROM hotspot_vouchers v WHERE v.transaction_id=t.id)) UNION SELECT a.transaction_id,a.channel,a.trx_id,a.sender_phone,a.amount,a.status,a.matched_username,a.created_at FROM hotspot_voucher_sales_archive a WHERE a.status='processed')";
  const [summary,rows]=await Promise.all([
   db.query(salesCte+" SELECT COUNT(*)::int AS count,COALESCE(SUM(amount),0)::numeric(12,2) AS total_amount FROM sales"),
   db.query(salesCte+" SELECT channel,trx_id,sender_phone,amount,status,matched_username,created_at FROM sales ORDER BY created_at DESC,transaction_id DESC LIMIT 500")
  ]);
  const s=summary.rows?.[0]||{};
  return res.json({success:true,count:Number(s.count||0),totalAmount:Number(s.total_amount||0),transactions:(rows.rows||[]).map(t=>({...t,amount:Number(t.amount||0)}))});
 }catch(e){return errorResponse(res,e);}
}
async function kick(req,res){try{const username=clean(req.body.username,100),id=clean(req.body.id,100);if(!username&&!id)return res.status(400).json({success:false,error:"Username or session id is required."});const result=await mikrotikService.kickActiveHotspotUser(username,id);res.json({success:true,...result});}catch(e){return errorResponse(res,e);}}
async function updateUser(req,res){try{const rawUsername=clean(req.body.username,100),username=normalizeHotspotMac(rawUsername),profile=clean(req.body.profile,100),comment=clean(req.body.comment,500);if(!rawUsername)return res.status(400).json({success:false,message:"Username is required."});if(!username)return res.status(400).json({success:false,code:"MAC_REQUIRED",message:"Hotspot credentials are MAC-based; username must be a normalized device MAC address."});if(!profile)return res.status(400).json({success:false,message:"Profile is required."});const result=await mikrotikService.updateHotspotUser(username,profile,comment,username,username);hotspotListCache.expiresAt=0;return res.json({success:true,message:"Hotspot user updated on MikroTik; username and password are the device MAC.",...result});}catch(e){return errorResponse(res,e);}}
async function deleteHotspotUser({ username: usernameValue, database = db, router = mikrotikService, logger = console } = {}) {
 const requestedUsername=clean(usernameValue,100);
 if(!requestedUsername)throw hotspotError("HOTSPOT_USERNAME_REQUIRED",400,"Username is required.");
 const identityResult=await database.query("SELECT id,username,mac_address FROM hotspot_vouchers WHERE LOWER(username)=LOWER($1) OR LOWER(mac_address)=LOWER($1) ORDER BY id DESC LIMIT 1",[requestedUsername]);
 const identity=identityResult.rows?.[0]||null;
 const username=clean(identity?.username||requestedUsername,100);
 const macAddress=normalizeHotspotMac(identity?.mac_address||requestedUsername);
 let purge;
 try {
  purge=await router.cleanupExpiredHotspotUser(username,macAddress);
  if(purge?.alreadyAbsent)logger.info("[Hotspot delete] RouterOS user already absent; finishing PostgreSQL deletion for "+username);
 } catch(error) {
  logger.error("[Hotspot delete] MikroTik hard purge failed; PostgreSQL record retained for retry for "+username+":",error?.message||error);
  throw hotspotError("HOTSPOT_ROUTER_PURGE_FAILED",502,"MikroTik cleanup failed; the database record was retained so cleanup can be retried.");
 }
 const deletion=await database.query("DELETE FROM hotspot_vouchers WHERE LOWER(username)=LOWER($1)",[username]);
 return {username,macAddress,deleted:true,deletedRows:deletion.rowCount??null,purge:purge||null};
}
async function remove(req,res){try{const result=await deleteHotspotUser({username:req.body?.username});hotspotListCache.expiresAt=0;return res.json({success:true,...result});}catch(e){return errorResponse(res,e);}}

async function manualRenew(req,res){
 const body=req.body&&typeof req.body==="object"?req.body:{},requestedId=clean(body.id,100),requestedMac=normalizeHotspotMac(body.mac||body.mac_address||""),username=clean(body.username||requestedMac||requestedId,100),requestedProfile=clean(body.profile_id||body.profileId||body.profile||"",100),notify=body.send_notification!==false&&body.notify!==false;
 if(!username||!requestedProfile)return res.status(400).json({success:false,message:"Username and package profile are required."});
 try{
  const renewed=await db.withTransaction(async client=>{
   await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-renew:"+username.toLowerCase()]);
   const found=await client.query("SELECT * FROM hotspot_vouchers WHERE ($1<>'' AND id::text=$1) OR LOWER(username)=LOWER($2) OR ($3<>'' AND LOWER(mac_address)=LOWER($3)) ORDER BY id DESC LIMIT 1 FOR UPDATE",[requestedId,username,requestedMac]),voucher=found.rows?.[0];
   if(!voucher)throw hotspotError("HOTSPOT_VOUCHER_NOT_FOUND",404,"The Hotspot voucher was not found in PostgreSQL.");
   const [routerProfiles,meta]=await Promise.all([mikrotikService.getHotspotProfiles(),readProfileMetadata()]);
   let candidates=(Array.isArray(routerProfiles)?routerProfiles:[]).filter(item=>profileIdentifierMatches(item.name,meta[String(item.name||"")]||{},requestedProfile));
   if(!candidates.length)candidates=Object.entries(meta).filter(([name,details])=>profileIdentifierMatches(name,details,requestedProfile)).map(([name,details])=>({name,sessionTimeout:details?.validityValue&&details?.validityUnit?normalizeProfileValidity(details.validityValue,details.validityUnit).validity:"",sharedUsers:1,raw:{}}));
   if(candidates.length!==1)throw hotspotError("HOTSPOT_PROFILE_INVALID",400,"Selected package could not be mapped to exactly one RouterOS profile.");
   const selected=candidates[0],profile=String(selected.name||"").trim(),pm=meta[profile]||{},parsed=pm.validityValue?normalizeProfileValidity(pm.validityValue,pm.validityUnit):parseStoredValidity(selected),validity=String(parsed.validity||"").trim(),quota=Number(pm.limitBytesTotal||parsed.limitBytesTotal||0),duration=validityMs(validity);
   if(!duration&&!quota)throw hotspotError("HOTSPOT_PROFILE_DURATION_INVALID",400,"Selected package has no supported time validity or data quota.");
   const now=new Date(),oldExpiry=voucher.expires_at?new Date(voucher.expires_at):null,base=oldExpiry&&Number.isFinite(oldExpiry.getTime())&&oldExpiry>now?oldExpiry:now,expiry=duration?new Date(base.getTime()+duration):null;
   const stamp=d=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day+" "+p.hour+":"+p.minute+":"+p.second;};
   const comment=expiry?"Exp: "+stamp(expiry):"FAZ|DATA_ONLY",phone=normalizeHotspotPhone(voucher.phone||voucher.password||""),mac=normalizeHotspotMac(voucher.mac_address)||normalizeHotspotMac(voucher.username)||"";if(!mac)throw hotspotError("HOTSPOT_MAC_REQUIRED",409,"MAC-based Hotspot renewal requires a bound device MAC. Bind the device before renewing.");
   if(!/^01\d{9}$/.test(phone))throw hotspotError("HOTSPOT_PHONE_INVALID",400,"Voucher has no valid customer phone number.");
   await mikrotikService.rechargeHotspotUser({username:mac,password:mac,profile,validity,limitBytesTotal:quota,expiryDate:expiry?stamp(expiry).slice(0,10):"",comment,macAddress:mac,previousUsername:voucher.username!==mac?voucher.username:"",server:voucher.server||"all"});
   const saved=await client.query("UPDATE hotspot_vouchers SET username=$10,profile=$2,validity=$3,price=$4,status='active',password=$10,phone=$5,mac_address=$10,customer_name=COALESCE(NULLIF($6,''),customer_name),comment=$7,expires_at=$8,renewal_stacked=$9,first_login_at=COALESCE(first_login_at,NOW()),pre_expiry_notified=false,updated_at=NOW() WHERE id=$1 RETURNING id,username,profile,validity,price,status,phone,customer_name,mac_address,expires_at,comment,transaction_id",[voucher.id,profile,validity,Number(pm.price??voucher.price??0),phone,clean(body.customer_name||voucher.customer_name,160),comment,expiry,Boolean(oldExpiry&&oldExpiry>now),mac]);
   if(!saved.rows?.length)throw new Error("RouterOS was renewed but PostgreSQL could not finalize the voucher.");
   return {voucher:saved.rows[0],expiryLabel:expiry?stamp(expiry):null,packageName:pm.packageName||pm.package_name||profile,phone};
  });
  hotspotListCache.expiresAt=0;
  if(notify&&renewed.phone&&renewed.phone!=="Unlinked"){
   const customerLabel=String(renewed.voucher.customer_name||"গ্রাহক").trim()||"গ্রাহক";
   const newExpiryStr=renewed.expiryLabel||"Data quota";
   notificationDispatcher.dispatchNotification({userType:"hotspot",event:"hotspot_renewal",to:renewed.phone,recipient:renewed.phone,phone:renewed.phone,username:renewed.voucher.username,customer:{username:renewed.voucher.username,name:customerLabel,phone:renewed.phone,profile:renewed.voucher.profile},customerName:customerLabel,message:`আসসালামু আলাইকুম ${customerLabel}, আপনার হটস্পট প্যাকেজটি সফলভাবে রিনিউ করা হয়েছে।\nপ্যাকেজ: ${renewed.packageName}\nনতুন মেয়াদ: ${newExpiryStr} পর্যন্ত।\nধন্যবাদ, FAZ NETWORK।`,useMessageDirectly:true,variables:{name:customerLabel,username:renewed.voucher.username,package:renewed.packageName,profile:renewed.voucher.profile,expiry_date:newExpiryStr},channels:["sms","whatsapp"]});
  }
  return res.json({success:true,message:"Hotspot package renewed; RouterOS credentials remain MAC-based.",voucher:renewed.voucher,expiry:renewed.expiryLabel,new_expiry:renewed.expiryLabel});
 }catch(e){return errorResponse(res,e);}
}

module.exports={page,servers,profiles,previewProfileScript,createProfile,updateProfile,deleteProfile,syncProfiles,list,active,disconnectActive,generate,createUser,manualRenew,dashboardMetrics,voucherStats,voucherRecords,voucherSales,kick,remove,updateUser,deleteHotspotUser,importFromMikrotik,pushToMikrotik,invalidateListCache:()=>{hotspotListCache.expiresAt=0;},refreshHotspotListCache};