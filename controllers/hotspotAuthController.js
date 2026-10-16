"use strict";

const db=require("../db");
const mikrotikService=require("../services/mikrotikService");
const {normalizeProfileValidity,parseStoredValidity}=require("../services/hotspotProfileConfig");

const attempts=new Map();
function normalizePhone(value){
  const bangla="০১২৩৪৫৬৭৮৯";
  let digits=String(value??"").replace(/[০-৯]/g,ch=>String(bangla.indexOf(ch))).replace(/\D/g,"");
  if(digits.startsWith("880")&&digits.length===13)digits="0"+digits.slice(3);
  return digits;
}
function normalizeMac(value){
  const compact=String(value??"").trim().replace(/[:-]/g,"");
  return /^[0-9a-fA-F]{12}$/.test(compact)?compact.match(/.{2}/g).join(":").toUpperCase():"";
}
function durationMs(value){
  const source=String(value||"").trim().toLowerCase();
  const re=/(\d+(?:\.\d+)?)(w|d|h|m|s)/g;
  let match,consumed="",total=0;
  const factors={w:604800000,d:86400000,h:3600000,m:60000,s:1000};
  while((match=re.exec(source))){consumed+=match[0];total+=Number(match[1])*factors[match[2]];}
  return source&&consumed===source&&Number.isFinite(total)&&total>0?total:0;
}
function parseQuota(value){
  if(Number.isFinite(Number(value))&&Number(value)>0)return Math.floor(Number(value));
  const match=String(value||"").trim().match(/^(\d+(?:\.\d+)?)\s*(gb|gib)$/i);
  return match?Math.floor(Number(match[1])*1073741824):0;
}
function parseCommentExpiry(comment){
  const match=String(comment||"").match(/(?:^|[|;\s])EXP:\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?/i);
  if(!match)return null;
  const date=match[2]?new Date(match[1]+"T"+match[2]+"+06:00"):new Date(match[1]+"T23:59:59+06:00");
  return Number.isNaN(date.getTime())?null:date;
}
function dhakaTimestamp(value){
  const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(value);
  const field=type=>parts.find(part=>part.type===type)?.value||"00";
  return field("year")+"-"+field("month")+"-"+field("day")+" "+field("hour")+":"+field("minute")+":"+field("second");
}
function makeError(code,statusCode,message){const error=new Error(message);error.code=code;error.statusCode=statusCode;return error;}
function allowAttempt(ip){
  const now=Date.now(),key=String(ip||"unknown"),bucket=attempts.get(key)||{start:now,count:0};
  if(now-bucket.start>60000){bucket.start=now;bucket.count=0;}
  bucket.count++;attempts.set(key,bucket);
  return bucket.count<=12;
}
function cleanMetadata(value){try{const parsed=JSON.parse(value||"{}");return parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};}catch(_){return {};}}
function getPackageDuration(row,metadata,profile){
  let validity=String(row.validity||row.time_limit||"").trim();
  let ms=durationMs(validity);
  let quota=parseQuota(row.data_limit)||Number(metadata.limitBytesTotal)||0;
  if(!ms&&metadata.validityValue&&metadata.validityUnit){
    try{const normalized=normalizeProfileValidity(metadata.validityValue,metadata.validityUnit);validity=String(normalized.validity||"").trim();ms=durationMs(validity);quota=quota||Number(normalized.limitBytesTotal)||0;}catch(_){}
  }
  if(!ms&&!validity){
    const timeout=String(profile?.sessionTimeout||profile?.["session-timeout"]||"").trim();
    if(timeout&&timeout.toLowerCase()!=="none"){
      try{const normalized=parseStoredValidity(profile);if(normalized.validity){validity=normalized.validity;ms=durationMs(validity);quota=quota||Number(normalized.limitBytesTotal)||0;}}catch(_){}
    }
  }
  return {validity:ms?validity:"",duration:ms,quota:Math.max(0,Number(quota)||0)};
}
function getKnownMac(row){return normalizeMac(row?.mac_address)||normalizeMac(row?.username);}
async function activate(req,res){
  const fail=(status,code,message,extra={})=>res.status(status).json({success:false,code,message,error:message,...extra});
  if(!allowAttempt(req.ip))return fail(429,"RATE_LIMITED","Too many login attempts. Wait a minute and try again.");
  const phone=normalizePhone(req.body?.phone||req.body?.account_phone||"");
  const mac=normalizeMac(req.body?.mac||req.body?.device_mac||req.body?.macAddress||"");
  if(!/^01\d{9}$/.test(phone))return fail(400,"INVALID_ACCOUNT_PHONE","Enter a valid 11-digit Bangladeshi phone number.");
  if(!mac)return fail(400,"INVALID_MAC","RouterOS did not provide a valid device MAC address.");
  let reservation=null,routerSucceeded=false;
  try{
    const metaResult=await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");
    const metadata=cleanMetadata(metaResult.rows?.[0]?.value);
    const routerProfiles=await mikrotikService.getHotspotProfiles();
    reservation=await db.withTransaction(async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-hotspot-phone:"+phone]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-hotspot-mac:"+mac]);
      const found=await client.query("SELECT * FROM hotspot_vouchers WHERE REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($1,'880'||SUBSTRING($1 FROM 2)) OR LOWER(COALESCE(mac_address,''))=LOWER($2) OR LOWER(username)=LOWER($2) ORDER BY id DESC FOR UPDATE",[phone,mac]);
      const allRows=found.rows||[];
      const phoneRows=allRows.filter(row=>normalizePhone(row.phone)===phone);
      const macRows=allRows.filter(row=>getKnownMac(row)===mac);
      if(macRows.some(row=>normalizePhone(row.phone)!==phone))throw makeError("MAC_ALREADY_BOUND",403,"This device MAC is already bound to a different Hotspot phone number.");
      if(!phoneRows.length)throw makeError("NO_ELIGIBLE_PACKAGE",404,"No pending or active Hotspot package was found for this phone. Purchase a package first.");
      const knownMacs=[...new Set(phoneRows.map(getKnownMac).filter(Boolean))];
      if(knownMacs.length>1)throw makeError("ACCOUNT_MAC_CONFLICT",409,"This phone has conflicting saved MAC bindings. Contact FAZ NETWORK support.");
      const boundMac=knownMacs[0]||null;
      if(boundMac&&boundMac!==mac)throw makeError("MAC_MISMATCH",403,"This phone is already bound to another device. Contact support to request a device change.");
      const priority={pending_claim:0,active:1,unused:2,expired:3};
      const candidates=phoneRows.filter(row=>["pending_claim","active","unused"].includes(String(row.status||"").toLowerCase())).sort((a,b)=>(priority[String(a.status).toLowerCase()]??9)-(priority[String(b.status).toLowerCase()]??9)||Number(b.id||0)-Number(a.id||0));
      if(!candidates.length){
        const isExpired=phoneRows.some(row=>String(row.status||"").toLowerCase()==="expired"||(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()));
        throw makeError(isExpired?"PACKAGE_EXPIRED":"NO_ELIGIBLE_PACKAGE",isExpired?410:404,isExpired?"This Hotspot package has expired. Purchase a new package to continue.":"No pending or active Hotspot package was found for this phone.");
      }
      if(candidates.length>1)throw makeError("MULTIPLE_LIVE_PACKAGES",409,"Multiple live Hotspot packages are linked to this phone. Contact support before signing in.");
      const row=candidates[0],status=String(row.status||"").toLowerCase();
      const profile=routerProfiles.find(item=>String(item.name||"").toLowerCase()===String(row.profile||"").toLowerCase());
      if(!profile)throw makeError("PROFILE_NOT_FOUND",503,"The saved Hotspot package profile is unavailable on RouterOS. Please contact support.");
      const profileMeta=metadata[String(profile.name||"")]||{};
      const packageInfo=getPackageDuration(row,profileMeta,profile);
      if(!packageInfo.duration&&!packageInfo.quota)throw makeError("PROFILE_INVALID",409,"This Hotspot package has no valid time duration or data quota.");
      const now=new Date();
      let firstLoginAt=null,expiresAt=null;
      if(status==="active"){
        expiresAt=row.expires_at?new Date(row.expires_at):parseCommentExpiry(row.comment);
        if(!expiresAt&&row.first_login_at&&packageInfo.duration)expiresAt=new Date(new Date(row.first_login_at).getTime()+packageInfo.duration);
        if(packageInfo.duration&&!expiresAt)throw makeError("EXPIRY_NOT_RECORDED",409,"This existing active account has no reliable saved expiry. Contact support; validity will not be reset automatically.");
        if(expiresAt&&Number.isNaN(expiresAt.getTime()))throw makeError("EXPIRY_NOT_RECORDED",409,"The saved expiry is invalid. Contact support.");
        if(expiresAt&&expiresAt.getTime()<=now.getTime())throw makeError("PACKAGE_EXPIRED",410,"This Hotspot package has expired. Purchase a new package to continue.");
        firstLoginAt=row.first_login_at?new Date(row.first_login_at):(expiresAt&&packageInfo.duration?new Date(expiresAt.getTime()-packageInfo.duration):now);
      }else if(status==="pending_claim"&&row.first_login_at){
        firstLoginAt=new Date(row.first_login_at);
        expiresAt=row.expires_at?new Date(row.expires_at):(packageInfo.duration?new Date(firstLoginAt.getTime()+packageInfo.duration):null);
        if(expiresAt&&expiresAt.getTime()<=now.getTime())throw makeError("PACKAGE_EXPIRED",410,"This package expired during an earlier activation attempt. Purchase or assign a new package.");
      }else{
        firstLoginAt=now;
        expiresAt=packageInfo.duration?new Date(now.getTime()+packageInfo.duration):null;
      }
      if(firstLoginAt&&Number.isNaN(firstLoginAt.getTime()))throw makeError("INVALID_ACTIVATION_TIME",500,"Could not determine the account activation time.");
      const comment=expiresAt?"Exp: "+dhakaTimestamp(expiresAt):"FAZ|DATA_ONLY";
      const previousUsername=String(row.username||"").trim();
      const locked=await client.query("UPDATE hotspot_vouchers SET username=$1,password=$2,mac_address=$3,first_login_at=COALESCE(first_login_at,$4),expires_at=CASE WHEN $5::timestamptz IS NULL THEN NULL ELSE COALESCE(expires_at,$5) END,comment=$6,updated_at=NOW() WHERE id=$7 AND (mac_address IS NULL OR LOWER(mac_address)=LOWER($3)) RETURNING id,username,password,profile,profile_id,validity,price,status,comment,phone,server,time_limit,data_limit,mac_address,first_login_at,expires_at,transaction_id,renewal_stacked",[mac,phone,mac,firstLoginAt,expiresAt,comment,row.id]);
      if(!locked.rows?.length)throw makeError("MAC_MISMATCH",403,"This phone is already bound to another device.");
      const account=locked.rows[0];
      return {account:{...account,username:mac,password:phone,mac_address:mac,profile:profile.name,first_login_at:account.first_login_at||firstLoginAt,expires_at:account.expires_at??expiresAt,comment},profile:profile.name,validity:packageInfo.validity,quota:packageInfo.quota,firstActivation:status!=="active",stackedRenewal:Boolean(row.renewal_stacked),previousUsername,mac,phone};
    });
    const account=reservation.account;
    const expiry=account.expires_at?new Date(account.expires_at):null;
    if(reservation.firstActivation){
      await mikrotikService.rechargeHotspotUser({username:mac,password:phone,profile:reservation.profile,validity:reservation.validity,limitBytesTotal:reservation.quota,comment:account.comment,server:account.server||"all",macAddress:mac,previousUsername:reservation.previousUsername});
      routerSucceeded=true;
    }else{
      const existing=await mikrotikService.getHotspotUser(mac);
      if(!existing){
        if(reservation.quota>0)return fail(503,"ACTIVE_DATA_ACCOUNT_MISSING","The active data-quota user is missing from RouterOS. Support must reconcile usage before re-provisioning to avoid resetting the quota.");
        await mikrotikService.createHotspotUser({username:mac,password:phone,profile:reservation.profile,server:account.server||"all",validity:reservation.validity,comment:account.comment,macAddress:mac});
        routerSucceeded=true;
      }else{
        const actualMac=normalizeMac(existing.raw?.["mac-address"]||existing.macAddress||"");
        if(actualMac&&actualMac!==mac)return fail(403,"ROUTER_MAC_LOCK_MISMATCH","RouterOS reports a different MAC lock for this account. Contact support.");
        if(String(existing.profile||"")!==reservation.profile||String(existing.password||"")!==phone||actualMac!==mac||String(existing.comment||"")!==String(account.comment||"")){
          await mikrotikService.updateHotspotUser(mac,reservation.profile,account.comment,phone,mac);
          routerSucceeded=true;
        }
      }
    }
    if(expiry&&expiry.getTime()<=Date.now()){
      try{await mikrotikService.cleanupExpiredHotspotUser(mac);}catch(cleanupError){console.warn("[Hotspot activation] Expired RouterOS user cleanup pending:",cleanupError.message);}
      await db.query("UPDATE hotspot_vouchers SET status='expired',expired_at=COALESCE(expired_at,NOW()),cleanup_status='pending',updated_at=NOW() WHERE id=$1 AND mac_address=$2",[account.id,mac]).catch(()=>{});
      return fail(410,"PACKAGE_EXPIRED","The package expired before RouterOS activation completed. Purchase a new package to continue.");
    }
    const activated=await db.query("UPDATE hotspot_vouchers SET status='active',username=$2,password=$3,mac_address=$2,comment=$4,renewal_stacked=false,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$1 AND LOWER(mac_address)=LOWER($2) RETURNING id,username,status,first_login_at,expires_at,transaction_id",[account.id,mac,phone,account.comment]);
    if(!activated.rows?.length)throw new Error("RouterOS activation succeeded but the database account could not be finalized. Retry from the same device; the MAC binding is reserved.");
    routerSucceeded=true;
    return res.json({success:true,message:"Hotspot account activated for this device.",username:mac,password:phone,mac,phone,profile:reservation.profile,first_login_at:account.first_login_at,expires_at:expiry?expiry.toISOString():null,validity:reservation.validity});
  }catch(error){
    console.error("[Hotspot activation]",{code:error.code||"ACTIVATION_ERROR",message:error.message,mac,phone,routerSucceeded});
    return fail(error.statusCode||503,error.code||"ACTIVATION_ERROR",error.message||"Unable to activate this Hotspot account. Retry from the same device or contact support.");
  }
}
module.exports={activate,normalizePhone,normalizeMac};
