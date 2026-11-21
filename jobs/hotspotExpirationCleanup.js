"use strict";

const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

function parseRouterOsDuration(value) {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return 0;
  const re = /(\d+(?:\.\d+)?)(w|d|h|m|s)/g;
  let match, total = 0, consumed = "";
  while ((match = re.exec(text))) {
    consumed += match[0];
    const n = Number(match[1]);
    const factor = { w: 604800000, d: 86400000, h: 3600000, m: 60000, s: 1000 }[match[2]];
    total += n * factor;
  }
  return consumed.length === text.replace(/\s+/g, "").length ? total : 0;
}

function parseFirstLoginAt(comment) {
  const value = String(comment || "").match(/FIRST_LOGIN=([^|]+)/i)?.[1]?.trim();
  if (!value) return null;
  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (match) {
    const date = new Date(match[1] + "-" + match[2] + "-" + match[3] + "T" + match[4] + "+06:00");
    return Number.isNaN(date.getTime()) ? null : date;
  }
  match = value.match(/^([a-z]{3})\/(\d{1,2})\/(\d{4})\s+(\d{2}:\d{2}:\d{2})$/i);
  if (!match) return null;
  const months = { jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06", jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12" };
  const month = months[match[1].toLowerCase()];
  if (!month) return null;
  const day = String(match[2]).padStart(2, "0");
  const date = new Date(match[3] + "-" + month + "-" + day + "T" + match[4] + "+06:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseCommentExpiry(comment) {
  const match = String(comment || "").match(/(?:^|[|;\s])EXP:\s*(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}:\d{2}))?/i);
  if (!match) return null;
  const date = match[2]
    ? new Date(match[1] + "T" + match[2] + "+06:00")
    : new Date(match[1] + "T23:59:59+06:00");
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseValidityMs(value) {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)(m|h|d|w)$/i);
  if (!match) return 0;
  return Number(match[1]) * ({ m: 60000, h: 3600000, d: 86400000, w: 604800000 }[match[2].toLowerCase()]);
}

function routerUserExpired(user, schedulerNames) {
  const comment = String(user?.comment || "");
  const managed = /FAZ\|PROFILE=/i.test(comment);
  const dataOnly = /^FAZ\|DATA_ONLY$/i.test(comment.trim());
  if (/FAZ\|EXPIRED(?:\||$)/i.test(comment)) return true;
  const expValue = comment.match(/(?:^|\|)EXP(?::|=)\s*([^|]+)/i)?.[1]?.trim();
  if (expValue && !["PENDING","0"].includes(expValue.toUpperCase())) {
    const epoch = /^\d+$/.test(expValue) ? Number(expValue) * 1000 : NaN;
    const dhakaMatch = expValue.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
    const dateOnly = expValue.match(/^(\d{4}-\d{2}-\d{2})$/);
    const expDate = Number.isFinite(epoch) ? new Date(epoch) : dhakaMatch
      ? new Date(dhakaMatch[1] + "-" + dhakaMatch[2] + "-" + dhakaMatch[3] + "T" + dhakaMatch[4] + "+06:00")
      : dateOnly ? new Date(dateOnly[1] + "T23:59:59+06:00") : new Date(expValue);
    // RouterOS schedulers are not authoritative; expiry is reconciled centrally.
    if (!Number.isNaN(expDate.getTime()) && expDate.getTime() <= Date.now()) return true;
  }
  if (!managed && !dataOnly) return false;

  const byteLimit = Math.max(0, Number(user.limitBytesTotal) || 0);
  const usedBytes = Math.max(0, Number(user.bytesIn) || 0) + Math.max(0, Number(user.bytesOut) || 0);
  return byteLimit > 0 && usedBytes >= byteLimit;
}

async function purgeExpiredHotspotUser(router, username, macAddress) {
  if (typeof router.cleanupExpiredHotspotUser !== "function") throw new Error("RouterOS does not expose the required hard-purge operation.");
  const result = await router.cleanupExpiredHotspotUser(username, macAddress);
  if (!result?.verified) {
    const error = new Error("RouterOS four-layer purge was not verified; voucher MAC binding must remain intact.");
    error.code = "HOTSPOT_PURGE_NOT_VERIFIED";
    throw error;
  }
  return result;
}

