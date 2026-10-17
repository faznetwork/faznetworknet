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
function normalizeFilter(value){const filter=String(value||"all").trim().toLowerCase();return ["all","active"].includes(filter)?filter:"all";}
function validityMs(value){const m=String(value||"").trim().match(/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/i);if(!m)return 0;const n=Number(m[1]),u=m[2].toLowerCase();const unit=u.startsWith("m")?60000:u.startsWith("h")?3600000:u.startsWith("w")?604800000:86400000;return n*unit;}
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
  return res.json({success:true,scriptVersion:"FAZ_HOTSPOT_EXPIRY_V3",onLogin});
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
 hotspotListRefresh=(async()=>{const [routerRows,sessionRows,ledger]=await Promise.all([mikrotikService.getHotspotUsers(),mikrotikService.getActiveHotspotSessions(),db.query("SELECT id,username,status,comment,expires_at,first_login_at,validity,customer_name,phone,mac_address,server,transaction_id,profile,price,mac_lock FROM hotspot_vouchers ORDER BY id DESC").catch(()=>({rows:[]}))]);const byName=new Map();for(const r of ledger.rows||[]){const k=String(r.username||"").trim().toLowerCase();if(k&&!byName.has(k))byName.set(k,r);}const users=(Array.isArray(routerRows)?routerRows:[]).filter(u=>String(u?.username||"").trim()&&String(u.username).toLowerCase()!=="default-trial").map(u=>{const d=byName.get(String(u.username).toLowerCase())||{};return {id:u.id,voucherId:d.id||null,macLock:d.mac_lock!==false,username:u.username,name:d.customer_name||"",customer_name:d.customer_name||"",phone:d.phone||"",macAddress:d.mac_address||"",transaction_id:d.transaction_id||null,price:Number(d.price||0),profile:u.profile||d.profile||"",uptime:u.uptime||"",limitUptime:u.limitUptime||"",bytesIn:Number(u.bytesIn||0),bytesOut:Number(u.bytesOut||0),comment:u.comment||d.comment||"",disabled:Boolean(u.disabled),status:d.status||"",expires_at:d.expires_at||null,first_login_at:d.first_login_at||null,validity:d.validity||"",server:d.server||"all"};});const activeUsers=(Array.isArray(sessionRows)?sessionRows:[]).filter(s=>String(s.username||"").toLowerCase()!=="default-trial").map(s=>({user:s.username,username:s.username,address:s.address||"",macAddress:s.macAddress||"",uptime:s.uptime||"",sessionTimeLeft:s.sessionTimeLeft||"",bytesIn:Number(s.bytesIn||0),bytesOut:Number(s.bytesOut||0),server:s.server||"",profile:s.profile||""}));hotspotListCache={expiresAt:Date.now()+8000,users,activeUsers};return hotspotListCache;})().finally(()=>{hotspotListRefresh=null;});return hotspotListRefresh;
}
async function list(req,res){try{if(hotspotListCache.users&&hotspotListCache.expiresAt>Date.now()){const c=hotspotListCache;res.json({success:true,filter:"all",count:c.users.length,users:c.users,activeUsers:c.activeUsers,cached:true});refreshHotspotListCache().catch(e=>console.warn("[Hotspot API] Background refresh failed:",e.message));return;}const c=await refreshHotspotListCache();return res.json({success:true,filter:"all",count:c.users.length,users:c.users,activeUsers:c.activeUsers,cached:false});}catch(e){return errorResponse(res,e);}}
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
 const body=req.body||{};
 const quantity=Number(body.quantity);
 const profile=clean(body.profile,100);
 let validity=clean(body.validity,50);
 const price=Number(body.price);
 const userPrefix=clean(body.userPrefix||"FAZ-",20).replace(/[^A-Za-z0-9_-]/g,"")||"FAZ-";
 const charLength=Number(body.charLength||6);
 if(!Number.isSafeInteger(quantity)||quantity<1||quantity>500)
   return res.status(400).json({success:false,error:"Quantity must be a whole number between 1 and 500."});
 if(!profile||!validity||!Number.isFinite(price)||price<0)
   return res.status(400).json({success:false,error:"Profile, validity, and a non-negative price are required."});
 if(!Number.isSafeInteger(charLength)||charLength<4||charLength>16)
   return res.status(400).json({success:false,error:"Character length must be a whole number between 4 and 16."});
 if(!/^(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/i.test(validity))
   return res.status(400).json({success:false,error:"Validity must use a supported duration such as 30m, 2h, 1d, or 1w."});
 const provisioned=[];
 const persisted=[];
 const created=[];
 try {
   // Validate the target profile and snapshot existing RouterOS names once per batch.
   const [profiles,routerUsers]=await Promise.all([
     mikrotikService.getHotspotProfiles(),
     mikrotikService.getHotspotUsers()
   ]);
   const routerProfile=(Array.isArray(profiles)?profiles:[]).find(p=>String(p.name||"").toLowerCase()===profile.toLowerCase());
   if(!routerProfile)return res.status(400).json({success:false,error:"The selected Hotspot profile does not exist on MikroTik."});
   const profileMeta=(await readProfileMetadata())[profile]||{};
   const profileValidity=profileMeta.validityValue
     ? normalizeProfileValidity(profileMeta.validityValue,profileMeta.validityUnit)
     : parseStoredValidity(routerProfile);
   if(!profileValidity.validity)return res.status(400).json({success:false,error:"The selected profile has no time-based calendar validity. Configure a minutes, hours, or days profile before generating vouchers."});
   if(validityMs(profileValidity.validity)!==validityMs(validity))return res.status(400).json({success:false,error:"Voucher validity must match the selected profile's calendar validity ("+profileValidity.validity+"). Select the matching validity or update the profile."});
   validity=profileValidity.validity;
   await ensureCalendarProfile(profile,routerProfile,profileValidity);
   const routerNames=new Set((Array.isArray(routerUsers)?routerUsers:[]).map(u=>String(u.username||"").trim().toLowerCase()).filter(Boolean));
   const reservedNames=new Set();
   const candidates=[];
   // Reserve the complete batch before provisioning so intra-batch collisions cannot occur.
   for(let i=0;i<quantity;i++){
     let username="",password="",unique=false;
     for(let attempt=0;attempt<50&&!unique;attempt++){
       username=userPrefix+randomPin(charLength);
       const key=username.toLowerCase();
       if(routerNames.has(key)||reservedNames.has(key)) continue;
       const exists=await db.query("SELECT 1 FROM hotspot_vouchers WHERE LOWER(username)=LOWER($1) LIMIT 1",[username]);
       if(!exists.rows.length){unique=true;reservedNames.add(key);password=randomPin(charLength);}
     }
     if(!unique) throw new Error("Could not reserve enough unique voucher usernames. No voucher was provisioned; try a longer prefix or character length.");
     candidates.push({username,password});
   }
   for(const candidate of candidates){
     const managedComment=hotspotExpiryComment(validity);
     await mikrotikService.createHotspotUser({username:candidate.username,password:candidate.password,profile,validity,comment:managedComment});
     provisioned.push(candidate.username);
     await db.query("INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment) VALUES($1,$2,$3,$4,$5,'unused',$6)",
       [candidate.username,candidate.password,profile,validity,price,managedComment]);
     persisted.push(candidate.username);
     created.push({...candidate,profile,validity,price,status:"unused",expiresAt:null});
   }
   return res.json({success:true,count:created.length,vouchers:created});
 } catch(e) {
   // RouterOS and PostgreSQL cannot share a transaction; compensate all completed steps and retain DB history.
   const cleanupErrors=[];
   for(const username of provisioned.slice().reverse()){
     let removed=false;
     try { await mikrotikService.removeHotspotUser(username); removed=true; }
     catch(cleanupError){ cleanupErrors.push({username,error:cleanupError.message||"RouterOS cleanup failed"}); }
     try {
       if(persisted.some(saved=>saved.toLowerCase()===username.toLowerCase())) await db.query(
         "UPDATE hotspot_vouchers SET status='expired',expired_at=COALESCE(expired_at,NOW()),cleanup_status=$2,cleanup_error=$3,router_removed_at=CASE WHEN $2='completed' THEN COALESCE(router_removed_at,NOW()) ELSE router_removed_at END,updated_at=NOW() WHERE LOWER(username)=LOWER($1)",
         [username,removed?"completed":"failed",removed?null:(cleanupErrors.find(x=>x.username===username)?.error||"RouterOS cleanup failed")]
       );
     } catch(historyError) {
       console.error("[Hotspot Voucher Generator] Failed to record compensation state for",username,historyError.message);
     }
   }
   console.error("[Hotspot Voucher Generator] Batch failed; compensation attempted.",e);
   return res.status(502).json({
     success:false,
     error:e?.message||"Voucher batch generation failed.",
     partialBatch:created.length,
     cleanupPending:cleanupErrors.length,
     cleanupErrors
   });
 }
}
async function createUser(req,res){
  let savedId=null,preassigned=false,routerProvisioned=false;
  try{
    const body=req.body&&typeof req.body==="object"?req.body:{};
    const phone=normalizeHotspotPhone(body.phone||body.customer_phone||"");
    const requestedProfile=clean(body.profile_id||body.profileId||body.profile||"",100);
    const server=clean(body.server||"all",100)||"all";
    const activationType=String(body.activation_type||body.activationType||"first_login").toLowerCase();
    preassigned=["preassigned","pre_assigned","instant","instant_mac_bind"].includes(activationType);
    const rawMac=String(body.mac||body.mac_address||"").trim();
    const mac=rawMac?normalizeHotspotMac(rawMac):"";
    const customRaw=String(body.expires_at||body.custom_expiry||"").trim();
    const customExpiry=customRaw?new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(customRaw)?customRaw+":00+06:00":customRaw):null;
    const password=clean(body.password,160);
    const customerName=clean(body.customer_name||body.name,200),note=clean(body.note||body.address,1000);
    if(!/^01\d{9}$/.test(phone))return res.status(400).json({success:false,code:"INVALID_ACCOUNT_PHONE",message:"Enter a valid 11-digit Bangladeshi phone number (01XXXXXXXXX)."});
    if(!requestedProfile)return res.status(400).json({success:false,code:"PROFILE_REQUIRED",message:"Select a Hotspot package/profile."});
    if(preassigned&&!mac)return res.status(400).json({success:false,code:"MAC_REQUIRED",message:"Device MAC is required for Pre-Assigned activation."});
    if(rawMac&&!mac)return res.status(400).json({success:false,code:"INVALID_MAC",message:"Enter a valid MAC address (AA:BB:CC:DD:EE:FF)."});
    if(customRaw&&(!customExpiry||Number.isNaN(customExpiry.getTime())||customExpiry.getTime()<=Date.now()))return res.status(400).json({success:false,code:"INVALID_EXPIRY",message:"Custom expiry must be a valid future date and time."});
    const [routerProfiles,meta]=await Promise.all([mikrotikService.getHotspotProfiles().catch(()=>[]),readProfileMetadata()]);
    let candidates=(Array.isArray(routerProfiles)?routerProfiles:[]).filter(item=>profileIdentifierMatches(item.name,meta[String(item.name||"")]||{},requestedProfile));
    if(!candidates.length)candidates=Object.entries(meta).filter(([name,details])=>profileIdentifierMatches(name,details,requestedProfile)).map(([name,details])=>({name,sessionTimeout:details?.validityValue&&details?.validityUnit?normalizeProfileValidity(details.validityValue,details.validityUnit).validity:"",sharedUsers:1,raw:{}}));
    if(candidates.length!==1)return res.status(400).json({success:false,code:"PROFILE_NOT_FOUND_OR_AMBIGUOUS",message:"The selected package/profile could not be mapped to exactly one saved Hotspot profile."});
    const profileRow=candidates[0],profile=String(profileRow.name||"").trim(),profileMeta=meta[profile]||{};
    const profileValidity=profileMeta.validityValue?normalizeProfileValidity(profileMeta.validityValue,profileMeta.validityUnit):parseStoredValidity(profileRow);
    const validity=String(profileValidity.validity||"").trim(),quota=Number(profileMeta.limitBytesTotal||profileValidity.limitBytesTotal||0);
    if(!validity&&!quota&&!customExpiry)return res.status(400).json({success:false,code:"PROFILE_INVALID",message:"Configure a time validity or data quota for this package before creating an account."});
    const durationMatch=validity.match(/^(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|week|weeks)$/i);
    const durationMs=durationMatch?Number(durationMatch[1])*(durationMatch[2].toLowerCase().startsWith("s")?1000:durationMatch[2].toLowerCase().startsWith("m")?60000:durationMatch[2].toLowerCase().startsWith("h")?3600000:durationMatch[2].toLowerCase().startsWith("w")?604800000:86400000):0;
    const expiresAt=preassigned?(customExpiry|| (durationMs?new Date(Date.now()+durationMs):null)):null;
    const dhakaStamp=date=>{const p=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(date).reduce((o,x)=>(o[x.type]=x.value,o),{});return p.year+"-"+p.month+"-"+p.day+" "+p.hour+":"+p.minute+":"+p.second;};
    const comment=preassigned?(expiresAt?"Exp: "+dhakaStamp(expiresAt):(quota?"FAZ|DATA_ONLY":"")):"FAZ|PENDING|PROFILE="+profile;
    const priceResult=await db.query("SELECT price FROM hotspot_vouchers WHERE LOWER(profile)=LOWER($1) AND price IS NOT NULL ORDER BY created_at DESC,id DESC LIMIT 1",[profile]).catch(()=>({rows:[]}));
    const price=Number(profileMeta.price??priceResult.rows?.[0]?.price??0),username=clean(preassigned?mac:"PENDING-"+phone,160),accountPassword=clean(password||phone,160);
    const stored=await db.withTransaction(async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-phone:"+phone]);
      if(preassigned)await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-mac:"+mac]);
      const existing=await client.query("SELECT * FROM hotspot_vouchers WHERE REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($1,'880'||SUBSTRING($1 FROM 2)) ORDER BY id DESC FOR UPDATE",[phone]);
      const rows=existing.rows||[];
      if(rows.some(row=>["pending_claim","unused","active"].includes(String(row.status||"").toLowerCase())&&(!row.expires_at||new Date(row.expires_at).getTime()>Date.now())))throw hotspotError("ACTIVE_PACKAGE_EXISTS",409,"This phone already has a pending or active Hotspot package.");
      if(preassigned){const bound=await client.query("SELECT phone FROM hotspot_vouchers WHERE LOWER(COALESCE(mac_address,''))=LOWER($1) OR LOWER(username)=LOWER($1) ORDER BY id DESC FOR UPDATE",[mac]);if((bound.rows||[]).some(row=>normalizeHotspotPhone(row.phone)!==phone))throw hotspotError("MAC_ALREADY_BOUND",409,"This MAC address is already bound to another phone.");}
      const profileId=String(profileMeta.id||profileMeta.profileId||profileMeta.profile_id||profileMeta.packageId||profileMeta.package_id||profileMeta.packageName||profileMeta.package_name||profileMeta.alias||requestedProfile);
      const status=preassigned?"active":"unused",firstLoginAt=preassigned?new Date():null;
      const params=[username,accountPassword,profile,validity,price,comment,phone,server,validity||null,quota?String(quota):null,profileId,preassigned?mac:null,customerName,note,status,firstLoginAt,expiresAt,Boolean(preassigned)];
      const result=await client.query("INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment,phone,server,time_limit,data_limit,profile_id,mac_address,customer_name,note,cleanup_status,first_login_at,expires_at,mac_lock) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'not_required',$16,$17,$18) RETURNING id,username,profile,profile_id,phone,status,mac_address,customer_name,note,expires_at",params);
      if(!result.rows?.length)throw new Error("Hotspot account could not be saved.");
      return result.rows[0];
    });
    savedId=stored.id;
    if(preassigned){
      await mikrotikService.rechargeHotspotUser({username:mac,password:accountPassword,profile,validity,limitBytesTotal:quota,comment,server,macAddress:mac});
      routerProvisioned=true;
    }
    hotspotListCache.expiresAt=0;
    return res.status(201).json({success:true,pending_activation:!preassigned,instant_provisioned:preassigned,message:preassigned?"Pre-assigned Hotspot user created and provisioned immediately.":"First-login Hotspot account saved. No RouterOS user or expiry countdown is created until captive-portal activation.",user:{id:stored.id,username:stored.username,phone,profile:stored.profile,profile_id:stored.profile_id,status:stored.status,mac_address:stored.mac_address||null,expires_at:stored.expires_at||null}});
  }catch(e){
    if(savedId&&preassigned&&!routerProvisioned)await db.query("UPDATE hotspot_vouchers SET status='unused',username='PENDING-'||REGEXP_REPLACE(phone,'[^0-9]','','g'),mac_address=NULL,mac_lock=false,first_login_at=NULL,expires_at=NULL,comment='FAZ|PENDING|PROVISION_FAILED',updated_at=NOW() WHERE id=$1",[savedId]).catch(()=>{});
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
  const allowed=new Set(["all","unused","active","expired","cleanup"]);
  const filter=String(req.query.status||"all").trim().toLowerCase();
  if(!allowed.has(filter))return res.status(400).json({success:false,message:"Invalid voucher status filter."});
  const params=[];let where="";
  if(filter==="unused"||filter==="active"||filter==="expired"){params.push(filter);where="WHERE status=$1";}
  else if(filter==="cleanup"){where="WHERE status='expired' AND cleanup_status IN ('pending','failed')";}
  const result=await db.query(
   "SELECT id,username,password,profile,validity,price,status,phone,server,time_limit,data_limit,first_login_at,expires_at,expired_at,cleanup_status,cleanup_attempts,cleanup_error,router_removed_at,created_at,updated_at FROM hotspot_vouchers "+where+" ORDER BY created_at DESC,id DESC LIMIT 500",
   params
  );
  const rows=result.rows||[];
  return res.json({success:true,filter,count:rows.length,vouchers:rows.map(v=>({...v,price:Number(v.price||0)}))});
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
async function updateUser(req,res){try{const username=clean(req.body.username,100),profile=clean(req.body.profile,100),comment=clean(req.body.comment,500),password=String(req.body.password??"").slice(0,128);if(!username)return res.status(400).json({success:false,message:"Username is required."});if(!profile)return res.status(400).json({success:false,message:"Profile is required."});const result=await mikrotikService.updateHotspotUser(username,profile,comment,password);hotspotListCache.expiresAt=0;return res.json({success:true,message:"Hotspot user updated on MikroTik.",...result});}catch(e){return errorResponse(res,e);}}
async function remove(req,res){try{const username=clean(req.body.username,100);if(!username)return res.status(400).json({success:false,message:"Username is required."});await mikrotikService.cleanupExpiredHotspotUser(username);await db.query("DELETE FROM hotspot_vouchers WHERE LOWER(username)=LOWER($1)",[username]);hotspotListCache.expiresAt=0;return res.json({success:true,username,deleted:true});}catch(e){return errorResponse(res,e);}}

async function manualRenew(req,res){
 const body=req.body&&typeof req.body==="object"?req.body:{},username=clean(body.username,100),requestedProfile=clean(body.profile_id||body.profileId||body.profile||"",100),notify=body.notify!==false;
 if(!username||!requestedProfile)return res.status(400).json({success:false,message:"Username and package profile are required."});
 try{
  const renewed=await db.withTransaction(async client=>{
   await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-renew:"+username.toLowerCase()]);
   const found=await client.query("SELECT * FROM hotspot_vouchers WHERE LOWER(username)=LOWER($1) ORDER BY id DESC LIMIT 1 FOR UPDATE",[username]),voucher=found.rows?.[0];
   if(!voucher)throw hotspotError("HOTSPOT_VOUCHER_NOT_FOUND",404,"The Hotspot voucher was not found in PostgreSQL.");
   const [routerProfiles,meta]=await Promise.all([mikrotikService.getHotspotProfiles(),readProfileMetadata()]);
   let candidates=(Array.isArray(routerProfiles)?routerProfiles:[]).filter(item=>profileIdentifierMatches(item.name,meta[String(item.name||"")]||{},requestedProfile));
   if(!candidates.length)candidates=Object.entries(meta).filter(([name,details])=>profileIdentifierMatches(name,details,requestedProfile)).map(([name,details])=>({name,sessionTimeout:details?.validityValue&&details?.validityUnit?normalizeProfileValidity(details.validityValue,details.validityUnit).validity:"",sharedUsers:1,raw:{}}));
   if(candidates.length!==1)throw hotspotError("HOTSPOT_PROFILE_INVALID",400,"Selected package could not be mapped to exactly one RouterOS profile.");
   const selected=candidates[0],profile=String(selected.name||"").trim(),pm=meta[profile]||{},parsed=pm.validityValue?normalizeProfileValidity(pm.validityValue,pm.validityUnit):parseStoredValidity(selected),validity=String(parsed.validity||"").trim(),quota=Number(pm.limitBytesTotal||parsed.limitBytesTotal||0),duration=validityMs(validity);
   if(!duration&&!quota)throw hotspotError("HOTSPOT_PROFILE_DURATION_INVALID",400,"Selected package has no supported time validity or data quota.");
   const now=new Date(),oldExpiry=voucher.expires_at?new Date(voucher.expires_at):null,base=oldExpiry&&Number.isFinite(oldExpiry.getTime())&&oldExpiry>now?oldExpiry:now,expiry=duration?new Date(base.getTime()+duration):null;
   const stamp=d=>{const p=Object.fromEntries(new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(d).map(x=>[x.type,x.value]));return p.year+"-"+p.month+"-"+p.day+" "+p.hour+":"+p.minute+":"+p.second;};
   const comment=expiry?"Exp: "+stamp(expiry):"FAZ|DATA_ONLY",phone=normalizeHotspotPhone(voucher.phone||voucher.password||""),mac=normalizeHotspotMac(voucher.mac_address)||normalizeHotspotMac(voucher.username)||"";
   if(!/^01\d{9}$/.test(phone))throw hotspotError("HOTSPOT_PHONE_INVALID",400,"Voucher has no valid customer phone number.");
   await mikrotikService.rechargeHotspotUser({username:voucher.username,password:phone,profile,validity,limitBytesTotal:quota,expiryDate:expiry?stamp(expiry).slice(0,10):"",comment,macAddress:mac,server:voucher.server||"all"});
   const saved=await client.query("UPDATE hotspot_vouchers SET profile=$2,validity=$3,price=$4,status='active',password=$5,phone=$6,customer_name=COALESCE(NULLIF($7,''),customer_name),comment=$8,expires_at=$9,renewal_stacked=$10,first_login_at=COALESCE(first_login_at,NOW()),updated_at=NOW() WHERE id=$1 RETURNING id,username,profile,validity,price,status,phone,customer_name,mac_address,expires_at,comment,transaction_id",[voucher.id,profile,validity,Number(pm.price??voucher.price??0),phone,phone,clean(body.customer_name||voucher.customer_name,160),comment,expiry,Boolean(oldExpiry&&oldExpiry>now)]);
   if(!saved.rows?.length)throw new Error("RouterOS was renewed but PostgreSQL could not finalize the voucher.");
   return {voucher:saved.rows[0],expiryLabel:expiry?stamp(expiry):null,packageName:pm.packageName||pm.package_name||profile,phone};
  });
  hotspotListCache.expiresAt=0;
  if(notify)notificationDispatcher.dispatchNotification({userType:"hotspot",event:"hotspot_renewal",to:renewed.phone,phone:renewed.phone,username:renewed.voucher.username,customer:{username:renewed.voucher.username,name:renewed.voucher.customer_name||renewed.voucher.username,phone:renewed.phone,profile:renewed.voucher.profile},variables:{package:renewed.packageName,profile:renewed.voucher.profile,expiry_date:renewed.expiryLabel||"Data quota"},channels:["sms","whatsapp"]});
  return res.json({success:true,message:"Hotspot package renewed and RouterOS expiry scheduler refreshed.",voucher:renewed.voucher,expiry:renewed.expiryLabel});
 }catch(e){return errorResponse(res,e);}
}

module.exports={page,servers,profiles,previewProfileScript,createProfile,updateProfile,deleteProfile,syncProfiles,list,active,disconnectActive,generate,createUser,manualRenew,dashboardMetrics,voucherStats,voucherRecords,voucherSales,kick,remove,updateUser};