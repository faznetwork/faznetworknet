const db=require("../db");
const mikrotikService=require("../services/mikrotikService");

const {parseSms}=require("../services/paymentWebhookParser");

function errorResponse(res,error,code=400){console.error("[Payment API]",error);const message=error?.message||"Payment operation failed.";return res.status(code).json({success:false,users:[],profiles:[],transactions:[],message,error:message});}

async function flagStalePaymentClaims(){
 const stale=await db.query("UPDATE transactions SET needs_reconciliation=true WHERE status='processing' AND used=true AND claimed_at < NOW() - INTERVAL '5 minutes' AND needs_reconciliation=false RETURNING id,claim_flow,claimed_by");
 for(const row of stale.rows||[]){
  await db.query("INSERT INTO payment_reconciliation_audit(transaction_id,flow,account_identifier,details) VALUES($1,$2,$3,$4::jsonb)",[row.id,["hotspot","pppoe","webhook"].includes(row.claim_flow)?row.claim_flow:"recovery",row.claimed_by||null,JSON.stringify({reason:"STALE_PROCESSING_CLAIM",thresholdMinutes:5,detectedAt:new Date().toISOString(),action:"flagged_only_not_released"})]);
 }
}
function normalizePhone(value){const bangla="০১২৩৪৫৬৭৮৯";let digits=String(value||"").replace(/[০-৯]/g,ch=>String(bangla.indexOf(ch))).replace(/\D/g,"");if(digits.startsWith("880")&&digits.length===13)digits="0"+digits.slice(3);return digits;}
function normalizeMac(value){
 const raw=String(value||"").trim();
 const compact=raw.replace(/[:-]/g,"");
 if(!/^[0-9a-fA-F]{12}$/.test(compact))return "";
 return compact.match(/.{2}/g).join(":").toUpperCase();
}
function moneyCents(v){const n=Number(v);return Number.isFinite(n)?Math.round(n*100):NaN;}
function hotspotDurationMs(value){
 const source=String(value||"").trim().toLowerCase(),re=/(\d+(?:\.\d+)?)(w|d|h|m|s)/g;
 let match,consumed="",total=0;const factors={w:604800000,d:86400000,h:3600000,m:60000,s:1000};
 while((match=re.exec(source))){consumed+=match[0];total+=Number(match[1])*factors[match[2]];}
 return source&&consumed===source&&Number.isFinite(total)&&total>0?total:0;
}
function dhakaTimestamp(value){
 const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(value);
 const field=type=>parts.find(part=>part.type===type)?.value||"00";
 return field("year")+"-"+field("month")+"-"+field("day")+" "+field("hour")+":"+field("minute")+":"+field("second");
}
function hotspotExpiryComment(value){return "Exp: "+dhakaTimestamp(value);}
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
function calculateHotspotExpiryDate(validityConfig){
 const amount=Number(validityConfig?.value);
 const rawUnit=String(validityConfig?.unit||"").trim().toLowerCase();
 const unit=({s:"second",sec:"second",seconds:"second",m:"minute",min:"minute",mins:"minute",minutes:"minute",h:"hour",hr:"hour",hrs:"hour",hours:"hour",d:"day",days:"day",w:"week",weeks:"week",mo:"month",months:"month",y:"year",years:"year"})[rawUnit]||rawUnit.replace(/s$/,"");
 if(!Number.isFinite(amount)||amount<=0)throw new Error("The selected Hotspot package has an invalid validity duration.");
 // Use Dhaka wall-clock time so the stored date matches the ISP's billing timezone.
 const expiry=new Date(Date.now()+6*60*60*1000);
 const factors={second:1000,minute:60*1000,hour:60*60*1000,day:24*60*60*1000,week:7*24*60*60*1000};
 if(unit==="month"||unit==="year"){
  const day=expiry.getUTCDate();
  expiry.setUTCDate(1);
  if(unit==="month")expiry.setUTCMonth(expiry.getUTCMonth()+amount);
  else expiry.setUTCFullYear(expiry.getUTCFullYear()+amount);
  const lastDay=new Date(Date.UTC(expiry.getUTCFullYear(),expiry.getUTCMonth()+1,0)).getUTCDate();
  expiry.setUTCDate(Math.min(day,lastDay));
 }else if(factors[unit]){
  expiry.setTime(expiry.getTime()+amount*factors[unit]);
 }else{
  throw new Error("Unsupported Hotspot package validity unit: "+rawUnit);
 }
 return expiry.toISOString().slice(0,10);
}
function endOfBillingMonth(v,months){const d=new Date(String(v||"")+"T00:00:00Z");if(Number.isNaN(d.getTime()))return null;return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+Math.max(1,Number(months)||1),0)).toISOString().slice(0,10);}
async function renewalExpirationDate(durationMonths,query=db.query,currentExpiryDate=null){
 const result=await query("SELECT value FROM app_settings WHERE key='billing_cycle_type' LIMIT 1");
 const configured=String(result.rows[0]?.value||"");
 const today=new Date().toISOString().slice(0,10),months=Math.max(1,Number(durationMonths)||1);
 // Stack onto an existing future expiry. Date-only values are compared as ISO calendar dates,
 // avoiding timezone parsing differences between PostgreSQL DATE and JS Date.
 const currentExpiry=String(currentExpiryDate||"").trim().slice(0,10);
 const baseDate=/^\d{4}-\d{2}-\d{2}$/.test(currentExpiry)&&currentExpiry>today?currentExpiry:today;
 if(configured==="rolling_30")return addDays(baseDate,30*months);
 // A paid renewal extends the existing validity; it must not reset a future expiry to this month-end.
 if(configured==="monthly_1st")return addCalendarMonths(baseDate,months);
 // Preserve date-to-date month duration while stacking on any still-valid time.
 return addCalendarMonths(baseDate,months);
}
async function getCustomerPackage(username){const r=await db.query("SELECT c.*,p.plan_name,p.pool_name,p.price,p.duration_months,p.profile_name FROM customers c LEFT JOIN packages p ON LOWER(p.plan_name)=LOWER(c.package_name) WHERE LOWER(c.username)=LOWER($1) LIMIT 1",[username]);return r.rows[0]||null;}
async function renewCustomer(c,{persist=true,query=db.query,onRouterMutation=()=>{}}={}){const expiration=await renewalExpirationDate(c.duration_months,query,c.expiration_date||c.expiry_date),profile=c.profile_name||c.profile,pool=c.pool_name||"",comment="Customer: "+c.full_name+" | Phone: "+c.phone+" | EXP: "+expiration;await mikrotikService.updateSecret(c.username,{password:c.password,profile,comment,disabled:false});onRouterMutation();await mikrotikService.kickActiveUser(c.username);const renewal={expiration,profile,pool,comment};if(persist)await persistCustomerRenewal(query,c,renewal);return renewal;}
async function persistCustomerRenewal(query,c,renewal){await query("UPDATE customers SET package_name=$1,profile=$2,monthly_bill=$3,expiration_date=$4,status='active',updated_at=NOW() WHERE id=$5",[c.plan_name,renewal.profile,c.price,renewal.expiration,c.id]);await query("UPDATE pppoe_users SET profile=$1,remote_address=$2,disabled=false,status='active',expiry_date=$3,comment=$4,updated_at=NOW() WHERE username=$5",[renewal.profile,renewal.pool,renewal.expiration,renewal.comment,c.username]);}
const webhookQuarantineBuckets=new Map();
function allowWebhookQuarantine(req) {
 const key=String(req.ip||req.socket?.remoteAddress||"unknown"),now=Date.now();
 const bucket=webhookQuarantineBuckets.get(key)||{startedAt:now,count:0};
 if(now-bucket.startedAt>=60000){bucket.startedAt=now;bucket.count=0;}
 bucket.count++;
 webhookQuarantineBuckets.set(key,bucket);
 if(webhookQuarantineBuckets.size>5000){
  for(const [ip,item] of webhookQuarantineBuckets)if(now-item.startedAt>=60000)webhookQuarantineBuckets.delete(ip);
 }
 return bucket.count<=30;
}
function sanitizeWebhookPayload(value,depth=0) {
 if(depth>6)return "[max-depth]";
 if(typeof value==="string")return value.slice(0,4096);
 if(Array.isArray(value))return value.slice(0,100).map(item=>sanitizeWebhookPayload(item,depth+1));
 if(value&&typeof value==="object"){
  const clean={};
  for(const [key,item] of Object.entries(value).slice(0,100)){
   if(/token|secret|authorization/i.test(key))continue;
   clean[key.slice(0,100)]=sanitizeWebhookPayload(item,depth+1);
  }
  return clean;
 }
 if(value===null||typeof value==="number"||typeof value==="boolean")return value;
 return String(value).slice(0,1024);
}
async function saveUnmatchedWebhook(req,reason) {
 if(!allowWebhookQuarantine(req)){
  const error=new Error("Webhook quarantine rate limit exceeded.");
  error.code="WEBHOOK_QUARANTINE_RATE_LIMIT";
  throw error;
 }
 const body=req.body&&typeof req.body==="object"?req.body:{rawBody:req.body??null};
 const serialized=JSON.stringify(sanitizeWebhookPayload(body)??{});
 const payloadBytes=Buffer.byteLength(serialized,"utf8");
 const storedPayload=payloadBytes>16384?JSON.stringify({truncated:true,payloadBytes,preview:serialized.slice(0,12000)}):serialized;
 await db.query(
  "INSERT INTO payment_webhook_quarantine(status,rejection_code,raw_payload) VALUES('unmatched',$1,$2::jsonb)",
  [String(reason||"WEBHOOK_REJECTED").slice(0,80),storedPayload]
 );
 return payloadBytes;
}
async function quarantineWebhookResponse(req,res,reason) {
 try{
  const payloadBytes=await saveUnmatchedWebhook(req,reason);
  console.log("[Payment Webhook] Stored rejected SMS as unmatched.",{reason,payloadBytes});
  return res.status(202).json({success:true,status:"unmatched",code:"WEBHOOK_QUARANTINED",reason});
 }catch(error){
  if(error?.code==="WEBHOOK_QUARANTINE_RATE_LIMIT")return res.status(429).json({success:false,status:"unmatched",code:error.code});
  console.error("[Payment Webhook] Could not store rejected SMS.",{reason,error:error?.message||String(error)});
  return res.status(503).json({success:false,status:"unmatched",code:"WEBHOOK_QUARANTINE_FAILED"});
 }
}
async function webhook(req,res){
 let claimedTransactionId=null,routerSucceeded=false;
 try{
  const configured=await db.query("SELECT key,value FROM app_settings WHERE key IN ('personal_payment_webhook_enabled','personal_payment_webhook_secret','mfs_bkash_number','mfs_nagad_number','mfs_rocket_number','mfs_upay_number')");
  const settings=Object.fromEntries((configured.rows||[]).map(row=>[row.key,row.value]));
  let webhookConfig={secret:String(settings.personal_payment_webhook_secret||""),senders:require("../services/paymentWebhookParser").OFFICIAL_SENDERS,recipients:{bkash:settings.mfs_bkash_number,nagad:settings.mfs_nagad_number,rocket:settings.mfs_rocket_number,upay:settings.mfs_upay_number}};
  // Do not let a settings-table bootstrap failure turn a disabled legacy webhook into HTTP 400.
  // Existing app_settings remain a safe compatibility fallback while the singleton table initializes.
  try { webhookConfig=await require("../services/webhookSettingsService").get(); }
  catch(error) { console.error("[Payment Webhook] Could not load webhook_settings; using legacy configuration fallback:", error.message); }
  if(String(settings.personal_payment_webhook_enabled||"").toLowerCase()!=="true"){
    console.log("[Payment Webhook] Rejected: automation disabled.");
    return res.status(403).json({success:false,error:"Automation disabled",message:"Personal payment webhook automation is disabled in Hotspot Webhook Settings."});
   }
  const expected=String(webhookConfig.secret||settings.personal_payment_webhook_secret||"").trim();
  const provided=String((req.get("x-webhook-token")||req.get("x-macrodroid-token")||req.body?.token||req.body?.secret||req.query?.token)||"").trim();
  if(!expected||!provided||Buffer.byteLength(provided)!==Buffer.byteLength(expected)||!require("crypto").timingSafeEqual(Buffer.from(provided),Buffer.from(expected))){
    const reason=expected?"INVALID_WEBHOOK_TOKEN":"WEBHOOK_TOKEN_NOT_CONFIGURED";
    console.log("[Payment Webhook] Token validation failed; quarantining payload as unmatched.",{reason});
    return quarantineWebhookResponse(req,res,reason);
   }
  // MacroDroid's receiving-number token describes the SIM that received the SMS, not
  // the MFS merchant account mentioned in the payment. Validate only a recipient
  // explicitly present in the SMS text or a dedicated recipient header/query value.
  const webhookBody=req.body&&typeof req.body==="object"&&!Array.isArray(req.body)?{...req.body}:req.body;
  if(webhookBody&&typeof webhookBody==="object")for(const key of ["recipient","recipient_phone","receiving_number","receiver","destination","to","merchant_number","account_number"])delete webhookBody[key];
  const payment=parseSms(webhookBody,req.query,req.headers,{recipientNumbers:webhookConfig.recipients,senderIdentifiers:webhookConfig.senders});
  payment.trxId=String(payment.trxId||"").trim().toUpperCase();
  if(!payment.trxId)return res.status(400).json({success:false,error:"A valid TrxID is required."});
  const existing=await db.query("SELECT id,status,used FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1",[payment.trxId]);
  // Never mutate the original transaction when MacroDroid retries delivery.
  if(existing.rows.length)return res.json({success:true,status:"duplicate_ignored",code:"DUPLICATE_IGNORED",trx_id:payment.trxId,alreadyUsed:Boolean(existing.rows[0].used)});
  const serviceType=String(req.body?.service_type||req.body?.serviceType||req.query?.service_type||req.query?.serviceType||"").trim().toLowerCase();
  let user=null;
  // A Hotspot-originated payment is isolated from PPPoE resolvers by contract.
  // Generic SMS events have no trusted service context, so phone-only matches stay unmatched
  // until the customer explicitly verifies the TrxID in the correct service flow.
  if(serviceType!=="hotspot"&&serviceType==="pppoe"&&payment.customerRef){
   const found=await db.query("SELECT username FROM pppoe_users WHERE LOWER(username)=LOWER($1) OR id::text=$1 LIMIT 1",[payment.customerRef]);
   user=found.rows[0]||null;
  }
  if(!user&&serviceType==="pppoe"&&payment.senderPhone){
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
    require("../services/notificationDispatcher").dispatchNotification({userType:"pppoe",event:"payment",customer,to:customer.phone||customer.mobile||customer.account_phone||customer.mobile_number||customer.contact_no,username:customer.username,message:"Payment received: Tk "+Number(payment.amount).toFixed(2)+". TrxID "+payment.trxId+". Your FAZ NETWORK service has been renewed.",variables:{name:customer.full_name||customer.fullName||customer.name||customer.username,username:customer.username,amount:payment.amount,gateway:payment.channel,trx_id:payment.trxId,new_expiry_date:renewal.expiration}});
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
  if(error?.code==="UNTRUSTED_FORWARDER_SENDER"||error?.code==="INVALID_RECIPIENT"){
    return quarantineWebhookResponse(req,res,error.code);
   }
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
async function manualMatchHotspot(req,res,tx,trxId){
 let claimedTransactionId=null;
 try{
  const phone=normalizePhone(req.body.phone||req.body.customer_phone||tx.sender_phone||"");
  const requestedProfile=String(req.body.package_id||req.body.profile_id||req.body.packageId||"").trim();
  if(!/^01[0-9]{9}$/.test(phone))return res.status(400).json({success:false,error:"A valid 11-digit Bangladesh mobile number is required."});
  if(!requestedProfile)return res.status(400).json({success:false,error:"Select a Hotspot package."});
  const metaResult=await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");
  let metadataMap={};try{metadataMap=JSON.parse(metaResult.rows[0]?.value||"{}");}catch(_){}
  if(!metadataMap||typeof metadataMap!=="object"||Array.isArray(metadataMap))metadataMap={};
  let routerProfiles=[];try{routerProfiles=await mikrotikService.getHotspotProfiles();}catch(_){}
  const profiles=routerProfiles.length?routerProfiles:Object.keys(metadataMap).map(name=>({name,sharedUsers:"1",sessionTimeout:"",raw:{}}));
  const matches=profiles.filter(item=>item.name&&String(item.name).toLowerCase()!=="default"&&profileIdentifierMatches(String(item.name),metadataMap[String(item.name)]||{},requestedProfile));
  if(matches.length!==1)return res.status(400).json({success:false,error:"The selected Hotspot package is not available or maps to multiple profiles."});
  const profile=matches[0],metadata=metadataMap[String(profile.name)]||{},amount=Number(tx.amount);
  if(!Number.isFinite(Number(metadata.price))||moneyCents(metadata.price)!==moneyCents(amount))return res.status(400).json({success:false,error:"The selected Hotspot package price must exactly match the transaction amount.",expectedAmount:Number(metadata.price),paidAmount:amount});
  const hc=require("../services/hotspotProfileConfig");
  let validityConfig;
  try{validityConfig=metadata.validityValue?hc.normalizeProfileValidity(metadata.validityValue,metadata.validityUnit):hc.parseStoredValidity(profile);}catch(_){validityConfig=hc.parseStoredValidity(profile);}
  const validity=String(validityConfig.validity||"").trim(),quota=Number(metadata.limitBytesTotal||validityConfig.limitBytesTotal||0);
  if(!validity&&!quota)return res.status(400).json({success:false,error:"The selected Hotspot package has no usable validity or data quota."});
  const claim=await db.query("UPDATE transactions SET status='processing',used=true,claimed_at=NOW(),claimed_by=$1,claim_flow='manual_hotspot',matched_username=$2 WHERE id=$3 AND (used=false OR used IS NULL) AND LOWER(TRIM(status))='unmatched' RETURNING id",["manual_hotspot:"+String(req.user?.id||req.session?.userId||"admin"),phone,tx.id]);
  if(!claim.rows.length)return res.status(409).json({success:false,error:"This transaction has already been claimed by another request."});
  claimedTransactionId=claim.rows[0].id??tx.id;
  const profileId=String(metadata.id||metadata.profileId||metadata.profile_id||metadata.packageId||metadata.package_id||metadata.packageName||metadata.package_name||metadata.alias||requestedProfile);
  const pendingComment="FAZ|PENDING|PROFILE="+profile.name;
  let voucher=null,wasRecharge=false;
  await db.withTransaction(async client=>{
   await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-phone:"+phone]);
   const records=await client.query("SELECT * FROM hotspot_vouchers WHERE REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($1,'880'||SUBSTRING($1 FROM 2)) ORDER BY id DESC FOR UPDATE",[phone]);
   const rows=records.rows||[],boundMacs=[...new Set(rows.map(row=>normalizeMac(row.mac_address)||normalizeMac(row.username)).filter(Boolean))];
   if(boundMacs.length>1)throw Object.assign(new Error("This phone has conflicting MAC bindings; an administrator must reconcile the account."),{statusCode:409,code:"ACCOUNT_MAC_CONFLICT"});
   const boundMac=boundMacs[0]||null,live=rows.filter(row=>["pending_claim","unused","active"].includes(String(row.status||"").toLowerCase())&&!(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()));
   if(live.length>1)throw Object.assign(new Error("Multiple live Hotspot packages are linked to this phone. Reconcile the account before assigning payment."),{statusCode:409,code:"MULTIPLE_LIVE_PACKAGES"});
   const target=(boundMac?rows.find(row=>(normalizeMac(row.mac_address)||normalizeMac(row.username))===boundMac):null)||live[0]||rows[0]||null;
   wasRecharge=live.length>0;
   const username=boundMac||(target&&String(target.username||"").trim()&&!String(target.username).startsWith("PENDING-")?String(target.username).trim():"PENDING-"+(phone||("TX-"+tx.id)));
   const priorExpiry=target?.expires_at?new Date(target.expires_at):null,packageDuration=hotspotDurationMs(validity);
   const stackedExpiry=Boolean(target&&["active","pending_claim"].includes(String(target.status||"").toLowerCase())&&priorExpiry&&!Number.isNaN(priorExpiry.getTime())&&priorExpiry.getTime()>Date.now()&&packageDuration>0);
   const nextExpiry=stackedExpiry?new Date(priorExpiry.getTime()+packageDuration):null,stagedComment=nextExpiry?hotspotExpiryComment(nextExpiry):pendingComment;
   const params=[username,phone,profile.name,validity,amount,stagedComment,phone,validity||null,quota?String(quota):null,profileId,boundMac];
   if(target){
    const updated=await client.query("UPDATE hotspot_vouchers SET username=$1,password=$2,profile=$3,validity=$4,price=$5,status='pending_claim',comment=$6::text,phone=COALESCE(NULLIF($7::text,''),NULLIF(phone,''),'Unlinked'),server=COALESCE(NULLIF(server,''),'all'),time_limit=$8,data_limit=$9,profile_id=$10,mac_address=$11,first_login_at=$12,expires_at=$13,expired_at=NULL,pre_expiry_notified=false,transaction_id=$14,renewal_stacked=$15,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$16 RETURNING id,username,profile,profile_id,validity,price,status,phone,mac_address,transaction_id",[...params,stackedExpiry?target.first_login_at:null,nextExpiry,claimedTransactionId,stackedExpiry,target.id]);
    voucher=updated.rows?.[0];
   }else{
    const inserted=await client.query("INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment,phone,server,time_limit,data_limit,profile_id,mac_address,cleanup_status,transaction_id,renewal_stacked) VALUES($1,$2,$3,$4,$5,'pending_claim',$6,$7,'all',$8,$9,$10,$11,'not_required',$12,false) RETURNING id,username,profile,profile_id,validity,price,status,phone,mac_address,transaction_id",[...params,claimedTransactionId]);
    voucher=inserted.rows?.[0];
   }
   if(!voucher)throw new Error("Hotspot voucher could not be saved.");
   await client.query("INSERT INTO hotspot_voucher_payments(transaction_id,voucher_id,phone,amount) VALUES($1,$2,$3,$4) ON CONFLICT(transaction_id) DO UPDATE SET voucher_id=EXCLUDED.voucher_id,phone=EXCLUDED.phone,amount=EXCLUDED.amount",[claimedTransactionId,voucher.id,phone,amount]);
   const finalized=await client.query("UPDATE transactions SET status='processed',used=true,matched_username=$1,needs_reconciliation=false WHERE id=$2 AND status='processing' AND used=true RETURNING id",[phone,claimedTransactionId]);
   if(!finalized.rows?.length)throw new Error("Voucher was staged but the claimed transaction could not be finalized.");
  });
  claimedTransactionId=null;
  require("../services/notificationDispatcher").dispatchNotification({userType:"hotspot",event:wasRecharge?"recharge":"payment",to:phone,username:phone,message:"Your FAZ NETWORK Hotspot payment has been manually assigned. Package: "+profile.name+". Amount: Tk "+amount+".",variables:{name:phone,username:phone,amount,profile:profile.name,gateway:tx.channel,trx_id:tx.trx_id}});
  if(!wasRecharge)require("../services/notificationDispatcher").dispatchNotification({userType:"hotspot",event:"welcome",to:phone,username:phone,message:"Welcome to FAZ NETWORK. Your Hotspot package "+profile.name+" is ready to activate on first Wi-Fi login.",variables:{name:phone,username:phone,amount,profile:profile.name,expiry_date:""}});
  return res.json({success:true,service_type:"hotspot",trxId:tx.trx_id,phone,package:profile.name,voucher,pending_activation:true,message:"Transaction assigned. Hotspot package is staged in PostgreSQL and will activate on the customer's first Wi-Fi login."});
 }catch(e){
  if(claimedTransactionId!==null)try{await db.query("UPDATE transactions SET status='unmatched',used=false,matched_username=NULL,claimed_at=NULL,claimed_by=NULL,claim_flow=NULL,needs_reconciliation=false WHERE id=$1 AND status='processing' AND used=true",[claimedTransactionId]);}catch(rollbackError){console.error("[Manual Hotspot Match] Claim rollback failed",claimedTransactionId,rollbackError?.message||rollbackError);}
  console.error("[Manual Hotspot Match] Assignment failed:",e?.message||e);
  return res.status(e?.statusCode||500).json({success:false,code:e?.code||"MANUAL_HOTSPOT_MATCH_FAILED",error:e?.message||"Hotspot assignment failed."});
 }
}

async function manualMatch(req,res){
 let claimedTransactionId=null,routerSucceeded=false;
 try{
  const trxId=String(req.body.trxId||req.body.trxid||req.body.txnId||"").trim().toUpperCase();
  const serviceType=String(req.body.service_type||req.body.serviceType||"pppoe").trim().toLowerCase();
  const username=String(req.body.username||"").trim();
  if(!trxId||!["pppoe","hotspot"].includes(serviceType)||(serviceType==="pppoe"&&!username))return res.status(400).json({success:false,error:"trxId and a valid service_type are required; PPPoE assignments also require username."});
  const t=await db.query("SELECT * FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1",[trxId]);
  if(!t.rows.length)return res.status(404).json({success:false,error:"Transaction not found."});
  const tx=t.rows[0],status=String(tx.status||"").trim().toLowerCase();
  if(tx.used===true||["paid","processed","processing","duplicate"].includes(status))return res.status(409).json({success:false,error:"This transaction has already been claimed or processed and cannot be manually matched."});
  if(status!=="unmatched")return res.status(409).json({success:false,error:"Only unmatched transactions can be manually matched."});
  if(serviceType==="hotspot")return await manualMatchHotspot(req,res,tx,trxId);
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
  require("../services/notificationDispatcher").dispatchNotification({userType:"pppoe",event:"renewal",to:customer.phone,username:user.rows[0].username,message:"Your FAZ NETWORK service renewal is complete. New expiry: "+String(renewal.expiration||"")+".",variables:{name:customer.full_name||customer.name||user.rows[0].username,username:user.rows[0].username,amount:tx.amount,gateway:tx.channel,trx_id:tx.trx_id,new_expiry_date:renewal.expiration}});
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

async function forceProvisionHotspot(req,res){
 let claimedTransactionId=null,routerSucceeded=false,originalStatus=null,stagedVoucherId=null,transactionId=null;
 try{
  const body=req.body&&typeof req.body==="object"?req.body:{};
  const trxId=String(body.trxId||body.trx_id||"").trim().toUpperCase();
  const mac=normalizeMac(body.mac||body.mac_address||body.macAddress||"");
  const phoneCandidate=normalizePhone(body.phone||body.sender_phone||"");
  const phone=/^01[0-9]{9}$/.test(phoneCandidate)?phoneCandidate:"";
  const requestedProfile=String(body.package_id||body.profile_id||body.packageId||"").trim();
  if(!trxId)return res.status(400).json({success:false,code:"TRXID_REQUIRED",error:"Transaction TrxID is required."});
  if(!mac)return res.status(400).json({success:false,code:"MAC_REQUIRED",error:"Enter a valid device MAC address before force provisioning."});
  if(!requestedProfile)return res.status(400).json({success:false,code:"PROFILE_REQUIRED",error:"Select a Hotspot package/profile."});
  const found=await db.query("SELECT * FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1",[trxId]);
  if(!found.rows?.length)return res.status(404).json({success:false,code:"TRANSACTION_NOT_FOUND",error:"Payment transaction was not found."});
  const tx=found.rows[0],status=String(tx.status||"").trim().toLowerCase();
  transactionId=tx.id;
  originalStatus=status;
  if(!["unmatched","processing","processed","paid"].includes(status))return res.status(409).json({success:false,code:"TRANSACTION_NOT_ELIGIBLE",error:"Only unmatched, stale processing, or completed payment transactions can be force provisioned."});
  const matchedUsername=String(tx.matched_username||"").trim();
  if(matchedUsername){
   const [pppoe,customer]=await Promise.all([db.query("SELECT username FROM pppoe_users WHERE LOWER(username)=LOWER($1) LIMIT 1",[matchedUsername]),db.query("SELECT username FROM customers WHERE LOWER(username)=LOWER($1) LIMIT 1",[matchedUsername])]);
   if(pppoe.rows?.length||customer.rows?.length)return res.status(409).json({success:false,code:"PPPOE_TRANSACTION",error:"This transaction is linked to a PPPoE subscriber and cannot be force-provisioned as Hotspot."});
  }
  const existingAssociation=await db.query("SELECT hp.voucher_id,v.* FROM hotspot_voucher_payments hp LEFT JOIN hotspot_vouchers v ON v.id=hp.voucher_id WHERE hp.transaction_id=$1::bigint LIMIT 1",[tx.id]);
  let associated=existingAssociation.rows?.[0]||null;
  if(["processed","paid"].includes(status)&&!associated&&!["online_mfs","hotspot"].includes(String(tx.sale_type||"").toLowerCase())&&!["hotspot","manual_hotspot","force_hotspot"].includes(String(tx.claim_flow||"").toLowerCase())&&!/^01[0-9]{9}$/.test(normalizePhone(matchedUsername))){
   return res.status(409).json({success:false,code:"NOT_HOTSPOT_PAYMENT",error:"This completed payment has no Hotspot association. Confirm it is a Hotspot payment before provisioning."});
  }
  const metaResult=await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");
  let metadataMap={};try{metadataMap=JSON.parse(metaResult.rows?.[0]?.value||"{}");}catch(_){}
  if(!metadataMap||typeof metadataMap!=="object"||Array.isArray(metadataMap))metadataMap={};
  let routerProfiles=await mikrotikService.getHotspotProfiles();
  if(!Array.isArray(routerProfiles))routerProfiles=[];
  const profiles=routerProfiles.length?routerProfiles:Object.keys(metadataMap).map(name=>({name,sharedUsers:"1",sessionTimeout:"",raw:{}}));
  const matches=profiles.filter(item=>item?.name&&String(item.name).toLowerCase()!=="default"&&profileIdentifierMatches(String(item.name),metadataMap[String(item.name)]||{},requestedProfile));
  if(matches.length!==1)return res.status(400).json({success:false,code:"PROFILE_NOT_FOUND_OR_AMBIGUOUS",error:"Selected Hotspot profile is unavailable or ambiguous."});
  const profile=matches[0],metadata=metadataMap[String(profile.name)]||{},amount=Number(tx.amount);
  if(!Number.isFinite(amount)||!Number.isFinite(Number(metadata.price))||moneyCents(metadata.price)!==moneyCents(amount))return res.status(400).json({success:false,code:"AMOUNT_MISMATCH",error:"Selected Hotspot package price must exactly match the transaction amount.",expectedAmount:Number(metadata.price),paidAmount:amount});
  const hc=require("../services/hotspotProfileConfig");
  let validityConfig;
  try{validityConfig=metadata.validityValue?hc.normalizeProfileValidity(metadata.validityValue,metadata.validityUnit):hc.parseStoredValidity(profile);}catch(_){validityConfig=hc.parseStoredValidity(profile);}
  const validity=String(validityConfig.validity||"").trim(),quota=Math.max(0,Number(metadata.limitBytesTotal||validityConfig.limitBytesTotal||0));
  if(!validity&&!quota)return res.status(400).json({success:false,code:"PROFILE_INVALID",error:"Selected Hotspot profile has no usable validity or data quota."});
  const profileId=String(metadata.id||metadata.profileId||metadata.profile_id||metadata.packageId||metadata.package_id||metadata.packageName||metadata.package_name||metadata.alias||requestedProfile);
  if(status==="unmatched"){
   const claim=await db.query("UPDATE transactions SET status='processing',used=true,claimed_at=NOW(),claimed_by=$1,claim_flow='force_hotspot',matched_username=$2 WHERE id=$3 AND LOWER(TRIM(status))='unmatched' AND (used=false OR used IS NULL) RETURNING id",["force_hotspot:"+String(req.user?.id||req.session?.userId||"admin"),mac,tx.id]);
   if(!claim.rows?.length)return res.status(409).json({success:false,code:"CLAIM_CONFLICT",error:"Another request has already claimed this TrxID."});
   claimedTransactionId=claim.rows[0].id??tx.id;
  }else if(status==="processing"){
   const claim=await db.query("UPDATE transactions SET claimed_at=NOW(),claimed_by=$1,claim_flow='force_hotspot',matched_username=$2,needs_reconciliation=false WHERE id=$3 AND status='processing' AND used=true AND (claimed_at IS NULL OR claimed_at < NOW()-INTERVAL '5 minutes') RETURNING id",["force_hotspot:"+String(req.user?.id||req.session?.userId||"admin"),mac,tx.id]);
   if(!claim.rows?.length)return res.status(409).json({success:false,code:"CLAIM_NOT_STALE",error:"This transaction is still being processed. Force provisioning is allowed only after a claim has been stuck for at least five minutes."});
   claimedTransactionId=claim.rows[0].id??tx.id;
  }
  let voucher=null,expiresAt=null,comment="",samePayment=false,resetCounters=true,previousUsername="";
  await db.withTransaction(async client=>{
   await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-force-hotspot-trx:"+String(tx.id)]);
   await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-force-hotspot-mac:"+mac]);
   if(phone)await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["faz-force-hotspot-phone:"+phone]);
   const associationNow=await client.query("SELECT hp.voucher_id,v.* FROM hotspot_voucher_payments hp LEFT JOIN hotspot_vouchers v ON v.id=hp.voucher_id WHERE hp.transaction_id=$1::bigint LIMIT 1",[tx.id]);
   associated=associationNow.rows?.[0]||null;
   let target=associated&&associated.id?associated:null;
   if(target){
    const bound=normalizeMac(target.mac_address)||normalizeMac(target.username);
    if(bound&&bound!==mac)throw Object.assign(new Error("This payment is already linked to a voucher bound to a different MAC address."),{statusCode:409,code:"MAC_ALREADY_BOUND"});
   }else{
    const records=await client.query("SELECT * FROM hotspot_vouchers WHERE ($1::text<>'' AND (LOWER(COALESCE(mac_address,''))=LOWER($1::text) OR LOWER(COALESCE(username,''))=LOWER($1::text))) OR ($2::text<>'' AND REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($2::text,'880'||SUBSTRING($2::text FROM 2))) ORDER BY CASE WHEN LOWER(COALESCE(mac_address,''))=LOWER($1::text) OR LOWER(COALESCE(username,''))=LOWER($1::text) THEN 0 ELSE 1 END,id DESC FOR UPDATE",[String(mac||""),String(phone||"")]);
    const rows=records.rows||[];
    const macRows=rows.filter(row=>(normalizeMac(row.mac_address)||normalizeMac(row.username))===mac);
    const boundPhones=[...new Set(rows.filter(row=>phone&&normalizePhone(row.phone)===phone).map(row=>normalizeMac(row.mac_address)||normalizeMac(row.username)).filter(Boolean))];
    if(boundPhones.some(bound=>bound!==mac))throw Object.assign(new Error("This phone is already bound to a different device. Use the registered device MAC or reconcile the binding first."),{statusCode:409,code:"MAC_ALREADY_BOUND"});
    target=macRows[0]||rows.find(row=>phone&&normalizePhone(row.phone)===phone)||null;
   }
   if(target){
    const bound=normalizeMac(target.mac_address)||normalizeMac(target.username);
    if(bound&&bound!==mac)throw Object.assign(new Error("This subscriber is already bound to a different device MAC."),{statusCode:409,code:"MAC_ALREADY_BOUND"});
   }
   const targetStatus=String(target?.status||"").toLowerCase();
samePayment=Boolean(target&&Number(target.transaction_id)===Number(tx.id))||Boolean(associated&&target&&Number(associated.id)===Number(target.id));
   resetCounters=!(samePayment&&targetStatus==="active");
   const priorExpiry=target?.expires_at?new Date(target.expires_at):null,priorStillValid=Boolean(priorExpiry&&!Number.isNaN(priorExpiry.getTime())&&priorExpiry.getTime()>Date.now());
   const duration=hotspotDurationMs(validity);
   if(samePayment&&targetStatus==="active"&&priorExpiry&&!Number.isNaN(priorExpiry.getTime())&&!priorStillValid)throw Object.assign(new Error("This payment already provisioned a package that has expired. A new payment is required to restore service."),{statusCode:409,code:"PACKAGE_ALREADY_EXPIRED"});
   if(samePayment&&priorStillValid)expiresAt=priorExpiry;
   else if(duration>0)expiresAt=new Date((priorStillValid?priorExpiry.getTime():Date.now())+duration);
   else expiresAt=null;
   comment=expiresAt?hotspotExpiryComment(expiresAt):"FAZ|FORCE|PROFILE="+profile.name;
   previousUsername=String(target?.username||"").trim();
   const params=[mac,profile.name,validity,amount,comment,phone,quota?String(quota):"",profileId,new Date(),expiresAt,tx.id];
   if(target){
    const updated=await client.query("UPDATE hotspot_vouchers SET username=$1::text,password=$1::text,profile=$2::text,validity=$3::text,price=$4::numeric,status='pending_claim',comment=$5::text,phone=COALESCE(NULLIF($6::text,''),NULLIF(phone,''),'Unlinked'),server=COALESCE(NULLIF(server,''),'all'),time_limit=NULLIF($3::text,''),data_limit=NULLIF($7::text,''),profile_id=$8::text,mac_address=$1::text,first_login_at=COALESCE(first_login_at,$9::timestamptz),expires_at=$10::timestamptz,expired_at=NULL,pre_expiry_notified=false,transaction_id=$11::bigint,renewal_stacked=$12::boolean,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$13::bigint RETURNING *",[...params,Boolean(priorStillValid&&duration>0),target.id]);
    voucher=updated.rows?.[0];
   }else{
    const inserted=await client.query("INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment,phone,server,time_limit,data_limit,profile_id,mac_address,first_login_at,expires_at,cleanup_status,transaction_id,renewal_stacked) VALUES($1::text,$1::text,$2::text,$3::text,$4::numeric,'pending_claim',$5::text,COALESCE(NULLIF($6::text,''),'Unlinked'),'all',NULLIF($3::text,''),NULLIF($7::text,''),$8::text,$1::text,$9::timestamptz,$10::timestamptz,'not_required',$11::bigint,false) RETURNING *",params);
    voucher=inserted.rows?.[0];
   }
   if(!voucher)throw new Error("Could not stage the force-provisioned Hotspot account in PostgreSQL.");
   stagedVoucherId=voucher.id;
   await client.query("INSERT INTO hotspot_voucher_payments(transaction_id,voucher_id,phone,amount,profile,sale_type) VALUES($1::bigint,$2::bigint,COALESCE(NULLIF($3::text,''),'Unlinked'),$4::numeric,$5::text,'online_mfs') ON CONFLICT(transaction_id) DO UPDATE SET voucher_id=EXCLUDED.voucher_id,phone=EXCLUDED.phone,amount=EXCLUDED.amount,profile=EXCLUDED.profile,sale_type=EXCLUDED.sale_type",[tx.id,voucher.id,phone,amount,profile.name]);
  });
  const routerResult=await mikrotikService.forceProvisionHotspotUser({username:mac,password:mac,macAddress:mac,profile:profile.name,validity,limitBytesTotal:quota,comment,server:voucher?.server||"all",previousUsername,resetCounters});
  routerSucceeded=true;
  const finalizedVoucher=await db.query("UPDATE hotspot_vouchers SET username=$1,password=$1,mac_address=$1,status='active',profile=$2,comment=$3,first_login_at=COALESCE(first_login_at,NOW()),expires_at=$4::timestamptz,expired_at=NULL,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$5::bigint RETURNING id,username,profile,profile_id,status,phone,mac_address,expires_at,transaction_id",[mac,profile.name,comment,expiresAt,stagedVoucherId]);
  if(!finalizedVoucher.rows?.length)throw new Error("RouterOS provisioning succeeded but the voucher could not be finalized in PostgreSQL.");
  const finalizedTx=await db.query("UPDATE transactions SET status=CASE WHEN LOWER(status)='processing' THEN 'processed' ELSE status END,used=true,matched_username=$1,needs_reconciliation=false,claim_flow='force_hotspot' WHERE id=$2::bigint AND LOWER(status) IN ('processing','processed','paid') RETURNING id,status",[mac,tx.id]);
  if(!finalizedTx.rows?.length)throw new Error("RouterOS provisioning succeeded but the payment transaction could not be finalized.");
  claimedTransactionId=null;
  const autoAuthReady=Boolean(routerResult?.macAuthEnabled);
  const message=autoAuthReady?"Hotspot user provisioned; stale active sessions and cookies cleared. MAC auto-auth is enabled and will reconnect on the device’s next traffic.":"Hotspot user provisioned and stale sessions/cookies cleared, but instant MAC auto-auth is not enabled on the applicable Hotspot server profile. Enable login-by=mac there or the client must complete portal login.";
  return res.json({success:true,status:finalizedTx.rows[0].status,trxId:tx.trx_id,mac,phone,profile:profile.name,amount,autoAuthReady,clearedActiveSessions:Number(routerResult?.clearedActiveSessions||0),clearedCookies:Number(routerResult?.clearedCookies||0),expires_at:expiresAt?new Date(expiresAt).toISOString():null,voucher:finalizedVoucher.rows[0],message});
 }catch(error){
  if(claimedTransactionId!==null&&!routerSucceeded){
   try{
    const nextStatus=originalStatus==="unmatched"?"unmatched":"processing",used=nextStatus==="processing";
    await db.query("UPDATE transactions SET status=$1,used=$2,matched_username=CASE WHEN $2 THEN matched_username ELSE NULL END,claimed_at=CASE WHEN $2 THEN claimed_at ELSE NULL END,claimed_by=CASE WHEN $2 THEN claimed_by ELSE NULL END,claim_flow=CASE WHEN $2 THEN claim_flow ELSE NULL END,needs_reconciliation=$2 WHERE id=$3::bigint AND status='processing' AND used=true",[nextStatus,used,claimedTransactionId]);
   }catch(rollbackError){console.error("[Force Provision] Failed to restore payment claim",claimedTransactionId,rollbackError?.message||rollbackError);}
  }else if(transactionId!==null&&routerSucceeded){
   try{await db.query("UPDATE transactions SET needs_reconciliation=true WHERE id=$1::bigint",[transactionId]);}catch(auditError){console.error("[Force Provision] Failed to mark reconciliation",transactionId,auditError?.message||auditError);}
  }else if(!routerSucceeded&&["processed","paid"].includes(originalStatus)){
   try{await db.query("UPDATE transactions SET needs_reconciliation=true WHERE id=$1::bigint",[transactionId]);}catch(_){}
  }
  const statusCode=error?.statusCode||500;
  console.error("[Force Provision] Failed:",error?.message||error);
  return res.status(statusCode).json({success:false,code:error?.code||"FORCE_PROVISION_FAILED",error:error?.message||"Unable to force-provision this Hotspot payment."});
 }
}

async function summary(req,res){try{const r=await db.query("SELECT COALESCE(SUM(amount),0) AS today_collection,COUNT(*) FILTER(WHERE status IN ('processed','PAID')) AS processed_today FROM transactions WHERE created_at::date=CURRENT_DATE");const recent=await db.query("SELECT * FROM transactions ORDER BY created_at DESC LIMIT 8");res.json({success:true,summary:r.rows[0],recent:r.rows});}catch(e){return errorResponse(res,e,503);}}

const verifyBuckets=new Map();
function rateLimit(key){const now=Date.now();const bucket=verifyBuckets.get(key)||{start:now,count:0};if(now-bucket.start>60000){bucket.start=now;bucket.count=0;}bucket.count++;verifyBuckets.set(key,bucket);return bucket.count<=10;}
async function verifyTrx(req,res){
 const body=req.body&&typeof req.body==="object"?req.body:{},query=req.query&&typeof req.query==="object"?req.query:{};
 const fail=(status,code,message,extra={})=>res.status(status).json({success:false,code,error:message,message,...extra});
 if(!rateLimit(String(req.ip||"unknown")))return fail(429,"RATE_LIMITED","Too many verification attempts. Try again later.");
 let claimedTransactionId=null;
 try{
  const explicitServiceType=String(body.service_type||body.serviceType||"").trim().toLowerCase();
  // This endpoint is used by the captive Hotspot checkout. Older portal builds may omit
  // service_type, so infer Hotspot only from unambiguous Hotspot fields (package_id or MAC).
  const hasHotspotContext=["package_id","packageId","mac","mac_address","macAddress"].some(key=>String(body[key]||"").trim()!=="");
  const serviceType=explicitServiceType||(hasHotspotContext?"hotspot":"");
  if(serviceType!=="hotspot")return fail(400,"SERVICE_TYPE_REQUIRED","Hotspot checkout must send service_type='hotspot' or a Hotspot package_id/MAC.");
  // The phone is optional for captive-portal MFS verification. Older portal builds
  // may send the device MAC in "username"; never treat it as a customer phone.
  const submittedMac=macFromBody(body);
  const normalizedPhone=normalizePhone(body.senderPhoneNumber||body.phone||body.account_phone||body.customer_phone||"");
  const phone=/^01\d{9}$/.test(normalizedPhone)?normalizedPhone:"";
  let cleanTrx=String(body.trxId||body.trx_id||body.transaction_id||body.trx||body.txnid||query.trxId||"").trim().toUpperCase();
  if(!cleanTrx){
   if(!phone)return fail(400,"TRXID_OR_PHONE_REQUIRED","Enter the TrxID or the sender phone number used for payment.");
   const setting=await db.query("SELECT value FROM app_settings WHERE key='payment_verification_method' LIMIT 1");
   const mode=String(setting.rows[0]?.value||"").trim().toLowerCase();
   if(!["sender_phone","senderphonenumber","phone","phone_number"].includes(mode))return fail(400,"TRXID_REQUIRED","The configured verification method requires a TrxID.");
   const method=String(body.paymentMethod||body.gateway||"").trim().toLowerCase();
   const requestedAmount=Number(body.amount);
   if(!["bkash","nagad","rocket","upay"].includes(method)||!Number.isFinite(requestedAmount)||requestedAmount<=0)return fail(400,"PAYMENT_DETAILS_REQUIRED","A valid provider and selected package amount are required.");
   const matches=await db.query(`SELECT trx_id FROM transactions
      WHERE channel=$1
        AND REGEXP_REPLACE(COALESCE(sender_phone,''),'[^0-9]','','g') IN ($2,'880'||SUBSTRING($2 FROM 2))
        AND ROUND(amount::numeric,2)=ROUND($3::numeric,2)
        AND LOWER(TRIM(status))='unmatched' AND COALESCE(used,FALSE)=FALSE
        AND created_at >= NOW()-INTERVAL '30 minutes'
      ORDER BY created_at DESC LIMIT 2`,[method,phone,requestedAmount]);
   if(!matches.rows.length)return fail(404,"NOT_FOUND_OR_DELAYED","No matching incoming SMS was found for this sender phone and amount yet. Wait for the SMS forwarder, then retry.");
   if(matches.rows.length>1)return fail(409,"AMBIGUOUS_PHONE_MATCH","More than one payment matches this phone and amount. Please use TrxID verification or contact support.");
   cleanTrx=String(matches.rows[0].trx_id||"").trim().toUpperCase();
  }
  const found=await db.query("SELECT * FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1",[cleanTrx]);
  if(!found.rows.length)return fail(404,"NOT_FOUND_OR_DELAYED","Transaction not found yet. Wait for the SMS forwarder and try again.");
  const tx=found.rows[0],status=String(tx.status||"").trim().toLowerCase();
  if(tx.used===true||["processing","processed","paid","duplicate"].includes(status))return fail(409,"ALREADY_CLAIMED","This TrxID has already been used or is being processed.");
  if(status!=="unmatched")return fail(409,"TRANSACTION_NOT_ELIGIBLE","This transaction is not eligible for Hotspot verification.");
  const method=String(body.paymentMethod||body.gateway||"").trim().toLowerCase();
  if(method&&["bkash","nagad","rocket","upay"].includes(method)&&String(tx.channel||"").toLowerCase()!==method)return fail(400,"PAYMENT_METHOD_MISMATCH","Select the payment method used for this TrxID.");
  const amount=Number(tx.amount),requestedAmount=Number(body.amount);
  if(!Number.isFinite(requestedAmount)||requestedAmount<=0||moneyCents(requestedAmount)!==moneyCents(amount))return fail(400,"AMOUNT_MISMATCH","The paid amount does not match the selected package price.");
  const requestedProfile=String(body.profile_id||body.profileId||body.package_id||body.packageId||body.profileName||body.profile_name||"").trim();
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
  const validity=String(validityConfig.validity||"").trim(),quota=Number(metadata.limitBytesTotal||validityConfig.limitBytesTotal||0);
  if(!validity&&!quota)return fail(400,"PROFILE_INVALID","The selected Hotspot package has no usable validity or data quota configured.");
  const accountIdentifier=phone||submittedMac||("PENDING-TX-"+tx.id);
  const claim=await db.query("UPDATE transactions SET status='processing',used=true,claimed_at=NOW(),claimed_by=$1,claim_flow='hotspot',matched_username=$1,sale_type='online_mfs' WHERE UPPER(TRIM(trx_id))=$2::text AND status='unmatched' AND (used=false OR used IS NULL) RETURNING id",[String(accountIdentifier||''),String(cleanTrx||'')]);
  if(!claim.rows.length){const latest=await db.query("SELECT status FROM transactions WHERE UPPER(TRIM(trx_id))=$1::text LIMIT 1",[String(cleanTrx||'')]);const ls=String(latest.rows[0]?.status||"").toLowerCase();return fail(409,ls==="processing"?"TRANSACTION_IN_PROCESS":"TRANSACTION_ALREADY_USED","Another request has claimed this TrxID. No package was staged.");}
  claimedTransactionId=claim.rows[0].id??tx.id;
  const profileId=String(metadata.id||metadata.profileId||metadata.profile_id||metadata.packageId||metadata.package_id||metadata.packageName||metadata.package_name||metadata.alias||requestedProfile);
  const pendingComment="FAZ|PENDING|PROFILE="+profile.name;
  let wasRecharge=false,provisioningVoucher=null;
  await db.withTransaction(async client=>{
   if(phone)await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-phone:"+phone]);
   if(submittedMac)await client.query("SELECT pg_advisory_xact_lock(hashtext($1)::bigint)",["hotspot-mac:"+submittedMac]);
   const records=await client.query("SELECT * FROM hotspot_vouchers WHERE ($1::text<>'' AND REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($1::text,'880'||SUBSTRING($1::text FROM 2))) OR ($2::text<>'' AND (LOWER(COALESCE(mac_address,''))=LOWER($2::text) OR LOWER(COALESCE(username,''))=LOWER($2::text))) ORDER BY id DESC FOR UPDATE",[String(phone||''),String(submittedMac||'')]);
   const rows=records.rows||[];
   const macOf=row=>normalizeMac(row?.mac_address)||normalizeMac(row?.username);
   const macRows=submittedMac?rows.filter(row=>macOf(row)===submittedMac):[];
   const phoneRows=phone?rows.filter(row=>normalizePhone(row.phone)===phone):[];
   const target=macRows[0]||phoneRows.find(row=>macOf(row))||phoneRows[0]||rows[0]||null;
   const boundMac=submittedMac||macOf(target)||"";
   const live=rows.filter(row=>["pending_claim","unused","active"].includes(String(row.status||"").toLowerCase())&&!(row.expires_at&&new Date(row.expires_at).getTime()<=Date.now()));
   wasRecharge=Boolean(target&&(["active","expired"].includes(String(target.status||"").toLowerCase())||target.expires_at&&new Date(target.expires_at).getTime()<=Date.now()));
   const username=boundMac||(target&&String(target.username||"").trim()&&!String(target.username).startsWith("PENDING-")?String(target.username).trim():"PENDING-"+phone);
   const priorExpiry=target?.expires_at?new Date(target.expires_at):null,packageDuration=hotspotDurationMs(validity);
   const priorStillValid=Boolean(priorExpiry&&!Number.isNaN(priorExpiry.getTime())&&priorExpiry.getTime()>Date.now());
   const nextExpiry=packageDuration?(priorStillValid?new Date(priorExpiry.getTime()+packageDuration):new Date(Date.now()+packageDuration)):null;
   const stagedComment=boundMac&&nextExpiry?hotspotExpiryComment(nextExpiry):pendingComment;
   const firstLoginAt=boundMac?(priorStillValid&&target?.first_login_at?target.first_login_at:new Date()):null;
   const params=[username,boundMac||phone,profile.name,validity,amount,stagedComment,phone,validity||null,quota?String(quota):null,profileId,boundMac||null];
   let row;
   if(target){
    const updated=await client.query("UPDATE hotspot_vouchers SET username=$1::text,password=CASE WHEN $11::text IS NOT NULL THEN $2::text ELSE password END,profile=$3::text,validity=$4::text,price=$5::numeric,status='pending_claim',comment=$6::text,phone=COALESCE(NULLIF($7::text,''),NULLIF(phone,''),'Unlinked'),server=COALESCE(NULLIF(server,''),'all'),time_limit=$8::text,data_limit=$9::text,profile_id=$10::text,mac_address=$11::text,first_login_at=CASE WHEN $12::timestamptz IS NULL THEN first_login_at ELSE $12::timestamptz END,expires_at=$13::timestamptz,expired_at=NULL,pre_expiry_notified=false,transaction_id=$14::bigint,renewal_stacked=$15::boolean,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$16::bigint RETURNING id,username,password,profile,profile_id,validity,price,status,comment,phone,server,time_limit,data_limit,mac_address,first_login_at,expires_at,transaction_id,renewal_stacked",[...params,firstLoginAt,nextExpiry,claimedTransactionId,Boolean(boundMac&&priorStillValid),target.id]);
    row=updated.rows?.[0];
   }else{
    const inserted=await client.query("INSERT INTO hotspot_vouchers(username,password,profile,validity,price,status,comment,phone,server,time_limit,data_limit,profile_id,mac_address,first_login_at,expires_at,cleanup_status,transaction_id,renewal_stacked) VALUES($1::text,$2::text,$3::text,$4::text,$5::numeric,'pending_claim',$6::text,COALESCE(NULLIF($7::text,''),'Unlinked'),'all',$8::text,$9::text,$10::text,$11::text,$12::timestamptz,$13::timestamptz,'not_required',$14::bigint,false) RETURNING id,username,password,profile,profile_id,validity,price,status,comment,phone,server,time_limit,data_limit,mac_address,first_login_at,expires_at,transaction_id,renewal_stacked",[...params,firstLoginAt,nextExpiry,claimedTransactionId]);
    row=inserted.rows?.[0];
   }
   if(!row)throw new Error("The paid Hotspot package could not be saved in PostgreSQL.");
   await client.query("INSERT INTO hotspot_voucher_payments(transaction_id,voucher_id,phone,amount,profile,sale_type) VALUES($1::bigint,$2::bigint,COALESCE(NULLIF($3::text,''),'Unlinked'),$4::numeric,$5::text,'online_mfs') ON CONFLICT(transaction_id) DO UPDATE SET voucher_id=EXCLUDED.voucher_id,phone=EXCLUDED.phone,amount=EXCLUDED.amount,profile=EXCLUDED.profile,sale_type=EXCLUDED.sale_type",[claimedTransactionId,row.id,String(phone||''),amount,row.profile]);
   const finalized=await client.query("UPDATE transactions SET status='processed',used=true,matched_username=$1,needs_reconciliation=false WHERE id=$2 AND status='processing' AND used=true RETURNING id",[username,claimedTransactionId]);
   if(!finalized.rows?.length)throw new Error("The package was staged but the payment transaction could not be finalized.");
   provisioningVoucher={...row,username,phone,mac_address:boundMac||null,expires_at:nextExpiry,first_login_at:firstLoginAt,comment:stagedComment,profile:profile.name,server:row.server||"all",id:row.id};
  });
  claimedTransactionId=null;
  let activated=false,activationPending=false,accountUsername=provisioningVoucher?.username||("PENDING-"+phone),expiration=provisioningVoucher?.expires_at||null;
  const mac=normalizeMac(provisioningVoucher?.mac_address||submittedMac);
  if(mac){
   try{
    await mikrotikService.rechargeHotspotUser({username:mac,previousUsername:provisioningVoucher?.username,macAddress:mac,profile:profile.name,validity,limitBytesTotal:quota,comment:provisioningVoucher?.comment||pendingComment,server:provisioningVoucher?.server||"all"});
    const final=await db.query("UPDATE hotspot_vouchers SET username=$1,password=$1,mac_address=$1,status='active',comment=$2,first_login_at=COALESCE(first_login_at,NOW()),expires_at=$3,renewal_stacked=false,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$4 RETURNING id,username,status,expires_at",[mac,provisioningVoucher?.comment||pendingComment,expiration,provisioningVoucher.id]);
    activated=Boolean(final.rows?.length);accountUsername=mac;
   }catch(routerError){
    activationPending=true;
    console.error("[VERIFY-TRX] Payment recorded; MAC-bound RouterOS activation needs retry:",{mac,error:routerError?.message||String(routerError)});
   }
  }else activationPending=true;
  const customerName=String(body.customer_name||body.customerName||body.name||"গ্রাহক").trim()||"গ্রাহক";
  if(phone){
   const paymentMessage=`আসসালামু আলাইকুম ${customerName}, FAZ NETWORK-এ আপনার ৳${amount} টাকা পেমেন্ট সফলভাবে গ্রহণ করা হয়েছে (TrxID: ${tx.trx_id||cleanTrx})। ওয়াইফাই চালু করে ইন্টারনেট উপভোগ করুন। হেল্পলাইন: 01339932887`;
   require("../services/notificationDispatcher").dispatchNotification({userType:"hotspot",event:"hotspot_payment_received",to:phone,recipient:phone,phone,username:accountUsername,customer:{username:accountUsername,name:customerName,phone,profile:profile.name},customerName,message:paymentMessage,useMessageDirectly:true,channels:["sms","whatsapp"],variables:{name:customerName,username:accountUsername,amount,profile:profile.name,gateway:tx.channel,trx_id:tx.trx_id||cleanTrx}});
  }
  return res.json({success:true,pending_activation:!activated,activation_pending:activationPending,message:activated?"Payment verified and the existing MAC-bound Hotspot account has been recharged.":activationPending?"Payment verified and saved; RouterOS activation is pending. Reconnect or contact support if it does not activate automatically.":"Payment verified.",phone,account_phone:phone,profile:profile.name,profile_id:profileId,validity,amount,expiration:expiration?new Date(expiration).toISOString():null,username:mac||null,password:mac||null,mac:mac||null});
 }catch(e){
  if(claimedTransactionId!==null)try{await db.query("UPDATE transactions SET status='unmatched',used=false,matched_username=NULL,claimed_at=NULL,claimed_by=NULL,claim_flow=NULL,needs_reconciliation=false WHERE id=$1 AND status='processing' AND used=true",[claimedTransactionId]);}catch(rollbackError){console.error("[VERIFY-TRX] Claim rollback failed",claimedTransactionId,rollbackError?.message||rollbackError);}
  return fail(e?.statusCode||500,e?.code||(e?.message?.toLowerCase().includes("profile")?"PROFILE_ERROR":"PACKAGE_STAGE_FAILED"),e?.message||"Payment verification failed.");
 }
}
function macFromBody(body){return normalizeMac(body?.mac||body?.device_mac||body?.macAddress||"");}

module.exports={webhook,dynamicWebhook,list,manualMatch,forceProvisionHotspot,summary,verifyTrx,renewalExpirationDate};