function createHotspotExpirationCleanup(deps = {}) {
  const database = deps.db || db;
  const router = deps.mikrotikService || mikrotikService;
  const logger = deps.logger || console;
  const notificationDispatcher = deps.notificationDispatcher || require("../services/notificationDispatcher");
  const now = deps.now || (() => new Date());
  let running = false;
  let scanCursor = 0;
  let batchContinuation = false;
  let batchContinuationUrgent = false;
  const MAX_EXPIRY_BATCH_SIZE = 5;

  const runHotspotExpirationCleanup = async function runHotspotExpirationCleanup() {
    if (running && !deps.allowConcurrent) return { skipped: true, reason: "already_running" };
    running = true;
    const startedAt = Date.now();
    let checked = 0, activated = 0, expired = 0, removed = 0, failed = 0, preExpiryNotified = 0;
    batchContinuation = false;
    batchContinuationUrgent = false;
    try {
      // Atomically claim due alerts so multiple application instances cannot send the same voucher alert twice.
      try {
        const dueAlerts = await database.query(
          "WITH due AS (SELECT id FROM hotspot_vouchers WHERE status='active' AND expires_at > NOW() AND expires_at <= NOW() + INTERVAL '5 minutes' AND pre_expiry_notified IS NOT TRUE ORDER BY expires_at ASC, id ASC LIMIT $1 FOR UPDATE SKIP LOCKED) UPDATE hotspot_vouchers AS v SET pre_expiry_notified=TRUE, updated_at=NOW() FROM due WHERE v.id=due.id RETURNING v.id,v.username,v.phone,v.customer_name,v.profile,v.price,v.expires_at",
          [MAX_EXPIRY_BATCH_SIZE]
        );
        await Promise.all((dueAlerts.rows||[]).map(async voucher=>{
          const phone=String(voucher.phone||'').trim();
          if(!phone||phone.toLowerCase()==='unlinked'){ logger.warn('[HOTSPOT PRE-EXPIRY] Skipped voucher '+voucher.id+': no linked customer phone.'); return; }
          const customerName=String(voucher.customer_name||'গ্রাহক').trim()||'গ্রাহক';
          const notification=notificationDispatcher.dispatchNotification({userType:'hotspot',event:'hotspot_expiring_soon',to:phone,recipient:phone,phone,username:voucher.username,customerName,customer:{username:voucher.username,name:customerName,phone,profile:voucher.profile},message:`আসসালামু আলাইকুম ${customerName}, আপনার FAZ NETWORK হটস্পট প্যাকেজের মেয়াদ আগামী ৫ মিনিটের মধ্যে শেষ হতে যাচ্ছে। নিরবচ্ছিন্ন ইন্টারনেট সংযোগ বজায় রাখতে এখনই রিচার্জ করুন। হেল্পলাইন: 01339932887`,useMessageDirectly:true,channels:['sms','whatsapp'],variables:{name:customerName,username:voucher.username,package:voucher.profile||'হটস্পট প্যাকেজ',profile:voucher.profile||'',amount:voucher.price,expiry_date:voucher.expires_at?new Date(voucher.expires_at).toISOString():''}});
          if(notification?.task){ const delivery=await notification.task; if(!delivery?.success)logger.warn('[HOTSPOT PRE-EXPIRY] One or more notification channels failed for voucher '+voucher.id+'. The alert claim is retained to avoid duplicate SMS retries.'); }
          preExpiryNotified++;
        }));
      } catch (alertError) { logger.error('[HOTSPOT PRE-EXPIRY] Scanner failed; normal expiry cleanup will continue:',alertError.message); }
      const result = await database.query(
        "SELECT id,username,status,comment,validity,first_login_at,expires_at,cleanup_status,phone,price,profile,renewal_stacked,mac_address,last_known_mac " +
        "FROM hotspot_vouchers WHERE (status IN ('unused','active') OR (status='pending_claim' AND expires_at IS NOT NULL) OR (status='expired' AND cleanup_status IN ('pending','not_required','failed'))) " +
        "AND (id > $1 OR status='expired' OR expires_at <= NOW()) " +
        "ORDER BY CASE WHEN status IN ('active','unused','pending_claim') AND expires_at <= NOW() THEN 0 WHEN status='expired' THEN 1 ELSE 2 END, expires_at ASC NULLS LAST, id ASC LIMIT $2",
        [scanCursor, MAX_EXPIRY_BATCH_SIZE]
      );

      // Database expiry must continue even during a temporary RouterOS outage.
      // In that case, persist expired/pending state and let the targeted router
      // cleanup fail safely so the next hourly run can retry it.
      let snapshot = { users: [], schedulerNames: [] };
      let snapshotAvailable = true;
      try {
        snapshot = await router.getHotspotExpirationSnapshot();
      } catch (error) {
        snapshotAvailable = false;
        logger.warn("[HOTSPOT EXPIRY] RouterOS snapshot unavailable; using persisted expiry and retrying cleanup later:", error.message);
      }
      const users = new Map((snapshot.users || []).map(user => [String(user.username || "").toLowerCase(), user]));
      const schedulerNames = new Set((snapshot.schedulerNames || []).map(name => String(name).toLowerCase()));

      const candidates = Array.isArray(result.rows) ? result.rows : [];
      const batchRows = candidates.slice(0, MAX_EXPIRY_BATCH_SIZE);
      batchContinuation = candidates.length >= MAX_EXPIRY_BATCH_SIZE;
      batchContinuationUrgent = batchRows.some(voucher => voucher.status !== "expired" &&
        voucher.expires_at && new Date(voucher.expires_at).getTime() <= now().getTime());
      const rotatingRows = batchRows.filter(voucher => voucher.status !== "expired" &&
        !(voucher.expires_at && new Date(voucher.expires_at).getTime() <= now().getTime()));
      if (rotatingRows.length) scanCursor = Math.max(scanCursor, ...rotatingRows.map(voucher => Number(voucher.id) || 0));
      if (batchRows.length < MAX_EXPIRY_BATCH_SIZE && scanCursor > 0) {
        scanCursor = 0;
        batchContinuation = true;
      } else if (batchRows.length === 0 && scanCursor === 0) batchContinuation = false;

      for (const voucher of batchRows) {
        checked++;
        const username = String(voucher.username || "").trim();
        const voucherMac = String(voucher.mac_address || voucher.last_known_mac || (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(username) ? username : "")).trim();
        const user = users.get(username.toLowerCase());
        const pendingCleanup = voucher.status === "expired" && ["pending", "not_required", "failed"].includes(voucher.cleanup_status);
        if (pendingCleanup) {
          try {
            await purgeExpiredHotspotUser(router, username, voucherMac);
            await database.query(
              "UPDATE hotspot_vouchers AS v SET status='expired', " +
              "mac_audit_history=CASE WHEN NULLIF($2::text,'') IS NOT NULL AND NOT (COALESCE(v.mac_audit_history,'[]'::jsonb) @> jsonb_build_array($2::text)) THEN COALESCE(v.mac_audit_history,'[]'::jsonb) || jsonb_build_array($2::text) ELSE COALESCE(v.mac_audit_history,'[]'::jsonb) END, " +
              "last_known_mac=COALESCE(NULLIF(v.mac_address,''),NULLIF(v.last_known_mac,''),NULLIF($2::text,'')), mac_address=NULL, " +
              "cleanup_status='completed',cleanup_attempts=cleanup_attempts+1,cleanup_error=NULL,updated_at=NOW() WHERE id=$1 AND status='expired'",
              [voucher.id, voucherMac]
            );
            removed++;
          } catch (error) {
            failed++;
            await database.query(
              "UPDATE hotspot_vouchers SET cleanup_status='pending',cleanup_attempts=cleanup_attempts+1,cleanup_error=$1,updated_at=NOW() WHERE id=$2",
              [String(error.message || "MikroTik cleanup failed").slice(0, 1000), voucher.id]
            ).catch(dbError => logger.error("[HOTSPOT EXPIRY] Failed to record cleanup retry:", dbError.message));
            logger.warn("[HOTSPOT EXPIRY] Cleanup will retry for " + username + ": " + error.message);
          }
          continue;
        }

        const comment = String(user?.comment || "");
        const firstLogin = parseFirstLoginAt(comment);
        const hasLoginMarker = Boolean(user && /FAZ\|PROFILE=/i.test(comment) && firstLogin);
        let effectiveStatus = voucher.status;
        let expiryAt = voucher.expires_at ? new Date(voucher.expires_at) : null;
        if (expiryAt && Number.isNaN(expiryAt.getTime())) expiryAt = null;

        if (voucher.status === "unused" && hasLoginMarker) {
          const validity = parseValidityMs(comment.match(/VALIDITY=([^|]+)/i)?.[1]);
          if (!expiryAt && firstLogin && validity) expiryAt = new Date(firstLogin.getTime() + validity);
          await database.query(
            "UPDATE hotspot_vouchers SET status='active',first_login_at=COALESCE(first_login_at,$1),expires_at=COALESCE(expires_at,$2),updated_at=NOW() WHERE id=$3 AND status='unused'",
            [firstLogin, expiryAt, voucher.id]
          );
          activated++;
          effectiveStatus = "active";
        } else if (voucher.status === "active" && hasLoginMarker && firstLogin) {
          const validity = parseValidityMs(comment.match(/VALIDITY=([^|]+)/i)?.[1]);
          if (!expiryAt && validity) expiryAt = new Date(firstLogin.getTime() + validity);
          await database.query(
            "UPDATE hotspot_vouchers SET first_login_at=COALESCE(first_login_at,$1),expires_at=COALESCE(expires_at,$2),updated_at=NOW() WHERE id=$3",
            [firstLogin, expiryAt, voucher.id]
          );
        }

        // Persist the absolute deadline marker for auditability; PostgreSQL remains authoritative.
        if (hasLoginMarker && expiryAt instanceof Date && !Number.isNaN(expiryAt.getTime()) &&
            /(?:^|\|)EXP(?::|=)\s*(?:PENDING|0)(?:\||$)/i.test(comment) && typeof router.setHotspotUserComment === "function") {
          const absoluteExpiry = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(expiryAt).replace("T", " ");
          const absoluteComment = "Exp: " + absoluteExpiry;
          await router.setHotspotUserComment(username, absoluteComment).catch(error =>
            logger.warn("[HOTSPOT EXPIRY] Could not persist absolute expiry comment for " + username + ": " + error.message));
        }

        // PostgreSQL's first-login expiry is authoritative when available. This
        // covers missed RouterOS scheduler events and users already absent from
        // the router, without ever expiring an unused voucher by creation date.
        const currentTime = now();
        const databaseExpiryReached = ["active", "unused", "pending_claim"].includes(effectiveStatus) &&
          expiryAt instanceof Date && !Number.isNaN(expiryAt.getTime()) &&
          expiryAt.getTime() <= currentTime.getTime();
        const commentExpiry = parseCommentExpiry(voucher.comment);
        // A successful router snapshot that no longer contains a MAC-named account
        // means its one-shot expiry scheduler (or an administrator) removed it.
        // Do not infer absence while RouterOS itself is unreachable.
        const macNamedVoucher = /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(username);
        // A renewal is deliberately staged in PostgreSQL before RouterOS is touched.
        // The old RouterOS scheduler may remove the prior user at its original deadline;
        // do not mistake that expected gap for expiry while the staged cumulative expiry is still future.
        const stagedFutureRenewal = effectiveStatus === "pending_claim" && voucher.renewal_stacked === true &&
          expiryAt instanceof Date && !Number.isNaN(expiryAt.getTime()) && expiryAt.getTime() > currentTime.getTime();
        // Router absence alone must never cut a paid validity short. A user can be
        // missing from the snapshot because its router account is still being
        // created (activation race), an administrator removed it, or the snapshot
        // missed it — none of those mean the customer's meyad ended. Only treat
        // absence as expiry when PostgreSQL holds no future expiry for it. A
        // still-valid voucher stays active so the portal can re-provision it.
        const hasFutureDbExpiry = expiryAt instanceof Date && !Number.isNaN(expiryAt.getTime()) &&
          expiryAt.getTime() > currentTime.getTime();
        const routerUserMissing = !stagedFutureRenewal && snapshotAvailable && !user && macNamedVoucher &&
          ["active", "unused", "pending_claim"].includes(effectiveStatus);
        const missingMacUser = routerUserMissing && !hasFutureDbExpiry;
        if (routerUserMissing && !missingMacUser) {
          logger.warn("[HOTSPOT EXPIRY] Router user missing for still-valid voucher " + username + " (expires " + expiryAt.toISOString() + "); leaving active for portal re-provision.");
        }
        const commentExpiryReached = !stagedFutureRenewal && !user && ["active", "unused", "pending_claim"].includes(effectiveStatus) &&
          commentExpiry instanceof Date && commentExpiry.getTime() <= currentTime.getTime();
        const routerExpiryReached = !stagedFutureRenewal && Boolean(user && routerUserExpired(user, schedulerNames));
        if (!databaseExpiryReached && !commentExpiryReached && !routerExpiryReached && !missingMacUser) continue;

        const dataOnlyQuotaExhausted = Boolean(user && /^FAZ\|DATA_ONLY$/i.test(String(user.comment || "").trim()) &&
          Number(user.limitBytesTotal) > 0 && Number(user.bytesIn || 0) + Number(user.bytesOut || 0) >= Number(user.limitBytesTotal));

        await database.query(
          "UPDATE hotspot_vouchers SET status='expired',first_login_at=COALESCE(first_login_at,$1),expires_at=CASE WHEN $4::boolean THEN expires_at ELSE COALESCE(expires_at,$2) END,expired_at=COALESCE(expired_at,$2),cleanup_status='pending',cleanup_error=NULL,updated_at=NOW() WHERE id=$3",
          [firstLogin, databaseExpiryReached ? expiryAt : commentExpiryReached ? commentExpiry : currentTime, voucher.id, dataOnlyQuotaExhausted]
        );
        expired++;
        const contact=voucher;
        const actualExpiry=expiryAt instanceof Date?expiryAt:(commentExpiry instanceof Date?commentExpiry:currentTime);
        if(contact.phone){require("../services/notificationDispatcher").dispatchNotification({userType:"hotspot",event:"hotspot_expired",to:contact.phone,username,message:"প্রিয় {name}, আপনার হটস্পট প্যাকেজের মেয়াদ শেষ হয়েছে। ইন্টারনেট সেবা পেতে নতুন প্যাকেজ ক্রয় করুন।",variables:{name:contact.phone||username,username,package:contact.profile||"",amount:contact.price,expiry_date:actualExpiry.toISOString().slice(0,10)}});}
        try {
          await purgeExpiredHotspotUser(router, username, voucherMac);
          await database.query(
            "UPDATE hotspot_vouchers AS v SET status='expired', " +
            "mac_audit_history=CASE WHEN NULLIF($2::text,'') IS NOT NULL AND NOT (COALESCE(v.mac_audit_history,'[]'::jsonb) @> jsonb_build_array($2::text)) THEN COALESCE(v.mac_audit_history,'[]'::jsonb) || jsonb_build_array($2::text) ELSE COALESCE(v.mac_audit_history,'[]'::jsonb) END, " +
            "last_known_mac=COALESCE(NULLIF(v.mac_address,''),NULLIF(v.last_known_mac,''),NULLIF($2::text,'')), mac_address=NULL, " +
            "cleanup_status='completed',cleanup_attempts=cleanup_attempts+1,cleanup_error=NULL,updated_at=NOW() WHERE id=$1 AND status='expired'",
            [voucher.id, voucherMac]
          );
          removed++;
        } catch (error) {
          failed++;
          await database.query(
            "UPDATE hotspot_vouchers SET cleanup_status='pending',cleanup_attempts=cleanup_attempts+1,cleanup_error=$1,updated_at=NOW() WHERE id=$2",
            [String(error.message || "MikroTik cleanup failed").slice(0, 1000), voucher.id]
          ).catch(dbError => logger.error("[HOTSPOT EXPIRY] Failed to record cleanup retry:", dbError.message));
          logger.warn("[HOTSPOT EXPIRY] Cleanup will retry for " + username + ": " + error.message);
        }
      }

      const summary = { checked, activated, expired, removed, failed, preExpiryNotified, durationMs: Date.now() - startedAt };
      if (checked || failed) logger.log("[HOTSPOT EXPIRY] Completed.", summary);
      return summary;
    } catch (error) {
      logger.error("[HOTSPOT EXPIRY] Worker failed; records were retained for retry:", error.message);
      return { checked, activated, expired, removed, failed: failed + 1, error: error.message };
    } finally {
      running = false;
    }
  };
  runHotspotExpirationCleanup.getBatchContinuationState = () => ({
    pending: batchContinuation,
    urgent: batchContinuationUrgent
  });
  return runHotspotExpirationCleanup;
}

