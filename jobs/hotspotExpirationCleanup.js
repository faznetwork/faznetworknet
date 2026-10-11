"use strict";

const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

const HOUR_MS = 60 * 60 * 1000;

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

function parseValidityMs(value) {
  const match = String(value || "").trim().match(/^(\d+(?:\.\d+)?)(m|h|d|w)$/i);
  if (!match) return 0;
  return Number(match[1]) * ({ m: 60000, h: 3600000, d: 86400000, w: 604800000 }[match[2].toLowerCase()]);
}

function routerUserExpired(user, schedulerNames) {
  const comment = String(user?.comment || "");
  const managed = /FAZ\|PROFILE=/i.test(comment);
  if (/FAZ\|EXPIRED(?:\||$)/i.test(comment)) return true;
  if (!managed) return false;

  const schedulerName = "faz-exp-" + String(user.username || "");
  const hasExpiryScheduler = schedulerNames.has(schedulerName.toLowerCase());
  if (user.disabled && !hasExpiryScheduler) return true;

  const allowedUptime = parseRouterOsDuration(user.limitUptime);
  const usedUptime = parseRouterOsDuration(user.uptime);
  if (allowedUptime > 0 && usedUptime >= allowedUptime) return true;

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
      const snapshot = await router.getHotspotExpirationSnapshot();
      const users = new Map((snapshot.users || []).map(user => [String(user.username || "").toLowerCase(), user]));
      const schedulerNames = new Set((snapshot.schedulerNames || []).map(name => String(name).toLowerCase()));
      const result = await database.query(
        "SELECT id,username,status,comment,validity,first_login_at,expires_at,cleanup_status FROM hotspot_vouchers WHERE status IN ('unused','active') OR (status='expired' AND cleanup_status IN ('pending','not_required','failed')) ORDER BY id ASC"
      );

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

        if (!user) continue;
        const comment = String(user.comment || "");
        const firstLogin = parseFirstLoginAt(comment);
        const hasLoginMarker = /FAZ\|PROFILE=/i.test(comment);
        if (voucher.status === "unused" && hasLoginMarker) {
          await database.query(
            "UPDATE hotspot_vouchers SET status='active',first_login_at=COALESCE(first_login_at,$1),expires_at=COALESCE(expires_at,$2),updated_at=NOW() WHERE id=$3 AND status='unused'",
            [firstLogin, firstLogin && parseValidityMs(comment.match(/VALIDITY=([^|]+)/i)?.[1]) ? new Date(firstLogin.getTime() + parseValidityMs(comment.match(/VALIDITY=([^|]+)/i)?.[1])) : null, voucher.id]
          );
          activated++;
        } else if (voucher.status === "active" && hasLoginMarker && firstLogin) {
          const validity = parseValidityMs(comment.match(/VALIDITY=([^|]+)/i)?.[1]);
          await database.query(
            "UPDATE hotspot_vouchers SET first_login_at=COALESCE(first_login_at,$1),expires_at=COALESCE(expires_at,$2),updated_at=NOW() WHERE id=$3",
            [firstLogin, validity ? new Date(firstLogin.getTime() + validity) : null, voucher.id]
          );
        }

        if (!routerUserExpired(user, schedulerNames)) continue;

        await database.query(
          "UPDATE hotspot_vouchers SET status='expired',first_login_at=COALESCE(first_login_at,$1),expired_at=COALESCE(expired_at,$2),cleanup_status='pending',cleanup_error=NULL,updated_at=NOW() WHERE id=$3",
          [firstLogin, now(), voucher.id]
        );
        expired++;
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

const runHotspotExpirationCleanup = createHotspotExpirationCleanup();

function startHotspotExpirationCleanup() {
  runHotspotExpirationCleanup().catch(error => console.error("[HOTSPOT EXPIRY] Initial run failed:", error.message));
  return setInterval(() => runHotspotExpirationCleanup().catch(error => console.error("[HOTSPOT EXPIRY] Scheduled run failed:", error.message)), HOUR_MS);
}

module.exports = {
  runHotspotExpirationCleanup,
  startHotspotExpirationCleanup,
  createHotspotExpirationCleanup,
  parseRouterOsDuration,
  parseFirstLoginAt,
  parseValidityMs,
  routerUserExpired
};
