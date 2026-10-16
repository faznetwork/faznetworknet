"use strict";
const db = require("../db");
const ALLOWED_EVENTS = new Set([
  "pppoe_renewal", "pppoe_payment", "pppoe_expiry_warning", "pppoe_expired",
  "hotspot_purchase", "hotspot_renewal", "hotspot_expiry_warning", "hotspot_expired", "welcome_message"
]);
const ALLOWED_CHANNELS = new Set(["whatsapp", "sms", "email"]);
function fail(res, error, status=400) {
  const message=String(error?.message||"Notification template operation failed.");
  return res.status(status).json({success:false,message,error:message});
}
async function list(req,res) {
  try {
    const result=await db.query("SELECT event_key,channel,template_body,email_subject,email_body,is_active,updated_at FROM notification_templates ORDER BY event_key,channel");
    return res.set("Cache-Control","no-store").json({success:true,templates:result.rows||[]});
  } catch(error) { return fail(res,error,503); }
}
async function save(req,res) {
  try {
    const body=req.body||{};
    const eventKey=String(body.event_key||"").trim().toLowerCase();
    const channel=String(body.channel||"").trim().toLowerCase();
    const templateBody=String(channel==="email"?(body.email_body??body.template_body??""):(body.template_body??""));
    const emailSubject=String(body.email_subject??"").trim();
    const isActive=body.is_active===false||String(body.is_active).toLowerCase()==="false" ? false : true;
    if(!ALLOWED_EVENTS.has(eventKey)) throw new Error("Choose a supported notification event.");
    if(!ALLOWED_CHANNELS.has(channel)) throw new Error("Choose a supported notification channel.");
    if(templateBody.length>4000) throw new Error("Template must be 4,000 characters or fewer.");
    if(emailSubject.length>200) throw new Error("Email subject must be 200 characters or fewer.");
    if(channel==="email"&&isActive&&!emailSubject) throw new Error("Enter an email subject for this template.");
    if(isActive&&!templateBody.trim()) throw new Error("Enter a message template or disable this template.");
    const result=await db.query(
      "INSERT INTO notification_templates(event_key,channel,template_body,email_subject,email_body,is_active,updated_at) VALUES($1,$2,$3,$4,$5,$6,NOW()) ON CONFLICT(event_key,channel) DO UPDATE SET template_body=EXCLUDED.template_body,email_subject=EXCLUDED.email_subject,email_body=EXCLUDED.email_body,is_active=EXCLUDED.is_active,updated_at=NOW() RETURNING event_key,channel,template_body,email_subject,email_body,is_active,updated_at",
      [eventKey,channel,templateBody,channel==="email"?emailSubject:null,channel==="email"?templateBody:null,isActive]
    );
    return res.set("Cache-Control","no-store").json({success:true,message:"Message template saved.",template:result.rows[0]});
  } catch(error) { return fail(res,error,400); }
}
module.exports={list,save,ALLOWED_EVENTS,ALLOWED_CHANNELS};
