const db=require("../db");
const mikrotikService=require("../services/mikrotikService");
const {logAuditAction}=require("../utils/auditLogger");

const EXPIRED_PROFILE="EXPIRED-PROFILE";


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
        const claim=await db.query("INSERT INTO sms_notification_log(event_key,event_type,username,phone,status) VALUES($1,'expiry_warning',$2,$3,'pending') ON CONFLICT(event_key) DO NOTHING RETURNING event_key",[eventKey,username,customer.phone]);
        if(!claim.rows.length)continue;
        try{
          const result=await dispatch({userType,event:"expiry_warning",to:customer.phone,username,message:"Reminder from FAZ NETWORK: your internet service expires in 2 days. Please renew on time to avoid service interruption.",variables:{name:customer.full_name||username,username,amount:customer.amount,expiry_date:expiry}});
          const delivered=Boolean(result.success&&result.results?.some(item=>item.status==="fulfilled"&&!item.result?.skipped));
          if(delivered){await db.query("UPDATE sms_notification_log SET status='sent',sent_at=NOW() WHERE event_key=$1",[eventKey]);sent++;}
          else await db.query("DELETE FROM sms_notification_log WHERE event_key=$1",[eventKey]);
        }catch(error){
          await db.query("DELETE FROM sms_notification_log WHERE event_key=$1",[eventKey]).catch(()=>{});
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
    const policyRows=await db.query("SELECT key,value FROM app_settings WHERE key IN ('grace_period_days','expiry_action')");
    const policy=Object.fromEntries((policyRows.rows||[]).map(row=>[row.key,row.value]));
    const graceDays=Math.max(0,Math.min(7,Number.parseInt(policy.grace_period_days||"0",10)||0));
    const expiryAction=policy.expiry_action==="disable_secret"?"disable_secret":"quarantine";
    // Expiration dates are Bangladesh calendar dates. An explicit migration
    // override allows billing to be marked expired without changing live service.
    const q=await db.query(
      "SELECT id,username,full_name,phone,expiration_date,status,billing_expiry_override FROM customers WHERE expiration_date IS NOT NULL AND expiration_date < (NOW() AT TIME ZONE 'Asia/Dhaka')::date - $2::int AND LOWER(COALESCE(status,'')) NOT IN ('suspended','inactive','left') AND (LOWER(COALESCE(status,'')) <> 'expired' OR NOT EXISTS (SELECT 1 FROM pppoe_users u WHERE LOWER(u.username)=LOWER(customers.username) AND LOWER(COALESCE(u.profile,''))=LOWER($1))) ORDER BY expiration_date ASC,id ASC",
      [EXPIRED_PROFILE,graceDays]
    );
    if(!q.rows.length){
      console.log("[BILLING EXPIRATION] No overdue customers found.");
      return {checked:0,expired:0,failed:0};
    }

    // The quarantine profile is only needed for subscribers without an explicit
    // migration override. Never touch MikroTik for override customers.
    if(expiryAction==="quarantine"&&q.rows.some(customer=>customer.billing_expiry_override!==true)){
      await mikrotikService.ensureExpiredProfile();
    }
    let expired=0,failed=0;
    for(const customer of q.rows){
      try{
        const overridden=customer.billing_expiry_override===true;
        let disconnected=false;
        if(!overridden){
          if(expiryAction==="disable_secret"){
            await mikrotikService.toggleSecret(customer.username,true);
          }else{
            // Quarantine preserves the secret and MAC visibility while applying the expired profile.
            await mikrotikService.toggleSecret(customer.username,false);
            await mikrotikService.changeSecretProfile(customer.username,EXPIRED_PROFILE);
          }
          try{
            const result=await mikrotikService.kickActiveUser(customer.username);
            disconnected=Boolean(result?.kicked);
          }catch(kickError){
            console.warn("[BILLING EXPIRATION] Session reset warning for "+customer.username+":",kickError.message);
          }
        }

        await db.query(
          "UPDATE customers SET status='expired',billing_status='unpaid',updated_at=NOW() WHERE id=$1",
          [customer.id]
        );
        if(overridden){
          // Persist the billing state only; preserve profile, disabled flag and
          // active session for an explicitly overridden migration customer.
          await db.query(
            "UPDATE pppoe_users SET status='expired',billing_status='unpaid',synced_at=NOW(),updated_at=NOW() WHERE LOWER(username)=LOWER($1)",
            [customer.username]
          );
        }else if(expiryAction==="disable_secret"){
          await db.query(
            "UPDATE pppoe_users SET status='expired',disabled=TRUE,billing_status='unpaid',synced_at=NOW(),updated_at=NOW() WHERE LOWER(username)=LOWER($1)",
            [customer.username]
          );
        }else{
          await db.query(
            "UPDATE pppoe_users SET profile=$1,status='expired',disabled=FALSE,billing_status='unpaid',synced_at=NOW(),updated_at=NOW() WHERE LOWER(username)=LOWER($2)",
            [EXPIRED_PROFILE,customer.username]
          );
        }

        if(!overridden&&customer.phone){
          require("../services/notificationDispatcher").dispatchNotification({userType:"pppoe",event:"expired",to:customer.phone,username:customer.username,message:"Your FAZ NETWORK internet service has expired due to unpaid bill. Please renew to restore service.",variables:{name:customer.full_name||customer.username,username:customer.username,expiry_date:String(customer.expiration_date||"").slice(0,10)}});
        }

        await logAuditAction({
          customerId:customer.id,
          adminId:"billing-cron",
          action:"AUTO_EXPIRE",
          details:{
            message:overridden
              ?"Billing marked expired under explicit migration override; live PPPoE service unchanged"
              :expiryAction==="disable_secret"
                ?"Auto-expired: PPPoE secret disabled due to unpaid bill"
                :"Auto-expired: Moved to EXPIRED-PROFILE (1k/1k) due to unpaid bill",
            username:customer.username,
            expirationDate:customer.expiration_date,
            expiredProfile:overridden||expiryAction==="disable_secret"?null:EXPIRED_PROFILE,
            expiryAction:overridden?"migration_override":expiryAction,
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
  return setInterval(
    ()=>runBillingExpiration().catch(error=>console.error("[BILLING EXPIRATION] Scheduled run failed:",error.message)),
    60*60*1000
  );
}

module.exports={runBillingExpiration,startBillingCron,runExpiryWarnings,EXPIRED_PROFILE};
