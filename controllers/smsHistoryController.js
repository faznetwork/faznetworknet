"use strict";
const db=require("../db");
const ALLOWED_STATUS=new Set(["sent","failed","skipped"]);
const ALLOWED_EVENTS=new Set(["manual","broadcast","payment","payment_receipt","renewal","welcome","expiry_warning","expired","line_expiry","recharge"]);
function boundedInt(value,fallback,min,max){const parsed=Number.parseInt(String(value??""),10);return Number.isInteger(parsed)?Math.max(min,Math.min(max,parsed)):fallback;}
function validDate(value,label){const raw=String(value||"").trim();if(!raw)return null;if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)||Number.isNaN(Date.parse(raw+"T00:00:00Z"))||new Date(raw+"T00:00:00Z").toISOString().slice(0,10)!==raw)throw new Error("Invalid "+label+" date.");return raw;}
async function list(req,res){
 try{
  const query=String(req.query.search||"").trim().slice(0,120),status=String(req.query.status||"").trim().toLowerCase(),event=String(req.query.event||"").trim().toLowerCase(),from=validDate(req.query.from,"start"),to=validDate(req.query.to,"end"),limit=boundedInt(req.query.limit,25,1,100),offset=boundedInt(req.query.offset,0,0,10000000);
  if(status&&!ALLOWED_STATUS.has(status))throw new Error("Choose a supported SMS status.");
  if(event&&!ALLOWED_EVENTS.has(event))throw new Error("Choose a supported SMS event.");
  if(from&&to&&from>to)throw new Error("Start date must be on or before end date.");
  const clauses=[],params=[];
  if(query){params.push("%"+query+"%");clauses.push("(recipient_phone ILIKE $"+params.length+" OR message ILIKE $"+params.length+" OR event_key ILIKE $"+params.length+")");}
  if(status){params.push(status);clauses.push("status=$"+params.length);}
  if(event){params.push(event);clauses.push("event_key=$"+params.length);}
  if(from){params.push(from);clauses.push("created_at >= $"+params.length+"::date");}
  if(to){params.push(to);clauses.push("created_at < ($"+params.length+"::date + INTERVAL '1 day')");}
  const where=clauses.length?" WHERE "+clauses.join(" AND "):"";
  const count=await db.query("SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE status='sent')::int AS sent,COUNT(*) FILTER (WHERE status='failed')::int AS failed,COUNT(*) FILTER (WHERE status='skipped')::int AS skipped FROM sms_delivery_logs"+where,params);
  const total=Number(count.rows?.[0]?.total||0);
  const rows=await db.query("SELECT id,recipient_phone,message,event_key,status,gateway_mode,http_method,http_status,error,created_at FROM sms_delivery_logs"+where+" ORDER BY created_at DESC,id DESC LIMIT $"+(params.length+1)+" OFFSET $"+(params.length+2),[...params,limit,offset]);
  return res.set("Cache-Control","no-store").json({success:true,logs:rows.rows||[],total,limit,offset,stats:{total,sent:Number(count.rows?.[0]?.sent||0),failed:Number(count.rows?.[0]?.failed||0),skipped:Number(count.rows?.[0]?.skipped||0)}});
 }catch(error){return res.status(400).set("Cache-Control","no-store").json({success:false,message:String(error?.message||"Unable to load SMS history.")});}
}
module.exports={list,boundedInt,validDate,ALLOWED_STATUS,ALLOWED_EVENTS};
