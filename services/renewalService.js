"use strict";
function addDays(value,days){const d=new Date(String(value||"")+"T00:00:00Z");if(Number.isNaN(d.getTime()))return null;d.setUTCDate(d.getUTCDate()+Number(days));return d.toISOString().slice(0,10);}
function addCalendarMonths(value,months){const d=new Date(String(value||"")+"T00:00:00Z");if(Number.isNaN(d.getTime()))return null;const day=d.getUTCDate(),target=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+Number(months),1)),last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(day,last));return target.toISOString().slice(0,10);}
async function calculateExpiry({durationMonths,query,currentExpiryDate,now=new Date()}){
 const result=await query("SELECT value FROM app_settings WHERE key='billing_cycle_type' LIMIT 1");
 const policy=String(result.rows?.[0]?.value||"");
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit"}).format(now);
 const current=String(currentExpiryDate||"").trim().slice(0,10);
 const base=/^\\d{4}-\\d{2}-\\d{2}$/.test(current)&&current>today?current:today;
 const months=Math.max(1,Number(durationMonths)||1);
 if(policy==="rolling_30")return addDays(base,30*months);
 return addCalendarMonths(base,months);
}
async function applyRouterRenewal(mikrotikService,username,{password,profile,comment,disabled=false,onMutation=()=>{}}){
 await mikrotikService.updateSecret(username,{password,profile,comment,disabled});
 onMutation();
 await mikrotikService.kickActiveUser(username);
 return {username,profile,comment};
}
module.exports={calculateExpiry,applyRouterRenewal};
