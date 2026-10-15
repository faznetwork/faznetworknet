"use strict";
const db=require("../db");
const settingsService=require("../services/appSettings");
const smsService=require("../services/smsService");
const whatsappService=require("../services/whatsappService");

const activeWorkers=new Set();
const MAX_RECIPIENTS=5000;
const MIN_DELAY_MS=1500;
const MAX_DELAY_MS=3000;

function normalizePhone(value){
 let digits=String(value||"").replace(/\D/g,"");
 if(digits.startsWith("00880"))digits=digits.slice(2);
 if(digits.startsWith("01")&&digits.length===11)digits="88"+digits;
 if(digits.startsWith("1")&&digits.length===10)digits="880"+digits;
 return /^8801[3-9]\d{8}$/.test(digits)?digits:"";
}
function dedupeRecipients(rows){
 const seen=new Set(),out=[];
 for(const row of rows||[]){
  const phone=normalizePhone(row.phone);
  if(!phone||seen.has(phone))continue;
  seen.add(phone);
  out.push({...row,phone,name:String(row.name||row.username||phone).trim().slice(0,200),username:String(row.username||"").slice(0,120),package:String(row.package||"").slice(0,160),expiry_date:String(row.expiry_date||"").slice(0,40),amount:row.amount==null?null:Number(row.amount)});
 }
 return out;
}
function renderBroadcastMessage(template,recipient,companyName="FAZ NETWORK"){
 return smsService.renderTemplate(template,{
  company_name:companyName,
  name:recipient.name||recipient.username||recipient.phone,
  username:recipient.username||"",
  package:recipient.package||"",
  amount:recipient.amount==null?"":recipient.amount,
  expiry_date:recipient.expiry_date||""
 });
}
function randomDelayMs(random=Math.random){return MIN_DELAY_MS+Math.floor(random()*(MAX_DELAY_MS-MIN_DELAY_MS+1));}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

