const db=require("../db");
const mikrotikService=require("../services/mikrotikService");
const {logAuditAction}=require("../utils/auditLogger");

const EXPIRED_PROFILE="EXPIRED-PROFILE";
let expiryWarningInterval=null;
const WARNING_RETRY_MINUTES=[15,30,60,180,360,360,360];


async function runExpiryWarnings(){
  const db= require("../db");
  const appSettings=require("../services/appSettings");
  try{
    const settings=await appSettings.getAllSettings();
    const dueDateSql="(NOW() AT TIME ZONE 'Asia/Dhaka')::date + 2";
    const [pppoe,hotspot]=await Promise.all([
      db.query("SELECT username,full_name,monthly_bill AS amount,phone,expiration_date FROM customers WHERE expiration_date="+dueDateSql+" AND phone IS NOT NULL AND BTRIM(phone)<>'' AND LOWER(COALESCE(status,'')) NOT IN ('expired','inactive','left','suspended') ORDER BY expiration_date,username"),
      db.query("SELECT username,phone,price AS amount,(expires_at AT TIME ZONE 'Asia/Dhaka')::date AS expiration_date FROM hotspot_vouchers WHERE expires_at IS NOT NULL AND (expires_at AT TIME ZONE 'Asia/Dhaka')::date="+dueDateSql+" AND phone IS NOT NULL AND BTRIM(phone)<>'' AND LOWER(COALESCE(status,'')) IN ('active','unused','pending_claim') ORDER BY expires_at,username")
    ]);
    let checked=0,sent=0;
    const dispatch=require("../services/notificationDispatcher").dispatchNow;
    for(const [userType,rows] of [["pppoe",pppoe.rows||[]],["hotspot",hotspot.rows||[]]]){
      for(const customer of rows){
        checked++;
        const username=String(customer.username||"").trim();if(!username||!customer.phone)continue;
        const expiry=String(customer.expiration_date||"").slice(0,10);
        const eventKey="expiry_warning:"+userType+":"+username.toLowerCase()+":"+expiry;
        const claim=await db.query(`INSERT INTO sms_notification_log(event_key,event_type,username,phone,status,attempt_count,next_attempt_at,lease_until,sms_status,whatsapp_status)
          VALUES($1,'expiry_warning',$2,$3,'pending',1,NULL,NOW()+INTERVAL '2 minutes','pending','pending')
          ON CONFLICT(event_key) DO UPDATE SET status='pending',phone=EXCLUDED.phone,
            attempt_count=sms_notification_log.attempt_count+1,next_attempt_at=NULL,
            lease_until=NOW()+INTERVAL '2 minutes'
          WHERE sms_notification_log.status='pending'
            AND sms_notification_log.attempt_count<8
            AND COALESCE(sms_notification_log.next_attempt_at,'-infinity'::timestamptz)<=NOW()
            AND COALESCE(sms_notification_log.lease_until,'-infinity'::timestamptz)<=NOW()
          RETURNING event_key,attempt_count,sms_status,whatsapp_status`,[eventKey,username,customer.phone]);
        if(!claim.rows.length)continue;
        const claimed=claim.rows[0];
        const channels=['sms','whatsapp'].filter(channel=>['pending','failed'].includes(String(claimed[channel+'_status']||'pending')));
        let dispatchedOutcomes=null;
        try{
          const result=await dispatch({userType,event:"expiry_warning",to:customer.phone,username,message:"Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.",channels,variables:{name:customer.full_name||username,username,amount:customer.amount,expiry_date:expiry}});
          const outcomes=Object.fromEntries((result.results||[]).map(item=>[item.channel,item.status||'failed']));
          dispatchedOutcomes=outcomes;
          const smsStatus=outcomes.sms||claimed.sms_status||'pending',whatsappStatus=outcomes.whatsapp||claimed.whatsapp_status||'pending';
          const retryNeeded=[smsStatus,whatsappStatus].some(status=>['pending','failed'].includes(status));
          const exhausted=Number(claimed.attempt_count)>=8&&retryNeeded;
          const terminal=!retryNeeded||exhausted;
          const backoff=WARNING_RETRY_MINUTES[Math.min(Math.max(0,Number(claimed.attempt_count)-1),WARNING_RETRY_MINUTES.length-1)];
          await db.query(`UPDATE sms_notification_log SET sms_status=$2::varchar,whatsapp_status=$3::varchar,
            status=$4::varchar,sent_at=CASE WHEN $4::varchar='sent' THEN COALESCE(sent_at,NOW()) ELSE sent_at END,
            next_attempt_at=CASE WHEN $4::varchar='pending' THEN NOW()+make_interval(mins=>$5::int) ELSE NULL END,
            lease_until=NULL WHERE event_key=$1`,[eventKey,smsStatus,whatsappStatus,exhausted?'failed':terminal?(smsStatus==='sent'||whatsappStatus==='sent'?'sent':'complete'):'pending',backoff]);
          if(smsStatus==='sent'||whatsappStatus==='sent')sent++;
        }catch(error){
          const smsStatus=dispatchedOutcomes?.sms||(['sent','skipped'].includes(claimed.sms_status)?claimed.sms_status:'failed');
          const whatsappStatus=dispatchedOutcomes?.whatsapp||(['sent','skipped'].includes(claimed.whatsapp_status)?claimed.whatsapp_status:'failed');
          const retryNeeded=[smsStatus,whatsappStatus].some(status=>['pending','failed'].includes(status));
          const exhausted=Number(claimed.attempt_count)>=8&&retryNeeded;
          const finalStatus=exhausted?'failed':retryNeeded?'pending':(smsStatus==='sent'||whatsappStatus==='sent'?'sent':'complete');
          const backoff=WARNING_RETRY_MINUTES[Math.min(Math.max(0,Number(claimed.attempt_count)-1),WARNING_RETRY_MINUTES.length-1)];
          await db.query(`UPDATE sms_notification_log SET sms_status=$2::varchar,whatsapp_status=$3::varchar,
            status=$4::varchar,next_attempt_at=CASE WHEN $4::varchar='pending' THEN NOW()+make_interval(mins=>$5::int) ELSE NULL END,
            lease_until=NULL WHERE event_key=$1`,[eventKey,smsStatus,whatsappStatus,finalStatus,backoff]).catch(()=>{});
          console.warn("[Notification Hub] Expiry warning failed for "+username+":",error.message);
        }
      }
    }
    return {checked,sent};
  }catch(error){
    console.warn("[Notification Hub] Expiry warning scan skipped:",error.message);
    return {checked:0,sent:0};
  }
}
async function runBillingExpiration(){
  const startedAt=Date.now();
  try{
    await runExpiryWarnings();
    // Single fixed expiry policy: quarantine only. The grace period is the
    // only configurable part: expiry is acted on once
    // expiration_date <= (Dhaka today - graceDays). With grace 0, a customer
    // whose expiry date is today is expired at 00:00 Asia/Dhaka today.
    const policyRows=await db.query("SELECT key,value FROM app_settings WHERE key='grace_period_days'");
    const policy=Object.fromEntries((policyRows.rows||[]).map(row=>[row.key,row.value]));
    const graceDays=Math.max(0,Math.min(7,Number.parseInt(policy.grace_period_days||"0",10)||0));
    // Expiration dates are Bangladesh calendar dates. An explicit migration
    // override allows billing to be marked expired without changing live service.
    const q=await db.query(
      "SELECT id,username,full_name,package_name,phone,expiration_date,status,billing_expiry_override FROM customers WHERE expiration_date IS NOT NULL AND expiration_date <= (NOW() AT TIME ZONE 'Asia/Dhaka')::date - $2::int AND LOWER(COALESCE(status,'')) NOT IN ('suspended','inactive','left') AND (LOWER(COALESCE(status,'')) <> 'expired' OR NOT EXISTS (SELECT 1 FROM pppoe_users u WHERE LOWER(u.username)=LOWER(customers.username) AND LOWER(COALESCE(u.profile,''))=LOWER($1))) ORDER BY expiration_date ASC,id ASC",
      [EXPIRED_PROFILE,graceDays]
    );
    if(!q.rows.length){
      console.log("[BILLING EXPIRATION] No overdue customers found.");
      return {checked:0,expired:0,failed:0};
    }

    // The quarantine profile is only needed for subscribers without an explicit
    // migration override. Never touch MikroTik for override customers.
    if(q.rows.some(customer=>customer.billing_expiry_override!==true)){
      await mikrotikService.ensureExpiredProfile();
    }
    let expired=0,failed=0;
    for(const customer of q.rows){
      try{
        const overridden=customer.billing_expiry_override===true;
        let disconnected=false;
        if(!overridden){
          // Quarantine only: the secret stays enabled and MAC binding intact
          // while the expired profile limits the line. Secrets are never
          // disabled here (disabled secrets flood MikroTik logs with
          // repeated authentication failures).
          await mikrotikService.toggleSecret(customer.username,false);
          await mikrotikService.changeSecretProfile(customer.username,EXPIRED_PROFILE);
          // Do not mark billing expiry complete when RouterOS session removal fails.
          // A confirmed empty active-session list is also a successful disconnect outcome.
          const result=await mikrotikService.kickActiveUser(customer.username);
          if(result?.kicked===true){
            disconnected=true;
          }else if(result?.count===0 && /already offline|no active pppoe session/i.test(String(result?.message||""))){
            disconnected=false;
          }else{
            throw new Error("RouterOS did not confirm active PPPoE session removal.");
          }
        }

        const notificationDispatcher=require("../services/notificationDispatcher");
        const expiryDate=String(customer.expiration_date||"").slice(0,10);
        const notificationPayload={userType:"pppoe",event:"pppoe_expired",customer,to:customer.phone,username:customer.username,message:"প্রিয় {name}, আপনার FAZ NETWORK সংযোগের মেয়াদ আজ শেষ হয়েছে এবং সংযোগটি সাময়িকভাবে বন্ধ রয়েছে। সংযোগটি পুনরায় চালু করতে রিচার্জ করুন। ধন্যবাদ।",variables:{name:customer.full_name||customer.username,username:customer.username,package:customer.package_name||"",expiry_date:expiryDate,email_idempotency_key:"pppoe-expired:"+String(customer.id)+":"+expiryDate}};
        await db.withTransaction(async client=>{
          await client.query(
            "UPDATE customers SET status='expired',billing_status='unpaid',updated_at=NOW() WHERE id=$1",
            [customer.id]
          );
          if(overridden){
            // Persist the billing state only; preserve profile, disabled flag and
            // active session for an explicitly overridden migration customer.
            await client.query(
              "UPDATE pppoe_users SET status='expired',billing_status='unpaid',synced_at=NOW(),updated_at=NOW() WHERE LOWER(username)=LOWER($1)",
              [customer.username]
            );
          }else{
            // Quarantine only: profile switches to EXPIRED-PROFILE, the
            // secret stays enabled (disabled=FALSE).
            await client.query(
              "UPDATE pppoe_users SET profile=$1,status='expired',disabled=FALSE,billing_status='unpaid',synced_at=NOW(),updated_at=NOW() WHERE LOWER(username)=LOWER($2)",
              [EXPIRED_PROFILE,customer.username]
            );
          }
          if(!overridden&&customer.phone){
            const emailResult=await notificationDispatcher.dispatchNow({...notificationPayload,channels:["email"],emailClient:client});
            if(!emailResult.success)throw new Error("Billing expiration was not committed because transactional email enqueue failed: "+JSON.stringify(emailResult.results||[]));
          }
        });
        if(!overridden&&customer.phone){
          notificationDispatcher.dispatchNotification({...notificationPayload,excludeChannels:["email"]});
        }

        await logAuditAction({
          customerId:customer.id,
          adminId:"billing-cron",
          action:"AUTO_EXPIRE",
          details:{
            message:overridden
              ?"Billing marked expired under explicit migration override; live PPPoE service unchanged"
              :"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill",
            username:customer.username,
            expirationDate:customer.expiration_date,
            expiredProfile:overridden?null:EXPIRED_PROFILE,
            expiryAction:overridden?"migration_override":"quarantine",
            gracePeriodDays:graceDays,
            migrationOverride:overridden,
            sessionDisconnected:disconnected
          },
          ipAddress:null
        });
        expired++;
      }catch(error){
        failed++;
        console.error("[BILLING EXPIRATION] Failed for "+customer.username+":",error.message);
      }
    }

    console.log("[BILLING EXPIRATION] Completed. checked="+q.rows.length+" expired="+expired+" failed="+failed+" durationMs="+(Date.now()-startedAt));
    return {checked:q.rows.length,expired,failed};
  }catch(error){
    console.error("[BILLING EXPIRATION] Worker failed:",error.message);
    return {checked:0,expired:0,failed:1,error:error.message};
  }
}

