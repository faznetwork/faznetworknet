const crypto=require("crypto");
const db=require("../db");
const mikrotikService=require("../services/mikrotikService");
const COOKIE="faz_customer_session",SESSION_SECONDS=43200;
const rootSecret=String(process.env.CUSTOMER_SESSION_SECRET||"").trim();
const secret=()=>rootSecret?crypto.createHmac("sha256",rootSecret).update("faznetwork:customer-self-care:session-v1").digest("hex"):"";
const loginAttempts=new Map();
function withTimeout(promise,label,ms=7000){
 let timer;
 const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+" timed out after "+ms+"ms")),ms);});
 return Promise.race([Promise.resolve(promise),timeout]).finally(()=>clearTimeout(timer));
}
function allowLogin(ip){const now=Date.now(),key=String(ip||"unknown"),b=loginAttempts.get(key)||{start:now,count:0};if(now-b.start>60000){b.start=now;b.count=0;}b.count++;loginAttempts.set(key,b);return b.count<=8;}
function sign(v){return crypto.createHmac("sha256",secret()).update(v).digest("base64url");}
function issueToken(p){if(!secret())throw new Error("Customer session signing secret is not configured.");const h=Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),b=Buffer.from(JSON.stringify({...p,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+SESSION_SECONDS})).toString("base64url"),u=h+"."+b;return u+"."+sign(u);}
function readToken(req){const raw=String(req.headers.cookie||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="))?.slice(COOKIE.length+1);if(!raw||!secret())return null;try{const t=decodeURIComponent(raw),p=t.split("."),expected=sign(p[0]+"."+p[1]);if(p.length!==3||p[2].length!==expected.length||!crypto.timingSafeEqual(Buffer.from(p[2]),Buffer.from(expected)))return null;const d=JSON.parse(Buffer.from(p[1],"base64url").toString("utf8"));return d.sub&&["pppoe","hotspot"].includes(d.type)&&Number(d.exp)>Math.floor(Date.now()/1000)?d:null;}catch(_){return null;}}
function setCookie(res,t){res.setHeader("Set-Cookie",COOKIE+"="+encodeURIComponent(t)+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+SESSION_SECONDS+(process.env.NODE_ENV==="production"?"; Secure":""));}
function clearCookie(res){res.setHeader("Set-Cookie",COOKIE+"=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"+(process.env.NODE_ENV==="production"?"; Secure":""));}
function clean(v,n=120){return String(v??"").trim().slice(0,n);}
function phone(v){let n=String(v??"").replace(/[^\d]/g,"");if(n.startsWith("880")&&n.length===13)n="0"+n.slice(3);return n;}
function validPhone(v){return /^01\d{9}$/.test(phone(v));}
async function passwordMatches(input,stored){const p=String(input??""),s=String(stored??"");if(!p||!s)return false;if(p===s)return true;if(/^\$2[aby]\$/.test(s)){try{return await require("bcryptjs").compare(p,s)}catch(_){return false}}return false;}
function normalizeExpiryDate(value){if(!value)return "";if(value instanceof Date){if(Number.isNaN(value.getTime()))return "";return value.toISOString().slice(0,10);}const raw=String(value).trim();if(/^\d{4}-\d{2}-\d{2}/.test(raw))return raw.slice(0,10);const m=raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!m)return "";const day=Number(m[1]),month=Number(m[2]),year=Number(m[3]),d=new Date(Date.UTC(year,month-1,day));return d.getUTCFullYear()===year&&d.getUTCMonth()===month-1&&d.getUTCDate()===day?[String(year),String(month).padStart(2,"0"),String(day).padStart(2,"0")].join("-"):"";}
function daysLeft(v){if(!v)return null;const d=String(v).slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return null;const t=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());return Math.ceil((Date.parse(d+"T00:00:00Z")-Date.parse(t+"T00:00:00Z"))/86400000);}
function gb(v){return Number((Math.max(0,Number(v)||0)/1073741824).toFixed(2));}
async function login(req,res){
 if(!allowLogin(req.ip))return res.status(429).json({success:false,message:"Too many login attempts. Wait one minute and try again."});
 if(!rootSecret)return res.status(503).json({success:false,message:"Customer login is not configured yet. Please contact FAZ NETWORK support."});
 try{
  const type=clean(req.body?.type||req.body?.accountType,20).toLowerCase(),identifier=clean(req.body?.identifier||req.body?.username||req.body?.phone,120),password=String(req.body?.password??"");
  if(!["pppoe","hotspot"].includes(type))return res.status(400).json({success:false,message:"Choose PPPoE or Hotspot subscriber login."});
  if(!identifier||!password)return res.status(400).json({success:false,message:"Login details are required."});
  let subject="",name="",mobile="";
  if(type==="hotspot"){
   const p=phone(identifier);if(!validPhone(p)||password!==p)return res.status(401).json({success:false,message:"Hotspot login requires the 11-digit mobile number as both username and password."});
   let u=null;try{u=await mikrotikService.getHotspotUser(p)}catch(e){console.warn("[Self-care] Hotspot lookup:",e.message)}
   if(u&&!u.disabled&&u.password===p){subject=u.username;name=u.username;mobile=p;}
   else{const q=await db.query("SELECT username,password,status FROM hotspot_vouchers WHERE username=$1 LIMIT 1",[p]).catch(()=>({rows:[]}));if(!q.rows.length||q.rows[0].status==="expired"||!(await passwordMatches(p,q.rows[0].password)))return res.status(401).json({success:false,message:"Hotspot account not found or mobile-number login is not enabled."});subject=q.rows[0].username;name=subject;mobile=p;}
  }else{
   const p=phone(identifier),q=await db.query("SELECT * FROM customers WHERE LOWER(username)=LOWER($1) OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') IN ($2, '880'||substring($2 from 2)) LIMIT 1",[identifier,p]),c=q.rows[0]||null,username=c?.username||identifier;
   const ures=await db.query("SELECT * FROM pppoe_users WHERE LOWER(username)=LOWER($1) LIMIT 1",[username]),u=ures.rows[0]||null;
   let ok=await passwordMatches(password,c?.password)||await passwordMatches(password,u?.password);
   if(!ok){try{const s=await mikrotikService.getPppoeSecret(username);ok=await passwordMatches(password,s?.password)}catch(_){}}
   if(!ok)return res.status(401).json({success:false,message:"Invalid PPPoE username/phone or password."});
   subject=clean(c?.username||u?.username||username,100);name=clean(c?.full_name||subject,200);mobile=clean(c?.phone||u?.phone,40);
  }
  setCookie(res,issueToken({sub:subject,type,name,phone:mobile}));return res.json({success:true,type,redirect:"/customer/dashboard"});
 }catch(e){console.error("[Customer self-care login]",e);return res.status(503).json({success:false,message:"Customer login is temporarily unavailable."});}
}
function logout(req,res){clearCookie(res);return res.json({success:true});}
async function readMfsAccounts(){const keys={bkash:"mfs_bkash_number",nagad:"mfs_nagad_number",rocket:"mfs_rocket_number",upay:"mfs_upay_number"};try{const r=await db.query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])",[Object.values(keys)]);const values=Object.fromEntries((r.rows||[]).map(row=>[row.key,row.value]));return Object.fromEntries(Object.entries(keys).map(([name,key])=>[name,String(values[key]||"")]));}catch(_){return {bkash:"",nagad:"",rocket:"",upay:""};}}
async function profile(req,res){
 res.set("Cache-Control","no-store, private");
 const s=readToken(req);if(!s)return res.status(401).json({success:false,message:"Please sign in to view your account."});
 try{
  if(s.type==="hotspot"){
   const results=await Promise.allSettled([withTimeout(mikrotikService.getHotspotUser(s.sub),"Hotspot user lookup"),withTimeout(mikrotikService.getHotspotActiveSession(s.sub),"Hotspot active-session lookup"),db.query("SELECT profile,validity,price,status FROM hotspot_vouchers WHERE username=$1 LIMIT 1",[s.sub]),db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1")]);
   const u=results[0].status==="fulfilled"?results[0].value:null,a=results[1].status==="fulfilled"?results[1].value:null,v=results[2].status==="fulfilled"?results[2].value.rows[0]||null:null;
   if(!u&&!v)return res.status(404).json({success:false,message:"Hotspot account could not be found."});
   let meta={};try{meta=JSON.parse(results[3].status==="fulfilled"?results[3].value.rows[0]?.value||"{}":"{}")}catch(_){}
   const raw=u?.raw||{},total=Number(u?.limitBytesTotal||raw["limit-bytes-total"]||0),used=Math.max(0,Number(u?.bytesIn||raw["bytes-in"]||0))+Math.max(0,Number(u?.bytesOut||raw["bytes-out"]||0)),profile=clean(u?.profile||v?.profile,100),m=meta[profile]||{};
   const paymentAccounts=await readMfsAccounts();return res.json({success:true,customer:{type:"hotspot",name:s.name||s.sub,username:s.sub,phone:s.phone||s.sub,profile,status:u?.disabled?"Disabled":a?"Online":"Offline",online:Boolean(a),ip:a?.address||null,uptime:a?.uptime||null,limitUptime:u?.limitUptime||raw["limit-uptime"]||v?.validity||m.validityValue||null,limitBytesTotal:total,usedBytes:used,remainingBytes:Math.max(0,total-used),limitGb:total?gb(total):null,usedGb:gb(used),remainingGb:total?gb(Math.max(0,total-used)):null,price:Number(v?.price||m.price||0),paymentAccounts,payments:[]}});
  }
  const username=s.sub,qr=await db.query("SELECT c.*,p.plan_name AS linked_plan_name,p.profile_name AS linked_profile_name,p.price AS linked_price,p.rate_limit AS linked_rate_limit,p.duration_months AS linked_duration_months FROM customers c LEFT JOIN LATERAL (SELECT p.plan_name,p.profile_name,p.price,p.rate_limit,p.duration_months FROM packages p WHERE LOWER(p.profile_name)=LOWER(c.profile) OR LOWER(p.plan_name)=LOWER(c.package_name) OR LOWER(p.profile_name)=LOWER(c.package_name) ORDER BY CASE WHEN LOWER(p.profile_name)=LOWER(c.profile) THEN 0 WHEN LOWER(p.plan_name)=LOWER(c.package_name) THEN 1 ELSE 2 END,p.id ASC LIMIT 1) p ON TRUE WHERE LOWER(c.username)=LOWER($1) LIMIT 1",[username]),c=qr.rows[0]||null,ur=await db.query("SELECT * FROM pppoe_users WHERE LOWER(username)=LOWER($1) LIMIT 1",[username]),u=ur.rows[0]||null;
  if(!c&&!u)return res.status(404).json({success:false,message:"PPPoE account could not be found."});
  const results=await Promise.allSettled([withTimeout(mikrotikService.getActiveSessions(),"PPPoE active-session lookup"),withTimeout(mikrotikService.getPppoeLiveTraffic(username),"PPPoE live-traffic lookup"),db.query("SELECT trx_id,channel,amount,status,created_at,used,matched_username FROM transactions WHERE LOWER(TRIM(COALESCE(matched_username,'')))=LOWER($1) OR (NULLIF(TRIM(matched_username),'') IS NULL AND NULLIF(TRIM($2),'') IS NOT NULL AND REGEXP_REPLACE(COALESCE(sender_phone,''),'\D','','g')=REGEXP_REPLACE($2,'\D','','g')) ORDER BY created_at DESC LIMIT 25",[username,clean(c?.phone||u?.phone,40)])]);
  const sessions=results[0].status==="fulfilled"?results[0].value:[],live=(Array.isArray(sessions)?sessions:[]).find(x=>String(x.username||"").toLowerCase()===username.toLowerCase())||null,traffic=results[1].status==="fulfilled"?results[1].value:null,expiry=normalizeExpiryDate(c?.expiration_date)||normalizeExpiryDate(u?.expiry_date)||null,remaining=daysLeft(expiry),payments=results[2].status==="fulfilled"?results[2].value.rows:[],latestPayment=payments[0]||null,storedBilling=String(c?.billing_status||u?.billing_status||"").trim().toLowerCase(),latestPaymentStatus=String(latestPayment?.status||"").trim().toLowerCase(),billingStatus=["paid","success","completed"].includes(latestPaymentStatus)?"paid":["processing"].includes(latestPaymentStatus)?"processing":["unmatched","pending"].includes(latestPaymentStatus)?"pending":["failed","rejected","expired"].includes(latestPaymentStatus)?latestPaymentStatus:storedBilling||"unpaid";
  const status=remaining!==null&&remaining<0?"Expired":(c?.status==="inactive"||u?.disabled?"Suspended":live?"Active":"Offline");
  const paymentAccounts=await readMfsAccounts();return res.json({success:true,customer:{type:"pppoe",name:s.name||c?.full_name||username,username,phone:c?.phone||u?.phone||s.phone||null,status,online:Boolean(live),ip:traffic?.ip||live?.address||null,uptime:traffic?.uptime||live?.uptime||null,profile:clean(c?.profile||u?.profile||c?.linked_profile_name,100),planName:clean(c?.linked_plan_name||c?.package_name||c?.profile||u?.profile,120),rateLimit:clean(c?.linked_rate_limit||"",100),packageDurationMonths:Number(c?.linked_duration_months||0),monthlyFee:Number(c?.monthly_bill??c?.linked_price??0),expiryDate:expiry,remainingDays:remaining,billingStatus:clean(billingStatus,30),downloadMbps:Number(traffic?.txBitsPerSecond||0)/1000000,uploadMbps:Number(traffic?.rxBitsPerSecond||0)/1000000,bytesIn:Number(traffic?.downloadBytes??traffic?.bytesOut??0),bytesOut:Number(traffic?.uploadBytes??traffic?.bytesIn??0),paymentAccounts,payments}});
 }catch(e){console.error("[Customer self-care profile]",e);return res.status(503).json({success:false,message:"Unable to load live account data right now."});}
}
async function renew(req,res){
 res.set("Cache-Control","no-store, private");
 const s=readToken(req);if(!s)return res.status(401).json({success:false,message:"Please sign in first."});
 if(s.type!=="pppoe")return res.status(400).json({success:false,message:"This renewal form is for PPPoE subscribers."});
 const trx=clean(req.body?.trxId||req.body?.trx_id,100).toUpperCase();if(!trx)return res.status(400).json({success:false,message:"TrxID is required."});
 let claimed=null,routerSucceeded=false;
 try{
  const cResult=await db.query("SELECT c.*,p.plan_name AS linked_plan_name,p.profile_name AS linked_profile_name,p.price AS linked_price,p.duration_months FROM customers c LEFT JOIN packages p ON (LOWER(p.profile_name)=LOWER(c.profile) OR LOWER(p.plan_name)=LOWER(c.package_name)) WHERE LOWER(c.username)=LOWER($1) LIMIT 1",[s.sub]);
  const c=cResult.rows[0]||null,uResult=await db.query("SELECT * FROM pppoe_users WHERE LOWER(username)=LOWER($1) LIMIT 1",[s.sub]),u=uResult.rows[0]||null;
  if(!c&&!u)return res.status(404).json({success:false,message:"Customer account not found."});
  let packageFallback=null;if(!c&&u?.profile){const pr=await db.query("SELECT price,duration_months,plan_name,profile_name FROM packages WHERE LOWER(profile_name)=LOWER($1) OR LOWER(plan_name)=LOWER($1) ORDER BY id ASC LIMIT 1",[u.profile]);packageFallback=pr.rows[0]||null;}const expected=Number(c?.monthly_bill??c?.linked_price??packageFallback?.price??0);if(!(expected>0))return res.status(400).json({success:false,message:"Your billing amount is not configured. Contact support."});
  const txResult=await db.query("SELECT * FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1",[trx]);const tx=txResult.rows[0];
  if(!tx)return res.status(404).json({success:false,message:"Transaction not found. Please wait for payment SMS verification."});
  if(tx.used||String(tx.status||"").trim().toLowerCase()!=="unmatched")return res.status(409).json({success:false,message:"This transaction has already been used or cannot be verified."});
  const registeredPhone=phone(c?.phone||u?.phone||s.phone);const transactionUsername=String(tx.matched_username||"").trim().toLowerCase();if(transactionUsername&&transactionUsername!==s.sub.toLowerCase()&&(!registeredPhone||phone(tx.sender_phone)!==registeredPhone))return res.status(403).json({success:false,message:"This TrxID is linked to another account."});if(!transactionUsername&&(!registeredPhone||phone(tx.sender_phone)!==registeredPhone))return res.status(403).json({success:false,message:"This payment could not be linked to your registered account. Contact support for manual verification."});
  if(Math.round(Number(tx.amount)*100)!==Math.round(expected*100))return res.status(400).json({success:false,message:"Payment amount does not match your bill of ৳"+expected.toFixed(2)+".",expectedAmount:expected,paidAmount:Number(tx.amount)});
  const claim=await db.query("UPDATE transactions SET used=true,status='processing',matched_username=$1 WHERE id=$2 AND (used=false OR used IS NULL) AND LOWER(TRIM(status))='unmatched' RETURNING id",[s.sub,tx.id]);
  if(!claim.rows.length)return res.status(409).json({success:false,message:"This transaction has already been claimed."});claimed=tx.id;
  const months=Math.max(1,Number(c?.duration_months||1)),now=new Date(),today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).format(now),current=String(c?.expiration_date||u?.expiry_date||"").slice(0,10),base=current&&current>=today?current:today;
  const [yy,mm,dd]=base.split("-").map(Number),target=new Date(Date.UTC(yy,mm-1+months,1)),last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(dd,last));const expiry=target.toISOString().slice(0,10);
  const profile=clean(c?.linked_profile_name||c?.profile||packageFallback?.profile_name||packageFallback?.plan_name||u?.profile,100),password=String(c?.password||u?.password||"");
  const comment="Customer: "+String(c?.full_name||s.name||s.sub)+" | Phone: "+String(c?.phone||u?.phone||s.phone||"")+" | EXP: "+expiry+" | TrxID: "+trx;
  await mikrotikService.updateSecret(s.sub,{password,profile,comment,disabled:false});
  // RouterOS has changed the secret; preserve the durable processing claim on any later failure.
  routerSucceeded=true;
  await mikrotikService.kickActiveUser(s.sub);
  await db.withTransaction(async client=>{
   if(c)await client.query("UPDATE customers SET expiration_date=$1,status='active',billing_status='paid',paid_until=$1,monthly_bill=$2,updated_at=NOW() WHERE id=$3",[expiry,expected,c.id]);
   await client.query("UPDATE pppoe_users SET profile=$1,disabled=false,status='active',expiry_date=$2,billing_status='paid',paid_until=$2,comment=$3,updated_at=NOW() WHERE LOWER(username)=LOWER($4)",[profile,expiry,comment,s.sub]);
   const finalized=await client.query("UPDATE transactions SET status='PAID',used=true,matched_username=$1 WHERE id=$2 AND status='processing' AND used=true RETURNING id",[s.sub,claimed]);
   if(!finalized.rows.length)throw new Error("PPPoE renewal completed but payment finalization did not update the claimed transaction.");
  });
  claimed=null;
  return res.json({success:true,message:"Payment verified and PPPoE service renewed.",username:s.sub,expiration:expiry});
 }catch(e){
  console.error("[Customer self-care renewal]",e?.message||e);
  if(claimed!==null&&!routerSucceeded){
   try{
    const rollback=await db.query("UPDATE transactions SET status='unmatched',used=false,matched_username=NULL WHERE id=$1 AND status='processing' AND used=true RETURNING id",[claimed]);
    if(!rollback.rows.length)console.error("[Customer self-care renewal] Claim rollback found no processing row for transaction",claimed);
   }catch(rollbackError){console.error("[Customer self-care renewal] Failed to rollback transaction claim",claimed,rollbackError?.message||rollbackError);}
  }else if(claimed!==null&&routerSucceeded){
   console.error("[CRITICAL_PARTIAL_PROVISION] PPPoE renewal succeeded on MikroTik but DB finalization failed; transaction remains processing for reconciliation.",{transactionId:claimed,username:s.sub,error:e?.message||String(e)});
  }
  return res.status(500).json({success:false,message:routerSucceeded?"Renewal reached MikroTik but database finalization needs administrator review. Do not retry this TrxID; contact support.":"Payment verification or renewal failed; the transaction claim was released when possible."});
 }
}

module.exports={login,logout,profile,renew,readToken,issueToken};
