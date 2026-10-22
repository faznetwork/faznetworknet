"use strict";
const db=require("../db");
const ALLOWED_STATUS=new Set(["sent","failed","skipped"]);
const ALLOWED_CHANNEL=new Set(["sms","whatsapp","email"]);
const ALLOWED_EVENTS=new Set(["manual","broadcast","payment","payment_receipt","renewal","welcome","expiry_warning","expired","line_expiry","recharge","pppoe_payment","pppoe_renewal","pppoe_expiry_warning","pppoe_expired","hotspot_purchase","hotspot_renewal","hotspot_expiry_warning","hotspot_expired"]);
function boundedInt(value,fallback,min,max){const parsed=Number.parseInt(String(value??""),10);return Number.isInteger(parsed)?Math.max(min,Math.min(max,parsed)):fallback;}
function validDate(value,label){const raw=String(value||"").trim();if(!raw)return null;if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(raw)||Number.isNaN(Date.parse(raw+"T00:00:00Z"))||new Date(raw+"T00:00:00Z").toISOString().slice(0,10)!==raw)throw new Error("Invalid "+label+" date.");return raw;}
async function list(req,res){
 try{
  const query=String(req.query.search||"").trim().slice(0,120),status=String(req.query.status||"").trim().toLowerCase(),channel=String(req.query.channel||"").trim().toLowerCase(),event=String(req.query.event||"").trim().toLowerCase(),from=validDate(req.query.from,"start"),to=validDate(req.query.to,"end"),limit=boundedInt(req.query.limit,25,1,100),offset=boundedInt(req.query.offset,0,0,10000000);
  if(status&&!ALLOWED_STATUS.has(status))throw new Error("Choose a supported message status.");
  if(channel&&!ALLOWED_CHANNEL.has(channel))throw new Error("Choose SMS, WhatsApp or email.");
  if(event&&!ALLOWED_EVENTS.has(event))throw new Error("Choose a supported event.");
  if(from&&to&&from>to)throw new Error("Start date must be on or before end date.");
  const clauses=[],params=[];
  if(query){params.push("%"+query+"%");clauses.push("(recipient_address ILIKE $"+params.length+" OR recipient_phone ILIKE $"+params.length+" OR message ILIKE $"+params.length+" OR event_key ILIKE $"+params.length+" OR error ILIKE $"+params.length+")");}
  if(status){params.push(status);clauses.push("status=$"+params.length);}
  if(channel){params.push(channel);clauses.push("channel=$"+params.length);}
  if(event){params.push(event);clauses.push("event_key=$"+params.length);}
  if(from){params.push(from);clauses.push("created_at >= $"+params.length+"::date");}
  if(to){params.push(to);clauses.push("created_at < ($"+params.length+"::date + INTERVAL '1 day')");}
  const where=clauses.length?" WHERE "+clauses.join(" AND "):"";
  const count=await db.query("SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status='sent')::int AS sent,COUNT(*) FILTER (WHERE status='failed')::int AS failed,COUNT(*) FILTER (WHERE status='skipped')::int AS skipped FROM sms_delivery_logs"+where,params);
  const total=Number(count.rows?.[0]?.total||0);
  const rows=await db.query("SELECT id,channel,recipient_address,recipient_phone,message,event_key,status,gateway_mode,http_method,http_status,error,provider_message_id,created_at FROM sms_delivery_logs"+where+" ORDER BY created_at DESC,id DESC LIMIT $"+(params.length+1)+" OFFSET $"+(params.length+2),[...params,limit,offset]);
  return res.set("Cache-Control","no-store").json({success:true,logs:rows.rows||[],total,limit,offset,stats:{total,sent:Number(count.rows?.[0]?.sent||0),failed:Number(count.rows?.[0]?.failed||0),skipped:Number(count.rows?.[0]?.skipped||0)}});
 }catch(error){return res.status(400).set("Cache-Control","no-store").json({success:false,message:String(error?.message||"Unable to load message history.")});}
}
async function retry(req,res){
 try{
  const id=Number.parseInt(String(req.params.id||""),10);
  if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({success:false,message:"Invalid message history ID."});
  const found=await db.query("SELECT id,channel,recipient_address,message,event_key,status FROM sms_delivery_logs WHERE id=$1 LIMIT 1",[id]);
  const row=found.rows?.[0];
  if(!row)return res.status(404).json({success:false,message:"Message history record not found."});
  if(row.status!=="failed")return res.status(409).json({success:false,message:"Only failed messages can be retried. Check the current status first."});
  const recipient=String(row.recipient_address||row.recipient_phone||"").trim();
  let result;
  if(row.channel==="sms")result=await require("../services/smsService").sendSms({to:recipient,message:row.message,event:row.event_key});
  else if(row.channel==="whatsapp")result=await require("../services/whatsappService").sendMessage({to:recipient,message:row.message,event:row.event_key});
  else if(row.channel==="email"){
    const match=String(row.message||"").match(/^Subject: ([^\\n]*)\\n([\\s\\S]*)$/);
    if(!match)throw new Error("Email subject/body could not be recovered from this history entry.");
    result=await require("../services/emailService").sendEmail({to:recipient,subject:match[1],text:match[2],event:row.event_key});
  }else return res.status(400).json({success:false,message:"Unsupported message channel."});
  if(!result||result.success===false)throw new Error(result?.error||"Provider did not confirm the retry request.");
  return res.set("Cache-Control","no-store").json({success:true,message:"Retry request submitted. Check the newest history entry for its result."});
 }catch(error){return res.status(502).set("Cache-Control","no-store").json({success:false,message:String(error?.message||"Unable to retry message.")});}
}
module.exports={list,retry,boundedInt,validDate,ALLOWED_STATUS,ALLOWED_CHANNEL,ALLOWED_EVENTS};
