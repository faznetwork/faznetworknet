const db=require("../db");
const mikrotikService=require("../services/mikrotikService");

const {parseSms}=require("../services/paymentWebhookParser");
const {buildHotspotOnLoginScript}=require("../services/hotspotProfileConfig");
function errorResponse(res,error,code=400){console.error("[Payment API]",error);const message=error?.message||"Payment operation failed.";return res.status(code).json({success:false,users:[],profiles:[],transactions:[],message,error:message});}

function normalizePhone(value){const bangla="০১২৩৪৫৬৭৮৯";let digits=String(value||"").replace(/[০-৯]/g,ch=>String(bangla.indexOf(ch))).replace(/\D/g,"");if(digits.startsWith("880")&&digits.length===13)digits="0"+digits.slice(3);return digits;}
function moneyCents(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*100):NaN;}
function normalizeProfileIdentifier(value){
 return String(value??"").normalize("NFKC").trim().toLowerCase()
  .replace(/\b(hours?|hrs?)\b/g,"h")
  .replace(/\b(minutes?|mins?)\b/g,"m")
  .replace(/\b(seconds?|secs?)\b/g,"s")
  .replace(/\b(days?)\b/g,"d")
  .replace(/\b(weeks?)\b/g,"w")
  .replace(/\b(months?)\b/g,"mo")
  .replace(/[^a-z0-9]/g,"");
}
function profileIdentifierMatches(profileName,metadata,requested){
 if(!requested)return true;
 const aliases=[profileName,metadata?.id,metadata?.profileId,metadata?.profile_id,metadata?.packageId,metadata?.package_id,metadata?.packageName,metadata?.package_name,metadata?.alias,metadata?.aliases];
 const candidates=aliases.flatMap(value=>Array.isArray(value)?value:[value]).filter(value=>value!==undefined&&value!==null&&String(value).trim()!=="");
 const target=normalizeProfileIdentifier(requested);
 return Boolean(target)&&candidates.some(value=>normalizeProfileIdentifier(value)===target);
}
function addCalendarMonths(v,months){const d=new Date(String(v||"")+"T00:00:00Z");if(Number.isNaN(d.getTime()))return null;const day=d.getUTCDate(),t=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+Number(months),1)),last=new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,0)).getUTCDate();t.setUTCDate(Math.min(day,last));return t.toISOString().slice(0,10);}
function addDays(v,days){const d=new Date(String(v||"")+"T00:00:00Z");if(Number.isNaN(d.getTime()))return null;d.setUTCDate(d.getUTCDate()+Number(days));return d.toISOString().slice(0,10);}
function endOfBillingMonth(v,months){const d=new Date(String(v||"")+"T00:00:00Z");if(Number.isNaN(d.getTime()))return null;return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+Math.max(1,Number(months)||1),0)).toISOString().slice(0,10);}
async function renewalExpirationDate(durationMonths,query=db.query){
 const result=await query("SELECT value FROM app_settings WHERE key='billing_cycle_type' LIMIT 1");
 const configured=String(result.rows[0]?.value||"");
 const today=new Date().toISOString().slice(0,10),months=Math.max(1,Number(durationMonths)||1);
 if(configured==="rolling_30")return addDays(today,30*months);
 if(configured==="monthly_1st")return endOfBillingMonth(today,months);
 // Preserve the historic date-to-date monthly calculation until the admin explicitly saves a cycle policy.
 return addCalendarMonths(today,months);
}
async function getCustomerPackage(username){const r=await db.query("SELECT c.*,p.plan_name,p.pool_name,p.price,p.duration_months,p.profile_name FROM customers c LEFT JOIN packages p ON LOWER(p.plan_name)=LOWER(c.package_name) WHERE LOWER(c.username)=LOWER($1) LIMIT 1",[username]);return r.rows[0]||null;}
async function renewCustomer(c,{persist=true,query=db.query,onRouterMutation=()=>{}}={}){const expiration=await renewalExpirationDate(c.duration_months,query),profile=c.profile_name||c.profile,pool=c.pool_name||"",comment="Customer: "+c.full_name+" | Phone: "+c.phone+" | EXP: "+expiration;await mikrotikService.updateSecret(c.username,{password:c.password,profile,comment,disabled:false});onRouterMutation();await mikrotikService.kickActiveUser(c.username);const renewal={expiration,profile,pool,comment};if(persist)await persistCustomerRenewal(query,c,renewal);return renewal;}
async function persistCustomerRenewal(query,c,renewal){await query("UPDATE customers SET package_name=$1,profile=$2,monthly_bill=$3,expiration_date=$4,status='active',updated_at=NOW() WHERE id=$5",[c.plan_name,renewal.profile,c.price,renewal.expiration,c.id]);await query("UPDATE pppoe_users SET profile=$1,remote_address=$2,disabled=false,status='active',expiry_date=$3,comment=$4,updated_at=NOW() WHERE username=$5",[renewal.profile,renewal.pool,renewal.expiration,renewal.comment,c.username]);}
async function webhook(req,res){
 let claimedTransactionId=null,routerSucceeded=false;
 try{
  const configured=await db.query("SELECT key,value FROM app_settings WHERE key IN ('personal_payment_webhook_enabled','personal_payment_webhook_secret','mfs_bkash_number','mfs_nagad_number','mfs_rocket_number','mfs_upay_number')");
  const settings=Object.fromEntries((configured.rows||[]).map(row=>[row.key,row.value]));
  if(String(settings.personal_payment_webhook_enabled||"").toLowerCase()!=="true")return res.status(403).json({success:false,error:"Automation disabled",message:"Personal payment webhook automation is disabled in Hotspot Webhook Settings."});
  const expected=String(settings.personal_payment_webhook_secret||"").trim();
  const provided=String((req.get("x-webhook-token")||req.get("x-macrodroid-token")||req.body?.token||req.body?.secret||req.query?.token)||"").trim();
  if(!expected||!provided||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!require("crypto").timingSafeEqual(Buffer.from(provided),Buffer.from(expected)))return res.status(401).json({success:false,error:"Unauthorized webhook."});
  const payment=parseSms(req.body,req.query,req.headers,{recipientNumbers:{bkash:settings.mfs_bkash_number,nagad:settings.mfs_nagad_number,rocket:settings.mfs_rocket_number,upay:settings.mfs_upay_number}});
  payment.trxId=String(payment.trxId||"").trim().toUpperCase();
  if(!payment.trxId)return res.status(400).json({success:false,error:"A valid TrxID is required."});
  const existing=await db.query("SELECT id,status,used FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1",[payment.trxId]);
  // Never mutate the original transaction when MacroDroid retries delivery.
  if(existing.rows.length)return res.json({success:true,status:"duplicate_ignored",code:"DUPLICATE_IGNORED",trx_id:payment.trxId,alreadyUsed:Boolean(existing.rows[0].used)});
  let user=null;
  if(payment.customerRef){
   const found=await db.query("SELECT username FROM pppoe_users WHERE LOWER(username)=LOWER($1) OR id::text=$1 LIMIT 1",[payment.customerRef]);
   user=found.rows[0]||null;
  }
  if(!user&&payment.senderPhone){
   const found=await db.query("SELECT username,phone FROM pppoe_users WHERE phone IS NOT NULL");
   user=found.rows.find(row=>normalizePhone(row.phone)===payment.senderPhone)||null;
  }
  let status="unmatched";
  if(user){
   const customer=await getCustomerPackage(user.username);
   if(customer&&customer.plan_name){
    const expectedAmount=Number(customer.price||0);
    if(moneyCents(payment.amount)!==moneyCents(expectedAmount)){
     await db.query("INSERT INTO transactions(channel,trx_id,sender_phone,amount,status,matched_username,raw_sms,used) VALUES($1,$2,$3,$4,'unmatched',$5,$6,false)",[payment.channel,payment.trxId,payment.senderPhone,payment.amount,user.username,payment.rawSms]);
     return res.status(400).json({success:false,message:`Payment rejected. Exact bill amount of ৳${expectedAmount.toFixed(2)} is required to activate or renew service.`,expectedAmount,paidAmount:payment.amount});
    }
    // Persist the claim before calling RouterOS. The unique TrxID constraint arbitrates concurrent webhook retries.
    let claim;
    try{
     claim=await db.query("INSERT INTO transactions(channel,trx_id,sender_phone,amount,status,matched_username,raw_sms,used,claimed_at,claimed_by,claim_flow) VALUES($1,$2,$3,$4,'processing',$5,$6,true,NOW(),$5,'pppoe') RETURNING id",[payment.channel,payment.trxId,payment.senderPhone,payment.amount,user.username,payment.rawSms]);
    }catch(claimError){
     if(claimError?.code==="23505")return res.status(409).json({success:false,status:"duplicate",error:"This TrxID has already been received or claimed."});
     throw claimError;
    }
    if(!claim.rows.length)throw new Error("Could not persist the payment claim.");
    claimedTransactionId=claim.rows[0].id;
    const renewal=await renewCustomer(customer,{persist:false,onRouterMutation:()=>{routerSucceeded=true;}});
    await db.withTransaction(async client=>{
     await persistCustomerRenewal(client.query.bind(client),customer,renewal);
     const finalized=await client.query("UPDATE transactions SET status='PAID',used=true,matched_username=$1,needs_reconciliation=false WHERE id=$2 AND status='processing' AND used=true RETURNING id",[user.username,claimedTransactionId]);
     if(!finalized.rows.length)throw new Error("Renewal completed but payment finalization did not update the claimed transaction.");
    });
    claimedTransactionId=null;
    // SMS delivery is best-effort and must never delay or roll back a verified payment.
    Promise.resolve().then(()=>require("../services/smsService").sendNotification({to:customer.phone,message:"Payment received: Tk "+Number(payment.amount).toFixed(2)+". TrxID "+payment.trxId+". Your FAZ NETWORK service has been renewed.",event:"payment_receipt",variables:{name:customer.full_name||customer.name||customer.username,username:customer.username,amount:payment.amount,gateway:payment.channel,trx_id:payment.trxId,new_expiry_date:renewal.expiration}})).catch(error=>console.warn("[SMS] Payment receipt notification failed:",error.message));
    return res.json({success:true,status:"PAID",trx_id:payment.trxId,customerRef:payment.customerRef,matched_username:user.username,amount:payment.amount,channel:payment.channel});
   }
  }
  const renewalCompleted=status==="PAID";
  await db.query("INSERT INTO transactions(channel,trx_id,sender_phone,amount,status,matched_username,raw_sms,used) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",[payment.channel,payment.trxId,payment.senderPhone,payment.amount,status,renewalCompleted&&user?user.username:null,payment.rawSms,renewalCompleted]);
  return res.json({success:true,status,trx_id:payment.trxId,customerRef:payment.customerRef,matched_username:user?user.username:null,amount:payment.amount,channel:payment.channel});
 }catch(error){
  if(claimedTransactionId!==null&&!routerSucceeded){
   try{await db.query("UPDATE transactions SET status='unmatched',used=false,matched_username=NULL,claimed_at=NULL,claimed_by=NULL,claim_flow=NULL,needs_reconciliation=false WHERE id=$1 AND status='processing' AND used=true",[claimedTransactionId]);}
   catch(rollbackError){console.error("[Payment Webhook] Failed to release claim after RouterOS failure",claimedTransactionId,rollbackError?.message||rollbackError);}
  }else if(claimedTransactionId!==null&&routerSucceeded){
   const detail={flow:"pppoe",transactionId:claimedTransactionId,trxId:req.body?.trxId||req.body?.trx_id||null,error:error?.message||String(error),recordedAt:new Date().toISOString()};
   try{await db.query("UPDATE transactions SET needs_reconciliation=true WHERE id=$1 AND status='processing' AND used=true",[claimedTransactionId]);await db.query("INSERT INTO payment_reconciliation_audit(transaction_id,flow,account_identifier,details) VALUES($1,'pppoe',$2,$3::jsonb)",[claimedTransactionId,String(req.body?.username||""),JSON.stringify(detail)]);}catch(auditError){console.error("[CRITICAL] Webhook reconciliation audit write failed",claimedTransactionId,auditError?.message||auditError);}
   console.error("[CRITICAL_PARTIAL_PROVISION] Webhook PPPoE renewal succeeded on MikroTik but DB finalization failed; transaction remains processing for reconciliation.",detail);
  }
  if(error?.code==="UNTRUSTED_FORWARDER_SENDER"||error?.code==="INVALID_RECIPIENT")return res.status(403).json({success:false,code:error.code,error:error.message});
  return errorResponse(res,error,claimedTransactionId!==null&&routerSucceeded?500:(error?.statusCode||400));
 }
}
async function dynamicWebhook(req,res,next){
 try{
  const configured=await db.query("SELECT key,value FROM app_settings WHERE key IN ('personal_payment_webhook_url')");
  const url=String(configured.rows.find(row=>row.key==="personal_payment_webhook_url")?.value||"").trim();
  if(!url)return next();
  let configuredPath=url;
  try{configuredPath=new URL(url, "http://faznetwork.local").pathname;}catch(_){return next();}
  if(!configuredPath.startsWith("/"))configuredPath="/"+configuredPath;
  if(req.path!==configuredPath)return next();
  return webhook(req,res);
 }catch(error){return errorResponse(res,error,503);}
}
async function list(req,res){
 try{
  const gateway=String(req.query.gateway||req.query.channel||"all").trim().toLowerCase();
  const allowed=["all","bkash","nagad","rocket","upay","pending","requests"];
  if(!allowed.includes(gateway)) return res.status(400).json({success:false,error:"Invalid payment gateway filter."});
  const page=Math.max(1,Number.parseInt(req.query.page||"1",10)||1);
  const limit=Math.min(200,Math.max(1,Number.parseInt(req.query.limit||"50",10)||50));
  const offset=(page-1)*limit;
  const params=[];
  let where="";
  if(["bkash","nagad","rocket","upay"].includes(gateway)){params.push(gateway);where="WHERE channel=$1";}
  else if(gateway==="pending"){where="WHERE status='unmatched' OR (status IN ('processed','PAID') AND used=false)";}
  else if(gateway==="requests"){where="WHERE status='unmatched' AND used=false";}
  const countQuery=await db.query("SELECT COUNT(*)::int AS count FROM transactions "+where,params);
  const total=Number(countQuery.rows[0]?.count||0);
  params.push(limit,offset);
  const querySql="SELECT t.*, CASE WHEN NULLIF(BTRIM(t.matched_username), '') IS NULL THEN 'unassigned' WHEN EXISTS (SELECT 1 FROM pppoe_users pu WHERE LOWER(BTRIM(pu.username))=LOWER(BTRIM(t.matched_username))) OR EXISTS (SELECT 1 FROM customers cu WHERE LOWER(BTRIM(cu.username))=LOWER(BTRIM(t.matched_username))) THEN 'pppoe' WHEN BTRIM(t.matched_username) ~ '^01[0-9]{9}$' THEN 'hotspot' ELSE 'unknown' END AS customer_type FROM transactions t "+where.replace("channel", "t.channel").replace("status", "t.status")+" ORDER BY t.created_at DESC, t.id DESC LIMIT $"+(params.length-1)+" OFFSET $"+params.length;
  const r=await db.query(querySql,params);
  const summaryParams=where ? params.slice(0,-2) : [];
  const summary=await db.query("SELECT COALESCE(SUM(amount),0)::numeric AS total_received, COUNT(*)::int AS total_transactions, COUNT(*) FILTER (WHERE status='unmatched')::int AS unmatched_count FROM transactions "+where,summaryParams);
  return res.json({success:true,gateway,page,limit,total,total_pages:Math.max(1,Math.ceil(total/limit)),transactions:r.rows,summary:summary.rows[0]});
 }catch(e){return errorResponse(res,e,503);}
}
async function manualMatch(req,res){
 let claimedTransactionId=null,routerSucceeded=false;
 try{
  const trxId=String(req.body.trxId||req.body.trxid||req.body.txnId||"").trim().toUpperCase();
  const username=String(req.body.username||"").trim();
  if(!trxId||!username)return res.status(400).json({success:false,error:"trxId and username are required."});
  const t=await db.query("SELECT * FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1",[trxId]);
  if(!t.rows.length)return res.status(404).json({success:false,error:"Transaction not found."});
  const tx=t.rows[0],status=String(tx.status||"").trim().toLowerCase();
  if(tx.used===true||["paid","processed","processing","duplicate"].includes(status))return res.status(409).json({success:false,error:"This transaction has already been claimed or processed and cannot be manually matched."});
  if(status!=="unmatched")return res.status(409).json({success:false,error:"Only unmatched transactions can be manually matched."});
  const user=await db.query("SELECT username FROM pppoe_users WHERE LOWER(username)=LOWER($1) LIMIT 1",[username]);
  if(!user.rows.length)return res.status(404).json({success:false,error:"PPPoE customer not found."});
  const customer=await getCustomerPackage(user.rows[0].username);
  if(!customer||!customer.plan_name)return res.status(400).json({success:false,error:"Customer has no linked billing package."});
  const expected=Number(customer.price||0);
  if(moneyCents(tx.amount)!==moneyCents(expected))return res.status(400).json({success:false,message:"Payment rejected. Exact bill amount of ৳"+expected.toFixed(2)+" is required to activate or renew service.",expectedAmount:expected,paidAmount:Number(tx.amount)});
  const claim=await db.query("UPDATE transactions SET status='processing',used=true,claimed_at=NOW(),claimed_by=$1,claim_flow='pppoe',matched_username=$1 WHERE id=$2 AND (used=false OR used IS NULL) AND LOWER(TRIM(status))='unmatched' RETURNING id",[user.rows[0].username,tx.id]);
  if(!claim.rows.length)return res.status(409).json({success:false,error:"This transaction has already been claimed by another request."});
  claimedTransactionId=tx.id;
  const renewal=await renewCustomer(customer,{persist:false,onRouterMutation:()=>{routerSucceeded=true;}});
  await db.withTransaction(async client=>{
   await persistCustomerRenewal(client.query.bind(client),customer,renewal);
   const finalized=await client.query("UPDATE transactions SET status='PAID',matched_username=$1,used=true,needs_reconciliation=false WHERE id=$2 AND status='processing' AND used=true RETURNING id",[user.rows[0].username,tx.id]);
   if(!finalized.rows.length)throw new Error("Renewal completed but payment finalization did not update the claimed transaction.");
  });
  claimedTransactionId=null;
  return res.json({success:true,trxId:tx.trx_id,username:user.rows[0].username,expiration:renewal.expiration,message:"Exact payment accepted; customer renewed and MikroTik service activated."});
 }catch(e){
  if(claimedTransactionId!==null&&!routerSucceeded){
   try{const rollback=await db.query("UPDATE transactions SET status='unmatched',used=false,matched_username=NULL,claimed_at=NULL,claimed_by=NULL,claim_flow=NULL,needs_reconciliation=false WHERE id=$1 AND status='processing' AND used=true RETURNING id",[claimedTransactionId]);if(!rollback.rows.length)console.error("[Manual Match] Claim rollback found no processing row for transaction",claimedTransactionId);}
   catch(rollbackError){console.error("[Manual Match] Failed to rollback transaction claim",claimedTransactionId,rollbackError?.message||rollbackError);}
  }else if(claimedTransactionId!==null&&routerSucceeded){
   console.error("[CRITICAL_PARTIAL_PROVISION] Manual PPPoE renewal succeeded on MikroTik but DB finalization failed; transaction remains processing for reconciliation.",{transactionId:claimedTransactionId,username:req.body?.username,error:e?.message||String(e)});
  }
  console.error("[Manual Match] Renewal failed:",e?.message||e);
  return errorResponse(res,e,500);
 }
}
async function summary(req,res){try{const r=await db.query("SELECT COALESCE(SUM(amount),0) AS today_collection,COUNT(*) FILTER(WHERE status IN ('processed','PAID')) AS processed_today FROM transactions WHERE created_at::date=CURRENT_DATE");const recent=await db.query("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 8");res.json({success:true,summary:r.rows[0],recent:r.rows});}catch(e){return errorResponse(res,e,503);}}

