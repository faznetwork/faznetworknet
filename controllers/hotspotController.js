const crypto=require("crypto");const db=require("../db");const mikrotikService=require("../services/mikrotikService");const {normalizeProfileValidity,parseStoredValidity,buildHotspotOnLoginScript}=require("../services/hotspotProfileConfig");
function clean(v,max=255){return String(v??"").trim().slice(0,max)}
function errorResponse(res,e){console.error("[Hotspot API]",e);const message=e?.message||"Hotspot operation failed.";return res.status(e?.statusCode||503).json({success:false,users:[],profiles:[],message,error:message});}
function randomPin(length=8){return crypto.randomBytes(Math.ceil(length*1.5)).toString("base64url").replace(/[^A-Za-z0-9]/g,"").slice(0,length).toUpperCase();}
function normalizeFilter(value){const filter=String(value||"all").trim().toLowerCase();return ["all","active"].includes(filter)?filter:"all";}
function validityMs(value){const m=String(value||"").trim().match(/^(\\d+(?:\\.\\d+)?)\\s*(m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks)$/i);if(!m)return 0;const n=Number(m[1]),u=m[2].toLowerCase();const unit=u.startsWith("m")?60000:u.startsWith("h")?3600000:u.startsWith("w")?604800000:86400000;return n*unit;}
function voucherValidUntil(createdAt,validity){const ms=validityMs(validity);return ms?new Date(new Date(createdAt).getTime()+ms):null;}
async function page(req,res){res.render("hotspot",{title:"Hotspot Vouchers",page:"hotspot"});}
async function readProfileMetadata(){const r=await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");try{const v=JSON.parse(r.rows[0]?.value||"{}");return v&&typeof v==="object"&&!Array.isArray(v)?v:{};}catch(_){return {};}}
async function writeProfileMetadata(v){await db.query("INSERT INTO app_settings(key,value,updated_at) VALUES('hotspot_profile_metadata',$1,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[JSON.stringify(v)]);}
async function profiles(req,res){try{const [data,meta]=await Promise.all([mikrotikService.getHotspotProfiles(),readProfileMetadata()]);return res.json({success:true,profiles:data.map(p=>{const m=meta[p.name]||{};let v;try{v=m.validityValue?normalizeProfileValidity(m.validityValue,m.validityUnit):parseStoredValidity(p);}catch(_){v=parseStoredValidity(p);}return {...p,price:Number(m.price||0),validityValue:v.value,validityUnit:v.unit,validityLabel:m.validityLabel||v.validityLabel,limitBytesTotal:Number(m.limitBytesTotal||v.limitBytesTotal||0)};})});}catch(e){return errorResponse(res,e);}}
async function createProfile(req,res){try{
 const name=clean(req.body.name,100),rateLimit=clean(req.body.rateLimit,100),sharedUsers=Math.max(1,Number(req.body.sharedUsers)||1),price=Number(req.body.price||0),v=normalizeProfileValidity(req.body.validityValue,req.body.validityUnit);
 if(!name||name.toLowerCase()==="default")return res.status(400).json({success:false,message:"A custom profile name is required."});
 if(!rateLimit)return res.status(400).json({success:false,message:"Rate limit / speed is required."});
 if(!Number.isFinite(price)||price<0)return res.status(400).json({success:false,message:"Price must be zero or greater."});
 if(!Number.isSafeInteger(sharedUsers)||sharedUsers<1)return res.status(400).json({success:false,message:"Shared users must be a positive whole number."});
 const onLogin=buildHotspotOnLoginScript({name,sharedUsers,validityValue:v.value,validityUnit:v.unit});
 const result=await mikrotikService.createHotspotProfile({name,rateLimit,sharedUsers,sessionTimeout:v.validity,clearSessionTimeout:v.unit==="gb",keepaliveTimeout:"",onLogin});
 const meta=await readProfileMetadata();meta[name]={price,validityValue:v.value,validityUnit:v.unit,validityLabel:v.validityLabel,limitBytesTotal:v.limitBytesTotal,updatedAt:new Date().toISOString()};await writeProfileMetadata(meta);
 return res.json({success:true,message:"Hotspot profile created and metadata saved.",profile:{...result,rateLimit,sharedUsers,price,...v,onLogin}});
}catch(e){return errorResponse(res,e);}}
async function updateProfile(req,res){try{
 const name=clean(req.body.name,100),rateLimit=clean(req.body.rateLimit,100),sharedUsers=Math.max(1,Number(req.body.sharedUsers)||1),price=Number(req.body.price||0),v=normalizeProfileValidity(req.body.validityValue,req.body.validityUnit);
 if(!name||name.toLowerCase()==="default")return res.status(400).json({success:false,message:"A custom profile name is required."});
 if(!rateLimit)return res.status(400).json({success:false,message:"Rate limit / speed is required."});
 if(!Number.isFinite(price)||price<0)return res.status(400).json({success:false,message:"Price must be zero or greater."});
 const onLogin=buildHotspotOnLoginScript({name,sharedUsers,validityValue:v.value,validityUnit:v.unit});
 const result=await mikrotikService.updateHotspotProfile({name,rateLimit,sharedUsers,sessionTimeout:v.validity,clearSessionTimeout:v.unit==="gb",keepaliveTimeout:"",onLogin});
 const meta=await readProfileMetadata();meta[name]={price,validityValue:v.value,validityUnit:v.unit,validityLabel:v.validityLabel,limitBytesTotal:v.limitBytesTotal,updatedAt:new Date().toISOString()};await writeProfileMetadata(meta);
 return res.json({success:true,message:"Hotspot profile updated and metadata saved.",profile:{...result,rateLimit,sharedUsers,price,...v,onLogin}});
}catch(e){return errorResponse(res,e);}}
async function deleteProfile(req,res){try{const name=clean(req.body.name,100);if(!name||name.toLowerCase()==="default")return res.status(400).json({success:false,message:"The default profile cannot be deleted here."});const result=await mikrotikService.deleteHotspotProfile(name);const meta=await readProfileMetadata();delete meta[name];await writeProfileMetadata(meta);return res.json({success:true,message:"Hotspot profile deleted successfully from MikroTik.",profile:result});}catch(e){return errorResponse(res,e);}}
async function list(req,res){
 try{
  const rows=await mikrotikService.getHotspotUsers();
  const users=(Array.isArray(rows)?rows:[]).filter(user=>{
    const name=String(user?.username||"").trim().toLowerCase();
    return name&&name!=="default-trial";
  }).map(user=>({
    id:user.id,
    name:user.username,
    profile:user.profile||"",
    uptime:user.uptime||"",
    limitUptime:user.limitUptime||"",
    bytesIn:Number(user.bytesIn||0),
    bytesOut:Number(user.bytesOut||0),
    comment:user.comment||"",
    disabled:Boolean(user.disabled)
  }));
  return res.json({success:true,filter:"all",count:users.length,users});
 }catch(e){return errorResponse(res,e);}
}
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
async function generate(req,res){try{
 const quantity=Math.min(Math.max(Number(req.body.quantity)||0,1),500);
 const profile=clean(req.body.profile,100),validity=clean(req.body.validity,50),price=Number(req.body.price);
 const userPrefix=clean(req.body.userPrefix||"FAZ-",20).replace(/[^A-Za-z0-9_-]/g,"")||"FAZ-";
 const charLength=Math.min(Math.max(Number(req.body.charLength)||6,4),16);
 if(!profile||!validity||!Number.isFinite(price)||price<0)return res.status(400).json({success:false,error:"Profile, validity, and valid price are required."});
 const created=[];
 for(let i=0;i<quantity;i++){
   let username="",password="",unique=false;
   for(let attempt=0;attempt<30&&!unique;attempt++){
     username=userPrefix+randomPin(charLength); password=randomPin(charLength);
     const exists=await db.query("SELECT 1 FROM hotspot_vouchers WHERE username=$1",[username]);
     unique=!exists.rows.length;
   }
   if(!unique)throw new Error("Could not generate a unique voucher username. Please try again.");
   await mikrotikService.createHotspotUser({username,password,profile,comment:"Auto-Generated"});
   try{
     await db.query("INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment) VALUES($1,$2,$3,$4,$5,'unused',$6)",[username,password,profile,validity,price,"Auto-Generated"]);
   }catch(dbError){try{await mikrotikService.removeHotspotUser(username);}catch(_){ }throw dbError;}
   created.push({username,password,profile,validity,price,status:"unused"});
 }
 res.json({success:true,count:created.length,vouchers:created});
}catch(e){return errorResponse(res,e);}}
async function createUser(req,res){
  try{
    const username=clean(req.body.username,100);
    const profile=clean(req.body.profile,100);
    const password=clean(req.body.password,100)||username;
    const server=clean(req.body.server||"all",100)||"all";
    const timeLimit=clean(req.body.timeLimit,50);
    const dataLimit=clean(req.body.dataLimit,50);
    const comment=clean(req.body.comment,500);
    if(!username||!profile)return res.status(400).json({success:false,message:"Username / phone number and profile are required."});
    if(!/^[A-Za-z0-9._@+-]{2,100}$/.test(username))return res.status(400).json({success:false,message:"Username / phone number contains unsupported characters."});
    const existingDb=await db.query("SELECT 1 FROM hotspot_vouchers WHERE LOWER(username)=LOWER($1) LIMIT 1",[username]);
    if(existingDb.rows.length)return res.status(409).json({success:false,message:"Hotspot username already exists in database."});
    const mtUsers=await mikrotikService.getHotspotUsers();
    if(mtUsers.some(u=>String(u.username||"").toLowerCase()===username.toLowerCase()))return res.status(409).json({success:false,message:"Hotspot username already exists in MikroTik."});
    await mikrotikService.createHotspotUser({username,password,profile,server,"limit-uptime":timeLimit,"limit-bytes-total":dataLimit,comment});
    try{
      const profilePriceRows=await db.query("SELECT price FROM hotspot_vouchers WHERE LOWER(profile)=LOWER($1) AND price IS NOT NULL ORDER BY created_at DESC LIMIT 1",[profile]);
      const profilePrice=Number(profilePriceRows?.rows?.[0]?.price||0);
      await db.query("INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment,phone,server,time_limit,data_limit) VALUES($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10)",
        [username,password,profile,timeLimit||"custom",profilePrice,comment,username,server,timeLimit||null,dataLimit||null]);
    }catch(dbError){
      try{await mikrotikService.removeHotspotUser(username);}catch(_){}
      throw dbError;
    }
    return res.json({success:true,message:"Hotspot user created successfully in MikroTik & DB",user:{username,password,profile,server,timeLimit,dataLimit,phone:username,comment}});
  }catch(e){return errorResponse(res,e);}
}
async function dashboardMetrics(req,res){
  try{
    const [allUsers,activeSessions,voucherRows]=await Promise.all([
      mikrotikService.getHotspotUsers(),
      mikrotikService.getActiveHotspotSessions(),
      db.query("SELECT COUNT(*)::int AS count FROM hotspot_vouchers")
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
    const offlineUsers=Math.max(0,totalUsers-activeUsers);
    const voucherCommentCount=customerUsers.filter(user=>{
      const comment=String(user?.comment||"").toLowerCase();
      return comment.includes("voucher");
    }).length;
    const dbVoucherCount=Number(voucherRows?.rows?.[0]?.count||0);
    const totalVouchers=Math.max(voucherCommentCount,dbVoucherCount);
    return res.json({
      success:true,
      totalUsers,
      activeUsers,
      onlineClients:activeUsers,
      offlineUsers,
      totalVouchers,
      todayRevenue:"0.00"
    });
  }catch(e){return errorResponse(res,e);}
}
async function kick(req,res){try{const username=clean(req.body.username,100),id=clean(req.body.id,100);if(!username&&!id)return res.status(400).json({success:false,error:"Username or session id is required."});const result=await mikrotikService.kickActiveHotspotUser(username,id);res.json({success:true,...result});}catch(e){return errorResponse(res,e);}}
async function remove(req,res){try{
 const username=clean(req.body.username,100);if(!username)return res.status(400).json({success:false,error:"Username is required."});
 await mikrotikService.removeHotspotUser(username);
 await db.query("UPDATE hotspot_vouchers SET status='expired',expired_at=COALESCE(expired_at,NOW()),cleanup_status='completed',cleanup_error=NULL,router_removed_at=COALESCE(router_removed_at,NOW()),updated_at=NOW() WHERE username=$1",[username]);
 res.json({success:true,username});
}catch(e){return errorResponse(res,e);}}
module.exports={page,profiles,createProfile,updateProfile,deleteProfile,list,active,disconnectActive,generate,createUser,dashboardMetrics,kick,remove};