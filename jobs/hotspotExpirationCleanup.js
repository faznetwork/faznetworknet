"use strict";

const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

const MINUTE_MS = 60 * 1000;

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
  const username = String(user?.username || "");
  const schedulerName = "faz-exp-" + username;
  const hasExpiryScheduler = schedulerNames.has(schedulerName.toLowerCase());
  const managed = /FAZ\|PROFILE=/i.test(comment);
  if (/FAZ\|EXPIRED(?:\||$)/i.test(comment)) return true;
  const expValue = comment.match(/(?:^|\|)EXP(?::|=)\s*([^|]+)/i)?.[1]?.trim();
  if (expValue && !["PENDING","0"].includes(expValue.toUpperCase())) {
    const epoch = /^\d+$/.test(expValue) ? Number(expValue) * 1000 : NaN;
    const dhakaMatch = expValue.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
    const dateOnly = expValue.match(/^(\d{4}-\d{2}-\d{2})$/);
    const expDate = Number.isFinite(epoch) ? new Date(epoch) : dhakaMatch
      ? new Date(dhakaMatch[1] + "-" + dhakaMatch[2] + "-" + dhakaMatch[3] + "T" + dhakaMatch[4] + "+06:00")
      : dateOnly ? new Date(dateOnly[1] + "T23:59:59+06:00") : new Date(expValue);
    // When a first-login scheduler exists, its exact duration-based deadline
    // takes precedence over the date-only purchase comment.
    if (!Number.isNaN(expDate.getTime()) && expDate.getTime() <= Date.now() && !hasExpiryScheduler) return true;
  }
  if (!managed) return false;
  if (user.disabled && !hasExpiryScheduler) return true;

  const byteLimit = Math.max(0, Number(user.limitBytesTotal) || 0);
  const usedBytes = Math.max(0, Number(user.bytesIn) || 0) + Math.max(0, Number(user.bytesOut) || 0);
  return byteLimit > 0 && usedBytes >= byteLimit;
}

