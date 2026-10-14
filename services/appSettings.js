"use strict";
const db=require("../db");
const CACHE_TTL_MS=30_000;
const DEFAULTS={
 company_name:"FAZ NETWORK",public_base_url:"",logo_url:"",favicon_url:"",
 network_discovery_interval_minutes:"10",
 support_phone:"01339932887",whatsapp_number:"8801339932887",office_address:"FAZ NETWORK, Bangladesh",
 btrc_license_number:"",footer_copyright:"© {year} FAZ NETWORK. All Rights Reserved.",
 billing_cycle_type:"rolling_30",grace_period_days:"0",expiry_action:"quarantine",
  sms_gateway_mode:"disabled",sms_provider_mode:"disabled",sms_api_url:"",sms_api_key:"",sms_sender_id:"",sms_api_method:"POST",
 sms_device_url:"",sms_device_webhook_url:"",sms_device_token:"",sms_event_expiry_warning:"true",
 sms_event_payment_receipt:"true",sms_event_line_expiry:"true",
 sms_template_expiry_warning:"Dear {name}, your FAZ NETWORK bill of Tk {amount} is expiring on {expiry_date}. Please pay to avoid line cut. Helpline: {support_phone}",
 sms_template_payment_receipt:"Dear {name}, payment of Tk {amount} received successfully via {gateway}. TrxID: {trx_id}. Your line is active till {new_expiry_date}. Thank you, FAZ NETWORK.",
 sms_template_line_block:"Dear {name}, your internet connection has expired. Please recharge via bKash/Nagad to reactivate your internet immediately. Helpline: {support_phone}"
};
let cached=null,expiresAt=0,refreshPromise=null;
function bool(v){return v===true||String(v||"").toLowerCase()==="true"||String(v||"")==="1";}
function normalize(map){
 const out={...DEFAULTS,...map};
 // Canonical SMS setting keys are kept compatible with the first settings-suite release.
 if(map.sms_provider_mode)out.sms_gateway_mode=map.sms_provider_mode;else out.sms_provider_mode=out.sms_gateway_mode;
 if(map.sms_device_webhook_url)out.sms_device_url=map.sms_device_webhook_url;else out.sms_device_webhook_url=out.sms_device_url;
 out.company_name=String(out.company_name||DEFAULTS.company_name).slice(0,160);
 out.public_base_url=String(out.public_base_url||"").slice(0,500);
 out.logo_url=String(out.logo_url||"").slice(0,1000);
 out.favicon_url=String(out.favicon_url||"").slice(0,1000);
 out.support_phone=String(out.support_phone||"").slice(0,40);
 out.whatsapp_number=String(out.whatsapp_number||"").replace(/\D/g,"").slice(0,20);
 out.office_address=String(out.office_address||"").slice(0,1000);
 out.btrc_license_number=String(out.btrc_license_number||"").slice(0,200);
 out.footer_copyright=String(out.footer_copyright||DEFAULTS.footer_copyright).slice(0,300);
 out.brand_name=out.company_name;
 return out;
}
async function queryWithTimeout(promise,ms){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Settings lookup timed out.")),ms);})]);}finally{if(timer)clearTimeout(timer);}}
async function load(force=false){
 if(!force&&cached&&Date.now()<expiresAt)return cached;
 if(refreshPromise)return refreshPromise;
 refreshPromise=(async()=>{try{
  const result=await queryWithTimeout(db.query("SELECT key,value FROM app_settings"),1200);
  const map=Object.fromEntries((result.rows||[]).map(r=>[r.key,r.value]));
  cached=normalize(map);expiresAt=Date.now()+CACHE_TTL_MS;return cached;
 }catch(error){if(cached){expiresAt=Date.now()+CACHE_TTL_MS;return cached;}cached=normalize({});expiresAt=Date.now()+CACHE_TTL_MS;return cached;}finally{refreshPromise=null;}})();
 return refreshPromise;
}
function invalidate(){expiresAt=0;}
async function getBrandSettings(){const s=await load();return {
 company_name:s.company_name,public_base_url:s.public_base_url,logo_url:s.logo_url,favicon_url:s.favicon_url,
 support_phone:s.support_phone,whatsapp_number:s.whatsapp_number,office_address:s.office_address,
 btrc_license_number:s.btrc_license_number,footer_copyright:s.footer_copyright
};}
async function getAllSettings(){return load();}
module.exports={DEFAULTS,load,getBrandSettings,getAllSettings,invalidate,bool};
