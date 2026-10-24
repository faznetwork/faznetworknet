"use strict";
const db=require("../db");
const RETENTION_DAYS=60;
const BATCH_SIZE=1000;
const DAY_MS=24*60*60*1000;
let running=false;
async function deleteInBatches(table){
 if(!["sms_delivery_logs","email_outbox"].includes(table))throw new Error("Unsupported notification retention table.");
 let deleted=0;
 for(;;){
  const eligibility=table==="sms_delivery_logs"?"created_at < NOW() - ($1::int * INTERVAL '1 day')":"created_at < NOW() - ($1::int * INTERVAL '1 day') AND status IN ('sent','failed')";
  const sql="WITH old_rows AS (SELECT id FROM "+table+" WHERE "+eligibility+" ORDER BY created_at,id LIMIT "+BATCH_SIZE+") DELETE FROM "+table+" target USING old_rows WHERE target.id=old_rows.id RETURNING target.id";
  const result=await db.query(sql,[RETENTION_DAYS]);
  const count=Number(result.rowCount||0);deleted+=count;
  if(count<BATCH_SIZE)break;
 }
 return deleted;
}
async function runNotificationHistoryCleanup(){
 if(running){console.warn("[NOTIFICATION RETENTION] Previous cleanup is still running; this run is skipped.");return {skipped:true};}
 running=true;
 try{
  const historyDeleted=await deleteInBatches("sms_delivery_logs");
  const terminalEmailJobsDeleted=await deleteInBatches("email_outbox");
  const summary={retentionDays:RETENTION_DAYS,historyDeleted,terminalEmailJobsDeleted,pendingAndProcessingEmailJobsPreserved:true};
  console.info("[NOTIFICATION RETENTION] Cleanup completed.",JSON.stringify(summary));
  return summary;
 }catch(error){console.error("[NOTIFICATION RETENTION] Cleanup failed:",String(error&&error.message||error));throw error;}
 finally{running=false;}
}
function startNotificationHistoryCleanup(){
 runNotificationHistoryCleanup().catch(error=>console.error("[NOTIFICATION RETENTION] Initial run failed:",error.message));
 return setInterval(()=>runNotificationHistoryCleanup().catch(error=>console.error("[NOTIFICATION RETENTION] Scheduled run failed:",error.message)),DAY_MS);
}
module.exports={RETENTION_DAYS,BATCH_SIZE,runNotificationHistoryCleanup,startNotificationHistoryCleanup,deleteInBatches};