function createHotspotExpirationCleanup(deps = {}) {
  const database = deps.db || db;
  const router = deps.mikrotikService || mikrotikService;
  const logger = deps.logger || console;
  const now = deps.now || (() => new Date());
  let running = false;

  return async function runHotspotExpirationCleanup() {
    if (running && !deps.allowConcurrent) return { skipped: true, reason: "already_running" };
    running = true;
    const startedAt = Date.now();
    let checked = 0, activated = 0, expired = 0, removed = 0, failed = 0;
    try {
      const result = await database.query(
        "SELECT id,username,status,comment,validity,first_login_at,expires_at,cleanup_status,phone,price,profile FROM hotspot_vouchers WHERE status IN ('unused','active') OR (status='pending_claim' AND expires_at IS NOT NULL) OR (status='expired' AND cleanup_status IN ('pending','not_required','failed')) ORDER BY id ASC"
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

      for (const voucher of result.rows || []) {
        checked++;
        const username = String(voucher.username || "").trim();
        const user = users.get(username.toLowerCase());
        const pendingCleanup = voucher.status === "expired" && ["pending", "not_required", "failed"].includes(voucher.cleanup_status);
        if (pendingCleanup) {
          try {
            await router.cleanupExpiredHotspotUser(username);
            await database.query(
              "UPDATE hotspot_vouchers SET cleanup_status='completed',cleanup_attempts=cleanup_attempts+1,cleanup_error=NULL,router_removed_at=COALESCE(router_removed_at,NOW()),updated_at=NOW() WHERE id=$1",
              [voucher.id]
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
          const absoluteComment = comment.replace(/(?:^|\|)EXP(?::|=)\s*(?:PENDING|0)(?=\||$)/i, function(match) {
            return match.startsWith("|") ? "|EXP: " + absoluteExpiry : "EXP: " + absoluteExpiry;
          });
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
        const missingMacUser = snapshotAvailable && !user && macNamedVoucher &&
          ["active", "unused", "pending_claim"].includes(effectiveStatus);
        const commentExpiryReached = !user && ["active", "unused", "pending_claim"].includes(effectiveStatus) &&
          commentExpiry instanceof Date && commentExpiry.getTime() <= currentTime.getTime();
        const routerExpiryReached = Boolean(user && routerUserExpired(user, schedulerNames));
        if (!databaseExpiryReached && !commentExpiryReached && !routerExpiryReached && !missingMacUser) continue;

        await database.query(
          "UPDATE hotspot_vouchers SET status='expired',first_login_at=COALESCE(first_login_at,$1),expired_at=COALESCE(expired_at,$2),cleanup_status='pending',cleanup_error=NULL,updated_at=NOW() WHERE id=$3",
          [firstLogin, databaseExpiryReached ? expiryAt : commentExpiryReached ? commentExpiry : currentTime, voucher.id]
        );
        expired++;
        const contact=voucher;
        const actualExpiry=expiryAt instanceof Date?expiryAt:(commentExpiry instanceof Date?commentExpiry:currentTime);
        if(contact.phone){require("../services/notificationDispatcher").dispatchNotification({userType:"hotspot",event:"hotspot_expired",to:contact.phone,username,message:"প্রিয় {name}, আপনার হটস্পট প্যাকেজের মেয়াদ শেষ হয়েছে। ইন্টারনেট সেবা পেতে নতুন প্যাকেজ ক্রয় করুন।",variables:{name:contact.phone||username,username,package:contact.profile||"",amount:contact.price,expiry_date:actualExpiry.toISOString().slice(0,10)}});}
        try {
          await router.cleanupExpiredHotspotUser(username);
          await database.query(
            "UPDATE hotspot_vouchers SET cleanup_status='completed',cleanup_attempts=cleanup_attempts+1,cleanup_error=NULL,router_removed_at=COALESCE(router_removed_at,$1),updated_at=NOW() WHERE id=$2",
            [now(), voucher.id]
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

      const summary = { checked, activated, expired, removed, failed, durationMs: Date.now() - startedAt };
      if (checked || failed) logger.log("[HOTSPOT EXPIRY] Completed.", summary);
      return summary;
    } catch (error) {
      logger.error("[HOTSPOT EXPIRY] Worker failed; records were retained for retry:", error.message);
      return { checked, activated, expired, removed, failed: failed + 1, error: error.message };
    } finally {
      running = false;
    }
  };
}

async function runHotspotRetentionCleanup(deps = {}) {
  const database = deps.db || db;
  const logger = deps.logger || console;
  try {
    const archived = await database.query(
      "INSERT INTO hotspot_voucher_sales_archive(transaction_id,channel,trx_id,sender_phone,amount,status,matched_username,created_at) " +
      "SELECT t.id,t.channel,t.trx_id,t.sender_phone,t.amount,t.status,t.matched_username,t.created_at " +
      "FROM transactions t INNER JOIN hotspot_vouchers v ON LOWER(v.username)=LOWER(t.matched_username) " +
      "WHERE v.status='expired' AND v.cleanup_status='completed' AND v.expired_at <= NOW() - INTERVAL '3 days' " +
      "ON CONFLICT(transaction_id) DO NOTHING RETURNING transaction_id"
    );
    const deleted = await database.query(
      "DELETE FROM hotspot_vouchers WHERE status='expired' AND cleanup_status='completed' AND expired_at <= NOW() - INTERVAL '3 days' RETURNING id"
    );
    const result = { archivedTransactions: (archived.rows || []).length, deletedVouchers: (deleted.rows || []).length };
    if (result.archivedTransactions || result.deletedVouchers) logger.log("[HOTSPOT RETENTION] Completed.", result);
    return result;
  } catch (error) {
    logger.error("[HOTSPOT RETENTION] Failed; voucher rows were retained:", error.message);
    return { archivedTransactions: 0, deletedVouchers: 0, error: error.message };
  }
}

function startHotspotRetentionCleanup() {
  runHotspotRetentionCleanup().catch(error => console.error("[HOTSPOT RETENTION] Initial run failed:", error.message));
  let lastRunDate = "";
  return setInterval(() => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hourCycle: "h23"
    }).formatToParts(new Date()).reduce((acc, part) => { acc[part.type] = part.value; return acc; }, {});
    const dateKey = parts.year + "-" + parts.month + "-" + parts.day;
    if (parts.hour === "00" && parts.minute === "00" && lastRunDate !== dateKey) {
      lastRunDate = dateKey;
      runHotspotRetentionCleanup().catch(error => console.error("[HOTSPOT RETENTION] Scheduled run failed:", error.message));
    }
  }, MINUTE_MS);
}

const runHotspotExpirationCleanup = createHotspotExpirationCleanup();

function startHotspotExpirationCleanup() {
  runHotspotExpirationCleanup().catch(error => console.error("[HOTSPOT EXPIRY] Initial run failed:", error.message));
  return setInterval(() => runHotspotExpirationCleanup().catch(error => console.error("[HOTSPOT EXPIRY] Scheduled run failed:", error.message)), MINUTE_MS);
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
