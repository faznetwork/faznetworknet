"use strict";

const db=require("../db");
const mikrotikService=require("../services/mikrotikService");
const notificationDispatcher=require("../services/notificationDispatcher");
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
function parseSavedExpiry(value){
  if(value===null||value===undefined||value==="")return null;
  if(typeof value==="string"){
    const dateOnly=value.trim().match(/^\d{4}-\d{2}-\d{2}$/);
    if(dateOnly)return new Date(dateOnly[0]+"T23:59:59.999+06:00");
  }
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?null:parsed;
}
async function deviceLookup(req,res){
  const fail=(status,code,message)=>res.status(status).json({success:false,code,message});
  const mac=normalizeMac(req.body?.mac||req.body?.device_mac||req.body?.macAddress||"");
  const phone=normalizePhone(req.body?.phone||req.body?.account_phone||"");
  if(!mac)return fail(400,"INVALID_MAC","A valid captive-portal device MAC is required.");
  if(phone&&!/^01\d{9}$/.test(phone))return fail(400,"INVALID_ACCOUNT_PHONE","Enter a valid 11-digit phone number when supplied.");
  try{
    const result=await db.query(
      "SELECT id,status,profile,phone,expires_at,first_login_at,mac_address,subscriber_type,activation_type,username FROM hotspot_vouchers WHERE (LOWER(COALESCE(mac_address,''))=LOWER($1) OR LOWER(username)=LOWER($1) OR ($2<>'' AND REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($2,'880'||SUBSTRING($2 FROM 2)))) AND COALESCE(subscriber_type,'legacy')='direct_subscriber' AND LOWER(COALESCE(status,'')) IN ('pending_claim','unused','active','expired') ORDER BY CASE WHEN LOWER(COALESCE(mac_address,''))=LOWER($1) THEN 0 WHEN LOWER(COALESCE(status,''))='pending_claim' THEN 1 ELSE 2 END,id DESC LIMIT 2",
      [mac,phone]
    );
    const rows=result.rows||[];
    const macBound=rows.filter(row=>normalizeMac(row.mac_address)===mac||normalizeMac(row.username)===mac);
    const phoneMatched=phone?rows.filter(row=>normalizePhone(row.phone)===phone):[];
    const candidates=macBound.length?macBound:phoneMatched;
    if(candidates.length>1)return fail(409,"AMBIGUOUS_SUBSCRIBER","Multiple direct subscriber records match. Contact FAZ NETWORK support.");
    if(!candidates.length)return res.json({success:true,found:false,requires_phone:true,message:"No direct subscriber is bound to this MAC. A staged subscriber must be identified by its registered phone number or existing payment/voucher credentials."});
    const row=candidates[0],status=String(row.status||"").toLowerCase();
    if(normalizeMac(row.mac_address)&&normalizeMac(row.mac_address)!==mac)return fail(403,"MAC_ALREADY_BOUND","This subscriber is permanently bound to another device.");
    if(status==="expired"||(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()))return fail(410,"PACKAGE_EXPIRED","This subscriber package has expired. Purchase a new package to continue.");
    return res.json({success:true,found:true,subscriber_type:"direct_subscriber",activation_type:row.activation_type||"legacy",requires_phone:!normalizeMac(row.mac_address)&&!normalizeMac(row.username),status,profile:row.profile||"",expires_at:row.expires_at||null});
  }catch(error){
    console.error("[Hotspot device lookup]",error.message);
    return fail(503,"DEVICE_LOOKUP_FAILED","Unable to check the subscriber record right now.");
  }
}

