"use strict";
const crypto=require("crypto");
const db=require("../db");
const DEFAULT_SENDERS=Object.freeze({bkash:["bkash","16247"],nagad:["nagad","16167"],rocket:["rocket","16216","dbbl"],upay:["upay","16268"]});
const CHANNELS=Object.keys(DEFAULT_SENDERS);
const RECIPIENT_KEYS={bkash:"mfs_bkash_number",nagad:"mfs_nagad_number",rocket:"mfs_rocket_number",upay:"mfs_upay_number"};
const SENDER_KEYS={bkash:"mfs_bkash_sender_ids",nagad:"mfs_nagad_sender_ids",rocket:"mfs_rocket_sender_ids",upay:"mfs_upay_sender_ids"};
const KEYS=["personal_payment_webhook_url","personal_payment_webhook_enabled","personal_payment_webhook_secret",...Object.values(RECIPIENT_KEYS),...Object.values(SENDER_KEYS)];
let ready;
function parseBool(v){return v===true||String(v??"").trim().toLowerCase()==="true"||String(v??"").trim()==="1";}
function parseIds(v,fallback){if(Array.isArray(v))return v;try{const x=JSON.parse(String(v||""));if(Array.isArray(x))return x;}catch(_){}return fallback;}
function splitIds(v,fallback){const raw=v===undefined||v===null?fallback:v;return [...new Set((Array.isArray(raw)?raw:String(raw||"").split(/[,\n;]/)).map(x=>String(x).trim()).filter(Boolean).map(x=>x.slice(0,80)))].slice(0,20);}
function cleanNumber(v){const x=String(v??"").trim();if(x&&!/^(?:\+?\d[\d\s-]{6,18}\d)$/.test(x))throw new Error("Enter a valid receiving number or leave it blank.");return x.slice(0,24);}
function cleanUrl(v){const x=String(v??"").trim();if(!x)return "";if(x.startsWith("/")&&!x.startsWith("//"))return x.replace(/\/$/,"")||"/";let u;try{u=new URL(x);}catch(_){throw new Error("Webhook URL must be a valid HTTP/HTTPS URL or an absolute path.");}if(!["http:","https:"].includes(u.protocol))throw new Error("Webhook URL must use HTTP or HTTPS.");return u.toString().replace(/\/$/,"");}
async function upsert(tx,key,value){await tx.query("INSERT INTO app_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[key,String(value??"")]);}
async function ensure(){
 if(!ready)ready=db.withTransaction(async tx=>{
  let migrated=false;
  const exists=await tx.query("SELECT to_regclass('public.webhook_settings') AS table_name");
  if(exists.rows?.[0]?.table_name){
   const legacyResult=await tx.query("SELECT secret_key,sender_ids,recipient_numbers FROM public.webhook_settings WHERE id=1 LIMIT 1");
   const legacy=legacyResult.rows?.[0];
   const currentResult=await tx.query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])",[KEYS]);
   const current=Object.fromEntries((currentResult.rows||[]).map(r=>[r.key,r.value]));
   if(legacy){
    if(!String(current.personal_payment_webhook_secret||"").trim()&&String(legacy.secret_key||"").trim())await upsert(tx,"personal_payment_webhook_secret",legacy.secret_key);
    for(const channel of CHANNELS){
     const senderKey=SENDER_KEYS[channel],recipientKey=RECIPIENT_KEYS[channel];
     if(!Object.prototype.hasOwnProperty.call(current,senderKey))await upsert(tx,senderKey,JSON.stringify(splitIds(parseIds(legacy.sender_ids?.[channel],DEFAULT_SENDERS[channel]),DEFAULT_SENDERS[channel])));
     if(!Object.prototype.hasOwnProperty.call(current,recipientKey)&&String(legacy.recipient_numbers?.[channel]||"").trim())await upsert(tx,recipientKey,cleanNumber(legacy.recipient_numbers[channel]));
    }
   }
   await tx.query("DROP TABLE public.webhook_settings");
   migrated=true;
  }
  const defaults={personal_payment_webhook_url:"",personal_payment_webhook_enabled:"false",personal_payment_webhook_secret:"",...Object.fromEntries(CHANNELS.map(c=>[RECIPIENT_KEYS[c],""])),...Object.fromEntries(CHANNELS.map(c=>[SENDER_KEYS[c],JSON.stringify(DEFAULT_SENDERS[c])]))};
  for(const [key,value] of Object.entries(defaults))await tx.query("INSERT INTO app_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO NOTHING",[key,value]);
  return migrated;
 }).then(migrated=>{if(migrated)try{require("./appSettings").invalidate();}catch(_){}return true;}).catch(e=>{ready=null;throw e;});
 await ready;
}
async function get(){
 await ensure();
 const r=await db.query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])",[KEYS]);
 const map=Object.fromEntries((r.rows||[]).map(row=>[row.key,row.value])),senders={},recipients={};
 for(const c of CHANNELS){senders[c]=splitIds(parseIds(map[SENDER_KEYS[c]],DEFAULT_SENDERS[c]),DEFAULT_SENDERS[c]);recipients[c]=String(map[RECIPIENT_KEYS[c]]||"");}
 return {webhookUrl:String(map.personal_payment_webhook_url||""),webhookEnabled:parseBool(map.personal_payment_webhook_enabled),secret:String(map.personal_payment_webhook_secret||""),senders,recipients};
}
async function getPublic(){const c=await get();return {webhookUrl:c.webhookUrl,webhookEnabled:c.webhookEnabled,secretConfigured:Boolean(c.secret),senders:c.senders,recipients:c.recipients};}
async function save(input={},actor="admin"){
 await ensure();const current=await get();
 const url=Object.prototype.hasOwnProperty.call(input,"webhookUrl")?cleanUrl(input.webhookUrl):current.webhookUrl;
 const enabled=Object.prototype.hasOwnProperty.call(input,"webhookEnabled")?parseBool(input.webhookEnabled):current.webhookEnabled;
 const secretInput=String(input.webhookSecret??"").trim();if(secretInput.length>300)throw new Error("Webhook secret must be 300 characters or fewer.");
 const secret=secretInput||current.secret;
 if(enabled&&!url)throw new Error("Webhook URL is required when automation is enabled.");
 if(enabled&&!secret)throw new Error("Webhook Secret Key / Token is required when automation is enabled.");
 const senders={},recipients={};
 for(const c of CHANNELS){
  senders[c]=splitIds(input.senders&&Object.prototype.hasOwnProperty.call(input.senders,c)?input.senders[c]:current.senders[c],DEFAULT_SENDERS[c]);
  if(!senders[c].length)throw new Error("At least one sender identifier is required for "+c+".");
  recipients[c]=cleanNumber(input.recipients&&Object.prototype.hasOwnProperty.call(input.recipients,c)?input.recipients[c]:current.recipients[c]);
 }
 await db.withTransaction(async tx=>{
  const values={personal_payment_webhook_url:url,personal_payment_webhook_enabled:enabled?"true":"false",personal_payment_webhook_secret:secret,...Object.fromEntries(CHANNELS.map(c=>[RECIPIENT_KEYS[c],recipients[c]])),...Object.fromEntries(CHANNELS.map(c=>[SENDER_KEYS[c],JSON.stringify(senders[c])]))};
  for(const [key,value] of Object.entries(values))await upsert(tx,key,value);
 });
 try{require("./appSettings").invalidate();}catch(_){}
 return getPublic();
}
async function regenerate(){await ensure();const secret=crypto.randomBytes(32).toString("hex");await db.withTransaction(tx=>upsert(tx,"personal_payment_webhook_secret",secret));try{require("./appSettings").invalidate();}catch(_){}return secret;}
module.exports={ensure,get,getPublic,save,regenerate,DEFAULT_SENDERS,RECIPIENT_KEYS,SENDER_KEYS};
