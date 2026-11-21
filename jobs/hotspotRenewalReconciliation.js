"use strict";

const db=require("../db");
const renewalOperations=require("../services/hotspotRenewalOperationService");

function createHotspotRenewalReconciliation(deps={}){
 const database=deps.db||db,operations=deps.operations||renewalOperations,logger=deps.logger||console;
 let running=false;
 async function runOnce(){
  if(running)return {skipped:true};
  running=true;
  let reconciled=0,failed=0;
  try{
   const stale=await operations.cleanupStaleRenewals(database,1800);
   if(stale.rowCount)logger.warn("[HOTSPOT RENEWAL RECONCILIATION] Marked "+stale.rowCount+" stale pending renewal(s) as failed.");
   const due=await database.withTransaction(async client=>{
    const selected=await client.query("SELECT id,payload,router_applied FROM hotspot_renewal_operations WHERE status='pending' AND attempts<5 AND next_attempt_at<=NOW() ORDER BY created_at,id LIMIT 10 FOR UPDATE SKIP LOCKED");
    for(const row of selected.rows||[])await client.query("UPDATE hotspot_renewal_operations SET next_attempt_at=NOW()+INTERVAL '5 minutes',updated_at=NOW() WHERE id=$1::uuid",[row.id]);
    return selected.rows||[];
   });
   for(const operation of due){
    try{
     if(!operation.router_applied){
      await operations.applyRouterRenewal(operation.payload);
      const marked=await database.query("UPDATE hotspot_renewal_operations SET router_applied=true,attempts=attempts+1,last_error=NULL,updated_at=NOW() WHERE id=$1::uuid AND status='pending' RETURNING id",[operation.id]);
      if(!marked.rows?.length)throw new Error("RouterOS renewal was applied but its reconciliation record could not be marked.");
     }
     await database.withTransaction(async client=>{
      await client.query("SELECT id FROM hotspot_vouchers WHERE id=$1 FOR UPDATE",[operation.payload.voucherId]);
      await operations.finalizeRenewal(client,operation.id,operation.payload);
     });
     reconciled++;
    }catch(error){
     failed++;
     const message=String(error?.message||error).slice(0,1000);
     await operations.failRenewal(database,operation.id,error).catch(dbError=>logger.error("[HOTSPOT RENEWAL RECONCILIATION] Could not mark renewal failed:",dbError.message));
     logger.warn("[HOTSPOT RENEWAL RECONCILIATION] Renewal failed for operation "+operation.id+": "+message);
    }
   }
   return {checked:due.length,reconciled,failed};
  }finally{running=false;}
 }
 function start(intervalMs=30000){
  runOnce().catch(error=>logger.error("[HOTSPOT RENEWAL RECONCILIATION] Initial scan failed:",error.message));
  return setInterval(()=>runOnce().catch(error=>logger.error("[HOTSPOT RENEWAL RECONCILIATION] Scheduled scan failed:",error.message)),intervalMs);
 }
 return {runOnce,start};
}
const job=createHotspotRenewalReconciliation();
module.exports={...job,createHotspotRenewalReconciliation};