async function activate(req,res){
  const fail=(status,code,message,extra={})=>res.status(status).json({success:false,code,message,error:message,...extra});
  if(!allowAttempt(req.ip))return fail(429,"RATE_LIMITED","Too many login attempts. Wait a minute and try again.");
  const phone=normalizePhone(req.body?.phone||req.body?.account_phone||"");
  const mac=normalizeMac(req.body?.mac||req.body?.device_mac||req.body?.macAddress||"");
  if(phone&&!/^01\d{9}$/.test(phone))return fail(400,"INVALID_ACCOUNT_PHONE","Enter a valid 11-digit Bangladeshi phone number when supplying one.");
  if(!mac)return fail(400,"INVALID_MAC","RouterOS did not provide a valid device MAC address.");
  let reservation=null,routerSucceeded=false;
  try{
    const metaResult=await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");
    const metadata=cleanMetadata(metaResult.rows?.[0]?.value);
    const routerProfiles=await mikrotikService.getHotspotProfiles();
    reservation=await db.withTransaction(async client=>{
      if(phone)await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-hotspot-phone:"+phone]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-hotspot-mac:"+mac]);
       const found=await client.query("SELECT * FROM hotspot_vouchers WHERE (REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($1,'880'||SUBSTRING($1 FROM 2)) AND LOWER(COALESCE(status,'')) IN ('pending_claim','unused','active','expired')) OR LOWER(COALESCE(mac_address,''))=LOWER($2) OR LOWER(username)=LOWER($2) ORDER BY id DESC FOR UPDATE",[phone,mac]);
      const allRows=found.rows||[];
      const phoneRows=phone?allRows.filter(row=>normalizePhone(row.phone)===phone):[];
      const macRows=allRows.filter(row=>getKnownMac(row)===mac);
      // Device MAC is the stable account key; a SIM/shop-phone change must not orphan the voucher.
      const stagedDirect=phoneRows.filter(row=>String(row.subscriber_type||"legacy")==="direct_subscriber"&&String(row.status||"").toLowerCase()==="pending_claim");
      const accountRows=macRows.length?macRows:stagedDirect.length?stagedDirect:phoneRows;
      if(!accountRows.length)throw makeError("NO_ELIGIBLE_PACKAGE",404,"No pending or active Hotspot package was found for this phone or device MAC. Purchase a package first.");
      const knownMacs=[...new Set(accountRows.map(getKnownMac).filter(Boolean))];
      if(knownMacs.length>1)throw makeError("ACCOUNT_MAC_CONFLICT",409,"This phone has conflicting saved MAC bindings. Contact FAZ NETWORK support.");
      const boundMac=knownMacs[0]||null;
      if(boundMac&&boundMac!==mac)throw makeError("MAC_MISMATCH",403,"This phone is already bound to another device. Contact support to request a device change.");
      const priority={pending_claim:0,active:1,unused:2,expired:3};
       const candidates=accountRows.filter(row=>{const status=String(row.status||"").toLowerCase();if(!["pending_claim","active","unused"].includes(status))return false;if(status==="unused"||status==="pending_claim")return true;const expiry=parseSavedExpiry(row.expires_at)||parseCommentExpiry(row.comment);return !expiry||expiry.getTime()>Date.now();}).sort((a,b)=>(priority[String(a.status).toLowerCase()]??9)-(priority[String(b.status).toLowerCase()]??9)||Number(b.id||0)-Number(a.id||0));
      if(!candidates.length){
        const isExpired=accountRows.some(row=>{const status=String(row.status||"").toLowerCase();if(status==="expired")return true;if(status!=="active")return false;const expiry=parseSavedExpiry(row.expires_at)||parseCommentExpiry(row.comment);return Boolean(expiry&&expiry.getTime()<=Date.now());});
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
        expiresAt=parseSavedExpiry(row.expires_at)||parseCommentExpiry(row.comment);
        if(!expiresAt&&row.first_login_at&&packageInfo.duration)expiresAt=new Date(new Date(row.first_login_at).getTime()+packageInfo.duration);
        if(packageInfo.duration&&!expiresAt)throw makeError("EXPIRY_NOT_RECORDED",409,"This existing active account has no reliable saved expiry. Contact support; validity will not be reset automatically.");
        if(expiresAt&&Number.isNaN(expiresAt.getTime()))throw makeError("EXPIRY_NOT_RECORDED",409,"The saved expiry is invalid. Contact support.");
        if(expiresAt&&expiresAt.getTime()<=now.getTime())throw makeError("PACKAGE_EXPIRED",410,"This Hotspot package has expired. Purchase a new package to continue.");
        firstLoginAt=row.first_login_at?new Date(row.first_login_at):(expiresAt&&packageInfo.duration?new Date(expiresAt.getTime()-packageInfo.duration):now);
      }else{
        firstLoginAt=now;
        expiresAt=packageInfo.duration?new Date(now.getTime()+packageInfo.duration):parseSavedExpiry(row.expires_at);
        if(expiresAt&&Number.isNaN(expiresAt.getTime()))throw makeError("EXPIRY_NOT_RECORDED",409,"The saved expiry is invalid. Contact support.");
      }
      if(firstLoginAt&&Number.isNaN(firstLoginAt.getTime()))throw makeError("INVALID_ACTIVATION_TIME",500,"Could not determine the account activation time.");
      const comment=expiresAt?"Exp: "+dhakaTimestamp(expiresAt):"FAZ|DATA_ONLY";
      const previousUsername=String(row.username||"").trim();
      const locked=await client.query("UPDATE hotspot_vouchers SET username=$1,password=$2,mac_address=$3,first_login_at=COALESCE(first_login_at,$4),expires_at=CASE WHEN LOWER(COALESCE(status,'')) IN ('unused','pending_claim') THEN $5::timestamptz WHEN $5::timestamptz IS NULL THEN NULL ELSE COALESCE(expires_at,$5) END,comment=$6,phone=COALESCE(NULLIF($7,''),phone),updated_at=NOW() WHERE id=$8 AND (mac_address IS NULL OR LOWER(mac_address)=LOWER($3)) RETURNING id,username,password,profile,profile_id,validity,price,status,comment,phone,customer_name,server,time_limit,data_limit,mac_address,first_login_at,expires_at,transaction_id,renewal_stacked",[mac,mac,mac,firstLoginAt,expiresAt,comment,phone,row.id]);
      if(!locked.rows?.length)throw makeError("MAC_MISMATCH",403,"This phone is already bound to another device.");
      const account=locked.rows[0];
      return {account:{...account,username:mac,password:mac,mac_address:mac,profile:profile.name,first_login_at:account.first_login_at||firstLoginAt,expires_at:account.expires_at??expiresAt,comment},profile:profile.name,validity:packageInfo.validity,quota:packageInfo.quota,firstActivation:status==="unused"||(status==="pending_claim"&&!getKnownMac(row)),stackedRenewal:Boolean(row.renewal_stacked),previousUsername,mac,phone};
    });
    const account=reservation.account;
    const expiry=account.expires_at?new Date(account.expires_at):null;
    if(reservation.firstActivation){
      await mikrotikService.rechargeHotspotUser({username:mac,password:mac,profile:reservation.profile,validity:reservation.validity,limitBytesTotal:reservation.quota,comment:account.comment,server:account.server||"all",macAddress:mac,previousUsername:reservation.previousUsername});
      routerSucceeded=true;
    }else{
      const existing=await mikrotikService.getHotspotUser(mac);
      if(!existing){
        if(reservation.quota>0)return fail(503,"ACTIVE_DATA_ACCOUNT_MISSING","The active data-quota user is missing from RouterOS. Support must reconcile usage before re-provisioning to avoid resetting the quota.");
        await mikrotikService.createHotspotUser({username:mac,password:mac,profile:reservation.profile,server:account.server||"all",validity:reservation.validity,comment:account.comment,macAddress:mac});
        routerSucceeded=true;
      }else{
        const actualMac=normalizeMac(existing.raw?.["mac-address"]||existing.macAddress||"");
        if(actualMac&&actualMac!==mac)return fail(403,"ROUTER_MAC_LOCK_MISMATCH","RouterOS reports a different MAC lock for this account. Contact support.");
        if(String(existing.profile||"")!==reservation.profile||String(existing.password||"")!==mac||actualMac!==mac||String(existing.comment||"")!==String(account.comment||"")){
          await mikrotikService.updateHotspotUser(mac,reservation.profile,account.comment,mac,mac);
          routerSucceeded=true;
        }
      }
    }
    if(expiry&&expiry.getTime()<=Date.now()){
      try{await mikrotikService.cleanupExpiredHotspotUser(mac);}catch(cleanupError){console.warn("[Hotspot activation] Expired RouterOS user cleanup pending:",cleanupError.message);}
      await db.query("UPDATE hotspot_vouchers SET status='expired',expired_at=COALESCE(expired_at,NOW()),cleanup_status='pending',updated_at=NOW() WHERE id=$1 AND mac_address=$2",[account.id,mac]).catch(()=>{});
      return fail(410,"PACKAGE_EXPIRED","The package expired before RouterOS activation completed. Purchase a new package to continue.");
    }
    const activated=await db.query("UPDATE hotspot_vouchers SET status='active',username=$2,password=$2,mac_address=$2,phone=COALESCE(NULLIF($4,''),phone),comment=$3,renewal_stacked=false,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$1 AND LOWER(mac_address)=LOWER($2) RETURNING id,username,status,first_login_at,expires_at,transaction_id",[account.id,mac,account.comment,phone]);
    if(!activated.rows?.length)throw new Error("RouterOS activation succeeded but the database account could not be finalized. Retry from the same device; the MAC binding is reserved.");
    routerSucceeded=true;
    if(reservation.firstActivation&&phone&&phone!=="Unlinked"){
      const customerName=String(account.customer_name||"গ্রাহক").trim()||"গ্রাহক";
      const expiryStr=expiry?new Date(expiry).toLocaleString("en-BD",{timeZone:"Asia/Dhaka"}):"প্যাকেজ অনুযায়ী";
      notificationDispatcher.dispatchNotification({userType:"hotspot",event:"hotspot_first_login",to:phone,recipient:phone,phone,username:mac,customer:{username:mac,name:customerName,phone,profile:reservation.profile},customerName,message:`আসসালামু আলাইকুম ${customerName}, FAZ NETWORK হটস্পটে স্বাগতম!\nআপনার ${reservation.profile} প্যাকেজটি সক্রিয় হয়েছে।\nমেয়াদ: ${expiryStr} পর্যন্ত।\nহেল্পলাইন: 01339932887`,useMessageDirectly:true,channels:["sms","whatsapp"],variables:{name:customerName,username:mac,profile:reservation.profile,package:reservation.profile,expiry_date:expiryStr}});
    }
    return res.json({success:true,message:"Hotspot account activated for this device.",username:mac,password:mac,mac,phone,profile:reservation.profile,first_login_at:account.first_login_at,expires_at:expiry?expiry.toISOString():null,validity:reservation.validity});
  }catch(error){
    console.error("[Hotspot activation]",{code:error.code||"ACTIVATION_ERROR",message:error.message,mac,phone,routerSucceeded});
    return fail(error.statusCode||503,error.code||"ACTIVATION_ERROR",error.message||"Unable to activate this Hotspot account. Retry from the same device or contact support.");
  }
}