async function queryAudience(group){
 const expiredOnly=group==="expired_due";
 const pppoeSql="SELECT 'pppoe' AS user_type, COALESCE(NULLIF(BTRIM(full_name),''),username) AS name, username, package_name AS package, phone, COALESCE(expiration_date::text,'') AS expiry_date, monthly_bill AS amount FROM customers WHERE phone IS NOT NULL AND BTRIM(phone)<>''";
 const hotspotSql="SELECT 'hotspot' AS user_type, COALESCE(NULLIF(BTRIM(phone),''),username) AS name, username, profile AS package, phone, COALESCE(expires_at::date::text,'') AS expiry_date, price AS amount FROM hotspot_vouchers WHERE phone IS NOT NULL AND BTRIM(phone)<>''";
 const expiry=" AND (LOWER(COALESCE(status,'')) IN ('expired','inactive','left','suspended','due','unpaid') OR expiration_date <= (NOW() AT TIME ZONE 'Asia/Dhaka')::date)";
 const hotspotExpiry=" AND (LOWER(COALESCE(status,'')) IN ('expired','inactive','due','unpaid') OR expires_at <= NOW())";
 let queries=[];
 if(group==="pppoe")queries=[db.query(pppoeSql)];
 else if(group==="hotspot")queries=[db.query(hotspotSql)];
 else if(expiredOnly)queries=[db.query(pppoeSql+expiry),db.query(hotspotSql+hotspotExpiry)];
 else queries=[db.query(pppoeSql),db.query(hotspotSql)];
 const results=await Promise.all(queries);
 return dedupeRecipients(results.flatMap(result=>result.rows||[]));
}
function normalizeAudience(value){
 const group=String(value||"all").trim().toLowerCase();
 const aliases={"all_customers":"all","pppoe_only":"pppoe","hotspot_only":"hotspot","expired_due_users":"expired_due"};
 const normalized=aliases[group]||group;
 if(!["all","pppoe","hotspot","expired_due"].includes(normalized))throw new Error("Choose a supported audience group.");
 return normalized;
}
function normalizeChannels(value){
 const channels=[...new Set((Array.isArray(value)?value:[]).map(x=>String(x||"").trim().toLowerCase()))].filter(x=>["whatsapp","sms"].includes(x));
 if(!channels.length)throw new Error("Select at least one delivery channel.");
 return channels;
}
function fail(res,error,status=400){
 const message=String(error?.message||"Broadcast operation failed.");
 return res.status(status).json({success:false,message,error:message});
}
async function audienceCount(req,res){
 try{
  const group=normalizeAudience(req.query.group||"all"),recipients=await queryAudience(group);
  return res.set("Cache-Control","no-store").json({success:true,group,count:recipients.length});
 }catch(error){return fail(res,error,400);}
}
async function runBroadcast(id){
 const key=String(id);
 if(activeWorkers.has(key))return;
 activeWorkers.add(key);
 try{
  await db.query("UPDATE broadcast_logs SET status='running',started_at=COALESCE(started_at,NOW()),updated_at=NOW() WHERE id=$1 AND status IN ('queued','running')",[id]);
  const settings=await settingsService.getAllSettings();
  while(true){
   const claimed=await db.query(
    "UPDATE broadcast_recipients SET status='sending',updated_at=NOW() WHERE id=(SELECT id FROM broadcast_recipients WHERE broadcast_id=$1 AND status='queued' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *",
    [id]
   );
   const recipient=claimed.rows?.[0];
   if(!recipient)break;
   const channels=String((await db.query("SELECT channel FROM broadcast_logs WHERE id=$1",[id])).rows?.[0]?.channel||"").split(",").filter(Boolean);
   const variables={company_name:settings.company_name||"FAZ NETWORK",name:recipient.recipient_name||recipient.username||recipient.phone,username:recipient.username||"",package:recipient.package_name||"",amount:recipient.amount==null?"":recipient.amount,expiry_date:recipient.expiry_date||""};
   const message=smsService.renderTemplate((await db.query("SELECT message FROM broadcast_logs WHERE id=$1",[id])).rows?.[0]?.message||"",variables);
   const results={};const errors=[];
   for(const channel of channels){
    try{
     let result;
     if(channel==="whatsapp")result=await whatsappService.sendMessage({to:recipient.phone,message});
     else if(channel==="sms")result=await smsService.sendSms({to:recipient.phone,message,event:"broadcast",variables,settings});
     else throw new Error("Unsupported broadcast channel.");
     if(result?.success===false)throw new Error("Provider reported unsuccessful delivery.");
     results[channel]={success:true,skipped:Boolean(result?.skipped),reason:result?.reason||undefined};
    }catch(error){results[channel]={success:false,error:String(error?.message||error).slice(0,300)};errors.push(channel+": "+String(error?.message||error).slice(0,180));}
   }
   const success=errors.length===0;
   await db.query("UPDATE broadcast_recipients SET status=$2,results=$3::jsonb,error=$4,updated_at=NOW() WHERE id=$1",[recipient.id,success?"sent":"failed",JSON.stringify(results),errors.length?errors.join("; ").slice(0,1000):null]);
   await db.query("UPDATE broadcast_logs SET success_count=success_count+$2,failed_count=failed_count+$3,updated_at=NOW() WHERE id=$1",[id,success?1:0,success?0:1]);
   const pending=await db.query("SELECT COUNT(*)::int AS count FROM broadcast_recipients WHERE broadcast_id=$1 AND status='queued'",[id]);
   if(Number(pending.rows?.[0]?.count||0)>0)await delay(randomDelayMs());
  }
  const remaining=await db.query("SELECT COUNT(*)::int AS count FROM broadcast_recipients WHERE broadcast_id=$1 AND status IN ('queued','sending')",[id]);
  await db.query("UPDATE broadcast_logs SET status=CASE WHEN $2=0 THEN 'completed' ELSE 'failed' END,completed_at=CASE WHEN $2=0 THEN NOW() ELSE completed_at END,updated_at=NOW() WHERE id=$1",[id,Number(remaining.rows?.[0]?.count||0)]);
 }catch(error){
  console.error("[Broadcast] Worker failed for job "+id+":",error.message);
  await db.query("UPDATE broadcast_logs SET status='failed',updated_at=NOW() WHERE id=$1",[id]).catch(()=>{});
 }finally{activeWorkers.delete(key);}
}
async function create(req,res){
 try{
  const body=req.body||{};
  const title=String(body.title||"").trim().slice(0,200);
  const message=String(body.message||"");
  const audience=normalizeAudience(body.audience);
  const channels=normalizeChannels(body.channels);
  if(!title)throw new Error("Enter a broadcast title.");
  if(!message.trim())throw new Error("Enter a broadcast message.");
  if(message.length>4000)throw new Error("Message must be 4,000 characters or fewer.");
  const settings=await settingsService.getAllSettings();
  for(const channel of channels){
   if(!settingsService.bool(settings["notification_channel_"+channel+"_enabled"]))throw new Error(channel.toUpperCase()+" is disabled in General Settings → Notification Hub.");
   if(channel==="sms"&&String(settings.sms_provider_mode||settings.sms_gateway_mode||"disabled")==="disabled")throw new Error("Configure and enable an SMS engine before broadcasting.");
  }
  const recipients=await queryAudience(audience);
  if(!recipients.length)throw new Error("No valid, unique phone numbers were found for this audience.");
  if(recipients.length>MAX_RECIPIENTS)throw new Error("This broadcast exceeds the safety limit of "+MAX_RECIPIENTS+" recipients. Narrow the audience and try again.");
  const job=await db.withTransaction(async client=>{
   const inserted=await client.query("INSERT INTO broadcast_logs(title,channel,audience,message,total_recipients,status) VALUES($1,$2,$3,$4,$5,'queued') RETURNING id,title,channel,audience,total_recipients,status,created_at",[title,channels.join(","),audience,message,recipients.length]);
   const id=inserted.rows[0].id;
   for(let offset=0;offset<recipients.length;offset+=100){
    const batch=recipients.slice(offset,offset+100),values=[],params=[];
    for(const row of batch){
     const start=params.length+1;
     values.push("($"+start+",$"+(start+1)+",$"+(start+2)+",$"+(start+3)+",$"+(start+4)+",$"+(start+5)+",$"+(start+6)+",$"+(start+7)+")");
     params.push(id,row.user_type||"pppoe",row.name,row.username,row.phone,row.package,row.expiry_date,row.amount);
    }
    await client.query("INSERT INTO broadcast_recipients(broadcast_id,user_type,recipient_name,username,phone,package_name,expiry_date,amount) VALUES "+values.join(","),params);
   }
   return inserted.rows[0];
  });
  Promise.resolve().then(()=>runBroadcast(job.id));
  return res.status(202).set("Cache-Control","no-store").json({success:true,message:"Broadcast queued. Delivery will proceed with a randomized 1.5–3 second pause between recipients.",broadcast:job});
 }catch(error){return fail(res,error,400);}
}
async function progress(req,res){
 try{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)throw new Error("Invalid broadcast ID.");
  const result=await db.query("SELECT id,title,channel,audience,total_recipients,success_count,failed_count,status,created_at,started_at,completed_at FROM broadcast_logs WHERE id=$1",[id]);
  const job=result.rows?.[0];if(!job)return fail(res,new Error("Broadcast not found."),404);
  const recipients=await db.query("SELECT id,recipient_name,username,phone,status,results,error,updated_at FROM broadcast_recipients WHERE broadcast_id=$1 ORDER BY id DESC LIMIT 30",[id]);
  return res.set("Cache-Control","no-store").json({success:true,broadcast:{...job,sent_count:Number(job.success_count||0)+Number(job.failed_count||0),progress:job.total_recipients?Math.round((Number(job.success_count||0)+Number(job.failed_count||0))*100/Number(job.total_recipients)):100},recipients:recipients.rows||[]});
 }catch(error){return fail(res,error,400);}
}
async function history(req,res){
 try{const result=await db.query("SELECT id,title,channel,audience,total_recipients,success_count,failed_count,status,created_at,completed_at FROM broadcast_logs ORDER BY id DESC LIMIT 25");return res.set("Cache-Control","no-store").json({success:true,broadcasts:result.rows||[]});}
 catch(error){return fail(res,error,503);}
}
async function resumePendingBroadcasts(){
 try{
  await db.query("UPDATE broadcast_recipients SET status='queued',updated_at=NOW() WHERE status='sending' AND broadcast_id IN (SELECT id FROM broadcast_logs WHERE status IN ('queued','running'))");
  const result=await db.query("SELECT id FROM broadcast_logs WHERE status IN ('queued','running') ORDER BY id");
  for(const row of result.rows||[])Promise.resolve().then(()=>runBroadcast(row.id));
  if(result.rows?.length)console.info("[Broadcast] Resumed "+result.rows.length+" queued broadcast job(s).");
 }catch(error){console.warn("[Broadcast] Pending-job recovery skipped:",error.message);}
}
module.exports={audienceCount,create,progress,history,resumePendingBroadcasts,queryAudience,normalizePhone,dedupeRecipients,renderBroadcastMessage,randomDelayMs,MIN_DELAY_MS,MAX_DELAY_MS,MAX_RECIPIENTS};