function startBillingCron(){
  runBillingExpiration().catch(error=>console.error("[BILLING EXPIRATION] Initial run failed:",error.message));
  if(expiryWarningInterval)clearInterval(expiryWarningInterval);
  expiryWarningInterval=setInterval(()=>runExpiryWarnings().catch(error=>console.error("[Notification Hub] Expiry warning retry scan failed:",error.message)),15*60*1000);
  expiryWarningInterval.unref?.();
  // Align the hourly expiry run to the top of the clock hour. Asia/Dhaka is a
  // whole-hour offset from UTC, so a run at the top of the hour also lands at
  // 00:00 Asia/Dhaka — the moment an expiry date becomes the first expired
  // day. Without alignment the run could land up to ~59 minutes late.
  const msPerHour=60*60*1000;
  const delayMs=msPerHour-(Date.now()%msPerHour);
  const timer=setTimeout(()=>{
    runBillingExpiration().catch(error=>console.error("[BILLING EXPIRATION] Scheduled run failed:",error.message));
    const interval=setInterval(
      ()=>runBillingExpiration().catch(error=>console.error("[BILLING EXPIRATION] Scheduled run failed:",error.message)),
      msPerHour
    );
    interval.unref?.();
  },delayMs);
  timer.unref?.();
  return timer;
}

module.exports={runBillingExpiration,startBillingCron,runExpiryWarnings,EXPIRED_PROFILE};