async function runHotspotRetentionCleanup(deps = {}) {
  const database = deps.db || db;
  const router = deps.mikrotikService || mikrotikService;
  const logger = deps.logger || console;
  try {
    // Retain voucher sales/reporting rows for 395 days. Financial transactions are never deleted here.
    const candidates = await database.query(
      "SELECT id,username,mac_address FROM hotspot_vouchers WHERE status='expired' AND cleanup_status='completed' AND expires_at < NOW() - INTERVAL '395 days' ORDER BY id ASC"
    );
    const purgeIds = [];
    for (const row of candidates.rows || []) {
      try {
        if (typeof router.cleanupExpiredHotspotUser !== "function") throw new Error("RouterOS cleanup operation is unavailable.");
        await router.cleanupExpiredHotspotUser(row.username, row.mac_address);
        purgeIds.push(row.id);
      } catch (error) {
        logger.warn("[HOTSPOT RETENTION] RouterOS purge failed; retaining subscriber " + row.id + " for retry: " + error.message);
      }
    }
    if (!purgeIds.length) return { archivedTransactions: 0, deletedVouchers: 0, routerPurgeFailed: (candidates.rows || []).length };
    const archived = await database.query(
      "INSERT INTO hotspot_voucher_sales_archive(transaction_id,channel,trx_id,sender_phone,amount,status,matched_username,created_at,voucher_count,sale_type,subscriber_type) " +
      "SELECT t.id,t.channel,t.trx_id,t.sender_phone,t.amount,t.status,t.matched_username,t.created_at,COUNT(DISTINCT v.id)::integer,COALESCE(t.sale_type,hp.sale_type),MAX(v.subscriber_type) " +
      "FROM transactions t INNER JOIN hotspot_voucher_payments hp ON hp.transaction_id=t.id INNER JOIN hotspot_vouchers v ON v.id=hp.voucher_id " +
      "WHERE v.id = ANY($1::bigint[]) AND v.status='expired' AND v.cleanup_status='completed' GROUP BY t.id,t.channel,t.trx_id,t.sender_phone,t.amount,t.status,t.matched_username,t.created_at,t.sale_type,hp.sale_type " +
      "ON CONFLICT(transaction_id) DO NOTHING RETURNING transaction_id",
      [purgeIds]
    );
    const archivedVouchers = await database.query(
      "UPDATE hotspot_vouchers AS v SET status='archived', " +
      "mac_audit_history=COALESCE(v.mac_audit_history,'[]'::jsonb) || COALESCE((SELECT jsonb_agg(mac_value ORDER BY ordinal) FROM (SELECT DISTINCT ON (mac_value) mac_value,ordinal FROM (VALUES (1,NULLIF(v.last_known_mac,'')),(2,NULLIF(v.mac_address,''))) AS candidates(ordinal,mac_value) WHERE mac_value IS NOT NULL AND mac_value<>'' ORDER BY mac_value,ordinal) AS unique_macs),'[]'::jsonb), " +
      "last_known_mac=COALESCE(NULLIF(v.mac_address,''),NULLIF(v.last_known_mac,'')), mac_address=NULL, " +
      "updated_at=NOW() WHERE v.id = ANY($1::bigint[]) AND v.status='expired' AND v.cleanup_status='completed' " +
      "AND v.expires_at < NOW() - INTERVAL '395 days' RETURNING v.id",
      [purgeIds]
    );
    const result = {
      archivedTransactions: (archived.rows || []).length,
      archivedVouchers: (archivedVouchers.rows || []).length,
      routerPurgeFailed: (candidates.rows || []).length - purgeIds.length
    };
    if (result.archivedTransactions || result.archivedVouchers) logger.log("[HOTSPOT RETENTION] Completed without deleting voucher or financial rows.", result);
    return result;
  } catch (error) {
    logger.error("[HOTSPOT RETENTION] Failed; voucher rows were retained:", error.message);
    return { archivedTransactions: 0, deletedVouchers: 0, error: error.message };
  }
}
const runHotspotExpirationCleanup = createHotspotExpirationCleanup();