async function claimVoucher(req,res){
  const fail=(status,code,message)=>res.status(status).json({success:false,code,message,error:message});
  if(!allowAttempt(req.ip))return fail(429,"RATE_LIMITED","Too many voucher attempts. Wait a minute and try again.");
  const pin=String(req.body?.voucher_code||req.body?.pin||"").trim().toUpperCase();
  const password=String(req.body?.voucher_password||req.body?.password||"").trim();
  const mac=normalizeMac(req.body?.mac||req.body?.device_mac||"");
  if(!pin||pin.length<4||pin.length>100)return fail(400,"INVALID_VOUCHER_PIN","Enter the voucher PIN printed on your card.");
  if(!password||password.length>160)return fail(400,"INVALID_VOUCHER_PASSWORD","Enter the voucher card password.");
  if(!mac)return fail(400,"INVALID_MAC","RouterOS did not provide a valid device MAC address.");
  try{
    const claimed=await db.withTransaction(async client=>{
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-voucher-pin:"+pin]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-hotspot-mac:"+mac]);
      const result=await client.query("SELECT id,username,password,status,mac_address,expires_at,comment,profile,price,phone FROM hotspot_vouchers WHERE UPPER(BTRIM(username))=$1 AND password=$2 AND COALESCE(subscriber_type,'legacy') <> 'direct_subscriber' ORDER BY id DESC LIMIT 2 FOR UPDATE",[pin,password]);
      if(result.rows.length!==1)throw makeError("VOUCHER_INVALID",400,"Voucher PIN or password is incorrect.");
      const row=result.rows[0],status=String(row.status||"").toLowerCase();
      if(!["unused","pending_claim","active"].includes(status))throw makeError("VOUCHER_ALREADY_USED",409,"This voucher has already been used or expired.");
      const known=normalizeMac(row.mac_address)||(normalizeMac(row.username));
      if(known&&known!==mac)throw makeError("VOUCHER_MAC_LOCKED",403,"This voucher is already bound to another device.");
      const expiry=parseSavedExpiry(row.expires_at)||parseCommentExpiry(row.comment);
      if(status==="active"&&expiry&&expiry.getTime()<=Date.now())throw makeError("PACKAGE_EXPIRED",410,"This voucher package has expired.");
      const conflicts=await client.query("SELECT id,status,expires_at,comment FROM hotspot_vouchers WHERE id<>$2 AND LOWER(COALESCE(mac_address,''))=LOWER($1) FOR UPDATE",[mac,row.id]);
      for(const conflict of conflicts.rows||[]){
        const state=String(conflict.status||"").toLowerCase();
        const deadline=parseSavedExpiry(conflict.expires_at)||parseCommentExpiry(conflict.comment);
        const expired=state==="expired"||(state==="active"&&deadline&&deadline.getTime()<=Date.now());
        if(!expired)throw makeError("MAC_ALREADY_BOUND",409,"This device MAC is already bound to another live voucher. Sign in with that voucher or contact support.");
        await client.query("UPDATE hotspot_vouchers SET mac_address=NULL,status=CASE WHEN LOWER(COALESCE(status,''))='active' THEN 'expired' ELSE status END,expired_at=CASE WHEN LOWER(COALESCE(status,''))='active' THEN COALESCE(expired_at,expires_at,NOW()) ELSE expired_at END,updated_at=NOW() WHERE id=$1",[conflict.id]);
      }
      await client.query("UPDATE hotspot_vouchers SET mac_address=$1,updated_at=NOW() WHERE id=$2",[mac,row.id]);
      return {id:row.id,phone:String(row.phone||"Unlinked"),profile:String(row.profile||"Hotspot"),price:Number(row.price||0),firstUse:status==="unused"||status==="pending_claim"};
    });
    let statusCode=200;
    const responseProxy={
      status(code){statusCode=code;return this;},
      async json(body){
        if(body?.success&&statusCode<400&&claimed.firstUse){
          try{
            const trxId="SCRATCH-"+claimed.id+"-"+Date.now();
            const tx=await db.query("INSERT INTO transactions(channel,trx_id,sender_phone,amount,status,matched_username,raw_sms,used,claim_flow,sale_type,claimed_at,claimed_by) VALUES('cash',$1,$2,$3,'processed',$4,$5,true,'manual_hotspot','scratch_card',NOW(),$6) RETURNING id",[trxId,claimed.phone==="Unlinked"?null:claimed.phone,claimed.price,mac,"Scratch-card redemption for voucher "+claimed.id,"scratch-card:"+claimed.id]);
            await db.query("INSERT INTO hotspot_voucher_payments(transaction_id,voucher_id,phone,amount,profile,sale_type) VALUES($1,$2,$3,$4,$5,'scratch_card') ON CONFLICT(transaction_id) DO NOTHING",[tx.rows[0].id,claimed.id,claimed.phone,claimed.price,claimed.profile]);
          }catch(auditError){console.error("[Scratch voucher sales audit] Failed to record sale:",auditError.message);body.sale_audit_warning=true;}
        }
        return res.status(statusCode).json(body);
      }
    };
    return activate({...req,body:{...(req.body||{}),mac,phone:""}},responseProxy);
  }catch(error){
    return fail(error.statusCode||500,error.code||"VOUCHER_CLAIM_FAILED",error.message||"Unable to claim this voucher.");
  }
}
module.exports={activate,claimVoucher,deviceLookup,normalizePhone,normalizeMac};