const verifyBuckets=new Map();
function rateLimit(key){const now=Date.now();const bucket=verifyBuckets.get(key)||{start:now,count:0};if(now-bucket.start>60000){bucket.start=now;bucket.count=0;}bucket.count++;verifyBuckets.set(key,bucket);return bucket.count<=10;}
async function verifyTrx(req,res){
 const body=req.body&&typeof req.body==="object"?req.body:{}, query=req.query&&typeof req.query==="object"?req.query:{};
 const fail=(status,code,message,extra={})=>res.status(status).json({success:false,code,error:message,message,...extra});
 if(!rateLimit(String(req.ip||"unknown")))return fail(429,"RATE_LIMITED","Too many verification attempts. Try again later.");
 let claimedTransactionId=null,routerSucceeded=false;
 try{
  const phone=normalizePhone(body.username||body.phone||body.customer_phone||body.user||"");
  if(!/^01\d{9}$/.test(phone))return fail(400,"INVALID_ACCOUNT_PHONE","Enter a valid 11-digit Hotspot account phone/username.");
  const cleanTrx=String(body.trxId||body.trx_id||body.transaction_id||body.trx||body.txnid||query.trxId||"").trim().toUpperCase();
  if(!cleanTrx)return fail(400,"TRXID_REQUIRED","TrxID/TxnID is required.");
  const found=await db.query("SELECT * FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1",[cleanTrx]);
  if(!found.rows.length)return fail(404,"NOT_FOUND_OR_DELAYED","Transaction not found yet. Wait for the SMS forwarder and try again.");
  const tx=found.rows[0],status=String(tx.status||"").trim().toLowerCase();
  if(tx.used===true||["processing","processed","paid","duplicate"].includes(status))return fail(409,"ALREADY_CLAIMED","This TrxID has already been used or is being processed.");
  if(status!=="unmatched")return fail(409,"TRANSACTION_NOT_ELIGIBLE","This transaction is not eligible for Hotspot verification.");
  const method=String(body.paymentMethod||body.gateway||"").trim().toLowerCase();
  if(method&&["bkash","nagad","rocket","upay"].includes(method)&&String(tx.channel||"").toLowerCase()!==method)return fail(400,"PAYMENT_METHOD_MISMATCH","Select the payment method used for this TrxID.");
  const amount=Number(tx.amount),requestedAmount=Number(body.amount);
  if(!Number.isFinite(requestedAmount)||requestedAmount<=0||moneyCents(requestedAmount)!==moneyCents(amount))return fail(400,"AMOUNT_MISMATCH","The paid amount does not match the selected package price.");
  const requestedProfile=String(body.profile_id||body.profileId||body.package_id||body.packageId||"").trim();
  if(!requestedProfile)return fail(400,"PROFILE_REQUIRED","Select a specific Hotspot package before verifying payment.");
  const metaResult=await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");
  let profileMetadata={};try{profileMetadata=JSON.parse(metaResult.rows[0]?.value||"{}");}catch(_){}
  if(!profileMetadata||typeof profileMetadata!=="object"||Array.isArray(profileMetadata))profileMetadata={};
  const profiles=await mikrotikService.getHotspotProfiles();
  const matches=profiles.filter(item=>profileIdentifierMatches(String(item.name||""),profileMetadata[String(item.name||"")]||{},requestedProfile));
  if(matches.length!==1)return fail(400,"PROFILE_NOT_FOUND_OR_AMBIGUOUS","The selected package ID does not map to exactly one active Hotspot profile.");
  const profile=matches[0],metadata=profileMetadata[String(profile.name||"")]||{};
  if(!Number.isFinite(Number(metadata.price))||moneyCents(metadata.price)!==moneyCents(amount))return fail(400,"AMOUNT_MISMATCH","The paid amount does not match the configured price for this exact package.",{expectedAmount:Number(metadata.price)});
  const hc=require("../services/hotspotProfileConfig");let validityConfig;
  try{validityConfig=metadata.validityValue?hc.normalizeProfileValidity(metadata.validityValue,metadata.validityUnit):hc.parseStoredValidity(profile);}catch(_){validityConfig=hc.parseStoredValidity(profile);}
  const validity=String(validityConfig.validity||"").trim();
  if(!validity&&!Number(metadata.limitBytesTotal||validityConfig.limitBytesTotal||0))return fail(400,"PROFILE_INVALID","The selected Hotspot profile has no usable validity or data quota configured.");
  const claim=await db.query("UPDATE transactions SET status='processing',used=true,claimed_at=NOW(),claimed_by=$1,claim_flow='hotspot',matched_username=$1 WHERE id=$2 AND UPPER(TRIM(trx_id))=$3 AND status='unmatched' AND (used=false OR used IS NULL) RETURNING id",[phone,tx.id,cleanTrx]);
  if(!claim.rows.length){const latest=await db.query("SELECT status FROM transactions WHERE id=$1",[tx.id]);const ls=String(latest.rows[0]?.status||"").toLowerCase();return fail(409,ls==="processing"?"TRANSACTION_IN_PROCESS":"TRANSACTION_ALREADY_USED","Another request has claimed this TrxID. No RouterOS provisioning was attempted.");}
  claimedTransactionId=tx.id;
  const safeProfile=String(profile.name||"").replace(/[|]/g,"").slice(0,80),comment="FAZ|EXP=0|PROF="+safeProfile+"|INIT=1|PROFILE="+safeProfile+"|VALIDITY="+(validity||"0")+"|CHANNEL=PORTAL|TRX="+cleanTrx;
  const oldLogin=String(profile?.raw?.["on-login"]||""),loginScript=buildHotspotOnLoginScript({name:profile.name,sharedUsers:Number(profile.sharedUsers)||1,validityValue:Number(metadata.validityValue||validityConfig.value||1),validityUnit:metadata.validityUnit||validityConfig.unit||"days"}),preserved=oldLogin.trim()&&!oldLogin.includes("FAZ|PROFILE=")?" ; "+oldLogin.trim():"";
  await mikrotikService.updateHotspotProfile({name:profile.name,rateLimit:profile.rateLimit,sharedUsers:Number(profile.sharedUsers)||1,sessionTimeout:validity||"",clearSessionTimeout:false,keepaliveTimeout:profile.keepaliveTimeout,onLogin:loginScript+preserved});
  await mikrotikService.rechargeHotspotUser({username:phone,password:phone,profile:profile.name,validity,limitBytesTotal:Number(metadata.limitBytesTotal||validityConfig.limitBytesTotal||0),comment});routerSucceeded=true;
  if(validity){const voucher=await db.query("UPDATE hotspot_vouchers SET password=$2,profile=$3,validity=$4,price=$5,status='unused',comment=$6,first_login_at=NULL,expires_at=NULL,expired_at=NULL,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,phone=$1,updated_at=NOW() WHERE LOWER(username)=LOWER($1) RETURNING id",[phone,phone,profile.name,validity,amount,comment]);if(!voucher.rows.length)await db.query("INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment,phone,server) VALUES($1,$2,$3,$4,$5,'unused',$6,$1,'all')",[phone,phone,profile.name,validity,amount,comment]);}
  await db.withTransaction(async client=>{const finalized=await client.query("UPDATE transactions SET status='processed',used=true,matched_username=$1,needs_reconciliation=false WHERE id=$2 AND status='processing' AND used=true RETURNING id",[phone,tx.id]);if(!finalized.rows.length)throw new Error("Hotspot provisioning succeeded but transaction finalization failed.");});
  claimedTransactionId=null;return res.json({success:true,message:"সফল হয়েছে!",username:phone,password:phone,profile:profile.name,profile_id:requestedProfile,validity,amount,loginUrl:body.loginUrl||body.linkLoginOnly||null});
 }catch(e){
  if(claimedTransactionId!==null&&!routerSucceeded){try{await db.query("UPDATE transactions SET status='unmatched',used=false,matched_username=NULL,claimed_at=NULL,claimed_by=NULL,claim_flow=NULL,needs_reconciliation=false WHERE id=$1 AND status='processing' AND used=true",[claimedTransactionId]);}catch(rollbackError){console.error("[VERIFY-TRX] Claim rollback failed",claimedTransactionId,rollbackError?.message||rollbackError);}}
  else if(claimedTransactionId!==null&&routerSucceeded){try{await db.query("UPDATE transactions SET needs_reconciliation=true WHERE id=$1 AND status='processing' AND used=true",[claimedTransactionId]);await db.query("INSERT INTO payment_reconciliation_audit(transaction_id,flow,account_identifier,details) VALUES($1,'hotspot',$2,$3::jsonb)",[claimedTransactionId,String(body.username||body.phone||""),JSON.stringify({flow:"hotspot",transactionId:claimedTransactionId,error:e?.message||String(e),recordedAt:new Date().toISOString()})]);}catch(auditError){console.error("[CRITICAL] Durable reconciliation audit failed",claimedTransactionId,auditError?.message||auditError);}return fail(500,"RECONCILIATION_REQUIRED","Payment is secured but finalization needs administrator reconciliation. Do not retry this TrxID.");}
  const code=e?.code||"ROUTER_ERROR";return fail(e?.statusCode||500,code,e?.message||"Payment verification failed.");
 }
}

module.exports={webhook,dynamicWebhook,list,manualMatch,summary,verifyTrx};