function startHotspotExpirationCleanup(deps = {}) {
  const database = deps.db || db;
  const logger = deps.logger || console;
  const runCleanup = createHotspotExpirationCleanup(deps);
  let timer = null;
  let stopped = false;
  const scheduleNext = async () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    try {
      const next = await database.query("SELECT MIN(CASE WHEN status='active' AND pre_expiry_notified IS NOT TRUE AND expires_at > NOW() THEN expires_at - INTERVAL '5 minutes' ELSE expires_at END) AS next_at, BOOL_OR(status='expired' AND cleanup_status IN ('pending','not_required','failed')) AS retry_due FROM hotspot_vouchers WHERE ((status IN ('unused','active','pending_claim') AND expires_at IS NOT NULL) OR (status='expired' AND cleanup_status IN ('pending','not_required','failed')))");
      const row = next.rows?.[0] || {};
      const nextAt = row.next_at ? new Date(row.next_at).getTime() : Infinity;
      const continuation = runCleanup.getBatchContinuationState();
      const delay = continuation.pending
        ? (continuation.urgent ? 1000 : 30000)
        : row.retry_due ? 30000 : Math.max(1000, Math.min(2147483647, Number.isFinite(nextAt) ? nextAt - Date.now() : 2147483647));
      timer = setTimeout(async () => {
        try { await runCleanup(); }
        catch (error) { logger.error("[HOTSPOT EXPIRY] Scheduled run failed:", error.message); }
        await scheduleNext();
      }, delay);
      if (typeof timer.unref === "function") timer.unref();
    } catch (error) {
      logger.error("[HOTSPOT EXPIRY] Could not schedule next expiry; retrying scheduler setup:", error.message);
      timer = setTimeout(() => scheduleNext().catch(err => logger.error("[HOTSPOT EXPIRY] Scheduler recovery failed:", err.message)), 30000);
      if (typeof timer.unref === "function") timer.unref();
    }
  };
  runCleanup().then(scheduleNext).catch(error => {
    logger.error("[HOTSPOT EXPIRY] Startup recovery sweep failed:", error.message);
    scheduleNext().catch(err => logger.error("[HOTSPOT EXPIRY] Scheduler setup failed:", err.message));
  });
  return () => { stopped = true; if (timer) clearTimeout(timer); };
}

function startHotspotRetentionCleanup() {
  runHotspotRetentionCleanup().catch(error => console.error("[HOTSPOT RETENTION] Initial run failed:", error.message));
  const interval = 60 * 60 * 1000;
  return setInterval(() => runHotspotRetentionCleanup().catch(error => console.error("[HOTSPOT RETENTION] Scheduled run failed:", error.message)), interval);
}

module.exports = {
  runHotspotExpirationCleanup,
  startHotspotExpirationCleanup,
  runHotspotRetentionCleanup,
  startHotspotRetentionCleanup,
  createHotspotExpirationCleanup,
  parseRouterOsDuration,
  parseFirstLoginAt,
  parseValidityMs,
  routerUserExpired
};
