"use strict";
const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

function normalizePhone(value) {
  let digits = String(value ?? "").replace(/[০-৯]/g, ch => String("০১২৩৪৫৬৭৮৯".indexOf(ch))).replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length === 13) digits = "0" + digits.slice(3);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : "";
}
function normalizeMac(value) {
  const compact = String(value ?? "").trim().replace(/[:-]/g, "");
  return /^[0-9a-fA-F]{12}$/.test(compact) ? compact.match(/.{2}/g).join(":").toUpperCase() : "";
}
function fail(res, status, message) { return res.status(status).json({ success: false, message, error: message }); }
function parseExpiry(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)
    ? new Date(raw + (raw.length === 16 ? ":00" : "") + "+06:00")
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}
function dhakaTimestamp(date) {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23" }).formatToParts(date).reduce((o,x)=>(o[x.type]=x.value,o),{});
  return p.year+"-"+p.month+"-"+p.day+" "+p.hour+":"+p.minute+":"+p.second;
}
function safeProfile(row) {
  return { id:row.id, username:row.username, name:row.customer_name||"", phone:row.phone||"", mac:row.mac_address||"",
    password:row.password||"", mac_lock:row.mac_lock!==false, notes:row.note||"", note:row.note||"",
    profile:row.profile||"", profile_id:row.profile_id||"", status:row.status||"", expires_at:row.expires_at||null, server:row.server||"all" };
}
async function getProfile(req,res) {
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)return fail(res,400,"A valid hotspot customer ID is required.");
  try {
    const result=await db.query("SELECT id,username,password,customer_name,phone,mac_address,note,profile,profile_id,status,expires_at,server,mac_lock FROM hotspot_vouchers WHERE id=$1 LIMIT 1",[id]);
    if(!result.rows?.length)return fail(res,404,"Hotspot customer was not found.");
    return res.json({success:true,profile:safeProfile(result.rows[0])});
  } catch(error) { console.error("[Hotspot Profile API] Read failed:",error);return fail(res,503,"Unable to load hotspot customer profile."); }
}
async function updateProfile(req,res) {
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)return fail(res,400,"A valid hotspot customer ID is required.");
  const body=req.body&&typeof req.body==="object"?req.body:{};
  const name=String(body.name??body.customer_name??"").trim().slice(0,160);
  const phone=normalizePhone(body.phone??body.customer_phone);
  const rawMac=String(body.mac??body.mac_address??"").trim(),mac=rawMac?normalizeMac(rawMac):"";
  const password=String(body.password??"").trim().slice(0,128);
  const notes=String(body.note??body.notes??"").trim().slice(0,1000);
  const macLock=body.mac_lock===undefined?Boolean(mac):body.mac_lock===true;
  const rawExpiry=body.expires_at??body.expiresAt??"";
  const customExpiry=parseExpiry(rawExpiry);
  const requestedProfile=String(body.profile??"").trim().slice(0,100);
  if(!phone)return fail(res,400,"Enter a valid Bangladesh mobile number (01XXXXXXXXX or 8801XXXXXXXXX).");
  if(rawMac&&!mac)return fail(res,400,"Enter a valid MAC address.");
  if(macLock&&!mac)return fail(res,400,"A MAC address is required when MAC lock is enabled.");
  if(customExpiry===undefined)return fail(res,400,"Enter a valid custom expiry date and time.");
  if(customExpiry&&customExpiry.getTime()<=Date.now())return fail(res,400,"Expiry must be in the future.");
  try {
    const found=await db.query("SELECT id,username,password,customer_name,phone,mac_address,note,profile,profile_id,status,validity,time_limit,data_limit,price,comment,first_login_at,expires_at,server,mac_lock FROM hotspot_vouchers WHERE id=$1 LIMIT 1",[id]);
    const row=found.rows?.[0];
    if(!row)return fail(res,404,"Hotspot customer was not found.");
    const oldUsername=String(row.username||"").trim(),oldMac=normalizeMac(row.mac_address)||normalizeMac(oldUsername);
    const profile=requestedProfile||String(row.profile||"").trim();
    if(!profile)return fail(res,400,"Select a Hotspot package/profile.");
    const targetUsername=macLock?mac:(oldUsername&&!oldMac?oldUsername:"PENDING-"+phone);
    const nextPassword=password||phone;
    const wasActivated=String(row.status||"").toLowerCase()==="active"||Boolean(oldMac);
    let expiresAt=customExpiry|| (row.expires_at?new Date(row.expires_at):null);
    const profileMetaResult=await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1").catch(()=>({rows:[]}));
    const metadata=profileMetaResult.rows?.[0]?.value||{};
    const profileMeta=metadata[profile]||{};
    let validity=String(row.validity||"").trim(),quota=Number(row.data_limit||profileMeta.limitBytesTotal||0);
    if(profileMeta.validityValue&&profileMeta.validityUnit) {
      const config=require("../services/hotspotProfileConfig").normalizeProfileValidity(profileMeta.validityValue,profileMeta.validityUnit);
      validity=config.validity||validity;quota=Number(config.limitBytesTotal||quota);
    }
    const comment=expiresAt?"Exp: "+dhakaTimestamp(expiresAt):"FAZ|DATA_ONLY";
    const profileId=String(profileMeta.id||profileMeta.profileId||profileMeta.profile_id||profileMeta.packageId||profileMeta.package_id||profileMeta.packageName||profileMeta.package_name||profileMeta.alias||profile);
    const server=String(body.server??row.server??"all").trim()||"all";
    let routerSync={skipped:true,reason:"unassigned-first-login-account"};
    if(macLock) {
      if(!validity&&!quota&&!customExpiry)return fail(res,400,"Selected package has no configured validity or data quota.");
      if(!expiresAt&&validity) {
        const m=validity.match(/^(\d+(?:\.\d+)?)\s*(s|sec|second|seconds|m|min|minute|minutes|h|hr|hour|hours|d|day|days|w|week|weeks)$/i);
        if(m){const unit=m[2].toLowerCase();const ms=unit.startsWith("s")?1000:unit.startsWith("m")?60000:unit.startsWith("h")?3600000:unit.startsWith("w")?604800000:86400000;expiresAt=new Date(Date.now()+Number(m[1])*ms);}
      }
      if(expiresAt&&expiresAt.getTime()<=Date.now())return fail(res,400,"Expiry must be in the future.");
      const exactComment=expiresAt?"Exp: "+dhakaTimestamp(expiresAt):(quota?"FAZ|DATA_ONLY":"");
      await mikrotikService.rechargeHotspotUser({username:mac,password:nextPassword,profile,validity,limitBytesTotal:quota,comment:exactComment,server,macAddress:mac,previousUsername:oldUsername!==mac?oldUsername:""});
      routerSync={synced:true,username:mac,comment:exactComment};
    } else if(wasActivated&&oldUsername) {
      await mikrotikService.removeHotspotUser(oldUsername);
      routerSync={removed:true,username:oldUsername};
      expiresAt=null;
    }
    const status=macLock?"active":"unused";
    const username=macLock?mac:(mac?"PENDING-"+phone:(oldUsername&&!oldMac?oldUsername:"PENDING-"+phone));
    const firstLogin=macLock?(row.first_login_at||new Date()):null;
    const commentSaved=macLock?(expiresAt?"Exp: "+dhakaTimestamp(expiresAt):(quota?"FAZ|DATA_ONLY":"")):"FAZ|PENDING|PROFILE="+profile;
    const saved=await db.query(
      "UPDATE hotspot_vouchers SET username=$1,password=$2,customer_name=$3,phone=$4,mac_address=$5,note=$6,mac_lock=$7,profile=$8,profile_id=$9,expires_at=$10,first_login_at=$11,status=$12,comment=$13,server=$14,validity=$15,time_limit=$15,data_limit=$16,updated_at=NOW() WHERE id=$17 RETURNING id,username,password,customer_name,phone,mac_address,note,profile,profile_id,status,expires_at,server,mac_lock",
      [username,nextPassword,name,phone,macLock?mac:null,notes,macLock,profile,profileId,macLock?expiresAt:null,firstLogin,status,commentSaved,server,validity||null,quota?String(quota):null,id]);
    try{require("../controllers/hotspotController").invalidateListCache?.();}catch(_){}
    return res.json({success:true,message:"Profile updated successfully!",profile:safeProfile(saved.rows[0]),routerSync});
  } catch(error) {
    console.error("[Hotspot Profile API] Update failed:",error);
    return fail(res,error.statusCode||502,"Profile update or MikroTik synchronization failed. "+String(error.message||"").slice(0,180));
  }
}
module.exports={getProfile,updateProfile,normalizePhone,normalizeMac};
