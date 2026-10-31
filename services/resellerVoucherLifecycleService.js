'use strict';
const db=require('../db');
const mikrotikService=require('./mikrotikService');
function resellerKey(value){const id=Number(value);if(!Number.isSafeInteger(id)||id<1||id>2147483647)throw Object.assign(new Error('Verified reseller identity is required.'),{statusCode:403,code:'RESELLER_ID_REQUIRED'});return id;}
function durationSeconds(value){const text=String(value??'').trim().toLowerCase();if(!text)return null;if(/^\d+$/.test(text))return Number(text);const clock=text.match(/^(?:(\d+)d)?(\d{1,2}):(\d{2}):(\d{2})$/);if(clock)return Number(clock[1]||0)*86400+Number(clock[2])*3600+Number(clock[3])*60+Number(clock[4]);const pattern=/(\d+)(w|d|h|m|s)/g;let total=0,match,consumed='';const factors={w:604800,d:86400,h:3600,m:60,s:1};while((match=pattern.exec(text))!==null){total+=Number(match[1])*factors[match[2]];consumed+=match[0];}return consumed===text&&Number.isSafeInteger(total)?total:null;}
function byteLimit(value){const text=String(value??'').trim().toLowerCase().replace(/\s+/g,'');const match=text.match(/^(\d+(?:\.\d+)?)(b|k|kb|kib|m|mb|mib|g|gb|gib|t|tb|tib)?$/);if(!match)return null;const factors={b:1,k:1024,kb:1000,kib:1024,m:1048576,mb:1000000,mib:1048576,g:1073741824,gb:1000000000,gib:1073741824,t:1099511627776,tb:1000000000000,tib:1099511627776};return Number(match[1])*(factors[match[2]||'b']||1);}
function classifyVoucher(row,session,telemetryAvailable,now=Date.now()){
 const status=String(row.status||'').toLowerCase();const expiry=row.expires_at?new Date(row.expires_at).getTime():null;
 const expired=status==='expired'||status==='archived'||status==='deleted'||Boolean(row.expired_at)||(Number.isFinite(expiry)&&expiry<=now);
 const limitSeconds=durationSeconds(row.time_limit);const uptime=durationSeconds(session?.uptime);const limitBytes=byteLimit(row.data_limit);
 const usedBytes=session?Number(session.bytesIn||0)+Number(session.bytesOut||0):null;
 const quotaExhausted=Boolean(session&&Number.isFinite(limitBytes)&&limitBytes>0&&Number.isFinite(usedBytes)&&usedBytes>=limitBytes);
 const timeExhausted=Boolean(session&&Number.isFinite(limitSeconds)&&limitSeconds>0&&Number.isFinite(uptime)&&uptime>=limitSeconds);
 if(expired||quotaExhausted||timeExhausted)return 'EXPIRED';
 if(session||row.first_login_at||status==='active')return 'ACTIVE';
 if(!telemetryAvailable)return 'ACTIVE';
 if(status==='unused'&&!row.first_login_at)return 'UNUSED';
 return 'ACTIVE';
}
function remainingTime(row,session,status,now=Date.now()){
 if(status==='EXPIRED')return 'Expired';if(status==='UNUSED')return 'Not started';
 const live=String(session?.sessionTimeLeft||'').trim();if(live)return live;
 const expiry=row.expires_at?new Date(row.expires_at).getTime():null;
 if(Number.isFinite(expiry))return Math.max(0,Math.floor((expiry-now)/1000))+'s';
 const limit=durationSeconds(row.time_limit);
 if(Number.isFinite(limit)&&row.first_login_at){const started=new Date(row.first_login_at).getTime();if(Number.isFinite(started))return Math.max(0,limit-Math.floor((now-started)/1000))+'s';}
 return 'Unavailable';
}
function normalizeMac(value){const compact=String(value??'').trim().replace(/[:-]/g,'');return /^[0-9a-f]{12}$/i.test(compact)?compact.toLowerCase():'';}
async function listForReseller(value,limitValue=500){
 const resellerId=resellerKey(value);const limit=Number.isInteger(Number(limitValue))?Math.max(1,Math.min(1000,Number(limitValue))):500;
 const result=await db.query(
  "SELECT b.id AS batch_id,to_jsonb(b)->>'batch_key' AS batch_key,b.created_at AS batch_created_at,"+
  "b.profile_key,b.validity,b.reseller_id,v.id AS voucher_id,v.username,v.status,v.first_login_at,"+
  "v.expires_at,v.expired_at,v.time_limit,v.data_limit,v.created_at,v.updated_at,v.mac_address,v.server "+
  "FROM public.reseller_voucher_batches b "+
  "INNER JOIN public.reseller_voucher_issuance_items i ON i.batch_id=b.id "+
  "INNER JOIN public.hotspot_vouchers v ON v.id=i.voucher_id "+
  "WHERE b.reseller_id=$1 ORDER BY v.created_at DESC,v.id DESC LIMIT $2",
  [resellerId,limit]
 );
 let sessions=[];let telemetryAvailable=true;
 try{sessions=await mikrotikService.getActiveHotspotSessions();if(!Array.isArray(sessions))throw new Error('MikroTik active-session response was not an array.');}
 catch(error){telemetryAvailable=false;console.error('[Reseller Voucher Lifecycle] MikroTik session telemetry unavailable; used vouchers will not be classified as UNUSED.',{resellerId,code:error.code||'MIKROTIK_TELEMETRY_UNAVAILABLE',message:error.message});}
 const byUsername=new Map(),byMac=new Map();
 for(const session of sessions){const username=String(session?.username||'').trim().toLowerCase();const mac=normalizeMac(session?.macAddress||session?.mac_address||session?.['mac-address']);if(username)byUsername.set(username,session);if(mac)byMac.set(mac,session);}
 const now=Date.now();
 const vouchers=(result.rows||[]).map(row=>{
  const username=String(row.username||'').trim().toLowerCase(),mac=normalizeMac(row.mac_address);
  const session=byUsername.get(username)||((mac&&byMac.get(mac))||null);
  const status=classifyVoucher(row,session,telemetryAvailable,now);
  return {id:String(row.voucher_id),username:row.username,batchKey:row.batch_key,packageName:row.profile_key||'Hotspot package',validity:row.validity||'As configured',createdAt:row.created_at,firstLoginAt:row.first_login_at,expiresAt:row.expires_at,status,uptime:session?.uptime||'—',remainingTime:remainingTime(row,session,status,now),online:Boolean(session),telemetryAvailable,sessionIp:session?.address||session?.ip||'',server:session?.server||row.server||''};
 });
 return {vouchers,telemetryAvailable,checkedAt:new Date(now).toISOString()};
}
module.exports={listForReseller,classifyVoucher,durationSeconds,byteLimit,remainingTime};
