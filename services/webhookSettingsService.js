"use strict";
const crypto=require("crypto");
const db=require("../db");
let ready;
const DEFAULTS={senders:{bkash:["bkash","16247"],nagad:["nagad","16167"],rocket:["rocket","16216","dbbl"],upay:["upay","16268"]},recipients:{bkash:"",nagad:"",rocket:"",upay:""}};
function parseIds(value,fallback){if(Array.isArray(value))return value;try{const v=JSON.parse(String(value||""));if(Array.isArray(v))return v;}catch(_){}return fallback;}
function splitIds(value){return [...new Set(String(value||"").split(/[,\n;]/).map(x=>x.trim()).filter(Boolean).map(x=>x.slice(0,80)))].slice(0,20);}
function cleanNumber(value){const v=String(value||"").trim();if(v&&!/^(?:\+?\d[\d\s-]{6,18}\d)$/.test(v))throw new Error("Enter a valid receiving number or leave it blank.");return v.slice(0,20);}
async function ensure(){if(!ready){ready=db.query(`CREATE TABLE IF NOT EXISTS webhook_settings (
 id SMALLINT PRIMARY KEY CHECK (id = 1),
 secret_key TEXT NOT NULL,
 sender_ids JSONB NOT NULL DEFAULT '{}'::jsonb,
 recipient_numbers JSONB NOT NULL DEFAULT '{}'::jsonb,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_by TEXT
)`).then(async()=>{const legacy=await db.query("SELECT value FROM app_settings WHERE key=$1 LIMIT 1",["personal_payment_webhook_secret"]);const legacySecret=String(legacy.rows?.[0]?.value||"").trim();const secret=legacySecret||crypto.randomBytes(32).toString("hex");await db.query("INSERT INTO webhook_settings(id,secret_key,sender_ids,recipient_numbers) VALUES(1,$1,$2::jsonb,$3::jsonb) ON CONFLICT(id) DO NOTHING",[secret,JSON.stringify(DEFAULTS.senders),JSON.stringify(DEFAULTS.recipients)]);}).catch(e=>{ready=null;throw e;});}await ready;}
async function get(){await ensure();const r=await db.query("SELECT secret_key,sender_ids,recipient_numbers,updated_at FROM webhook_settings WHERE id=1");const row=r.rows[0];return {secret:row.secret_key,senders:Object.fromEntries(["bkash","nagad","rocket","upay"].map(k=>[k,parseIds(row.sender_ids?.[k],DEFAULTS.senders[k])])),recipients:Object.fromEntries(["bkash","nagad","rocket","upay"].map(k=>[k,String(row.recipient_numbers?.[k]||"")])),updatedAt:row.updated_at};}
async function save(input,actor){await ensure();const current=await get();const senders={},recipients={};for(const k of ["bkash","nagad","rocket","upay"]){const ids=splitIds(input?.senders?.[k]);if(!ids.length)throw new Error("At least one sender identifier is required for "+k+".");senders[k]=ids;recipients[k]=cleanNumber(input?.recipients?.[k]);}await db.query("INSERT INTO webhook_settings(id,secret_key,sender_ids,recipient_numbers,updated_at,updated_by) VALUES(1,$1,$2::jsonb,$3::jsonb,NOW(),$4) ON CONFLICT(id) DO UPDATE SET sender_ids=EXCLUDED.sender_ids,recipient_numbers=EXCLUDED.recipient_numbers,updated_at=NOW(),updated_by=EXCLUDED.updated_by",[current.secret,JSON.stringify(senders),JSON.stringify(recipients),String(actor||"admin").slice(0,160)]);await syncLegacy(current.secret,recipients);return get();}
async function regenerate(actor){await ensure();const secret=crypto.randomBytes(32).toString("hex");await db.query("UPDATE webhook_settings SET secret_key=$1,updated_at=NOW(),updated_by=$2 WHERE id=1",[secret,String(actor||"admin").slice(0,160)]);const s=await get();await syncLegacy(secret,s.recipients);return secret;}
async function syncLegacy(secret,recipients){const vals={personal_payment_webhook_secret:secret,mfs_bkash_number:recipients.bkash,mfs_nagad_number:recipients.nagad,mfs_rocket_number:recipients.rocket,mfs_upay_number:recipients.upay};for(const [key,value] of Object.entries(vals))await db.query("INSERT INTO app_settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",[key,String(value||"")]);}
module.exports={ensure,get,save,regenerate};
