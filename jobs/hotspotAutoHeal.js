"use strict";

// Panel-as-master router recovery: PostgreSQL is the only source of truth.
// If a panel profile or an active voucher's router user is missing on
// MikroTik (for example after a router reset), this job re-provisions it
// from the Panel DB. It NEVER deletes a router profile or user and NEVER
// writes to hotspot_vouchers — it only creates what is missing on the
// router. Expired, deleted and archived vouchers are never healed.

const db = require("../db");
const mikrotikService = require("../services/mikrotikService");
const { normalizeProfileValidity, buildHotspotOnLoginScript } = require("../services/hotspotProfileConfig");

const AUTO_HEAL_INTERVAL_MS = 15 * 60 * 1000;

function parseMetadata(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function normalizeMac(value) {
  const compact = String(value ?? "").trim().replace(/[:-]/g, "");
  return /^[0-9a-fA-F]{12}$/.test(compact) ? compact.match(/.{2}/g).join(":").toUpperCase() : "";
}

function dhakaTimestamp(value) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(value);
  const field = (type) => parts.find((part) => part.type === type)?.value || "00";
  return field("year") + "-" + field("month") + "-" + field("day") + " " + field("hour") + ":" + field("minute") + ":" + field("second");
}

function validityForMetadataEntry(name, details) {
  if (details.validityValue !== undefined && details.validityValue !== null &&
      String(details.validityValue).trim() !== "" && details.validityUnit) {
    return normalizeProfileValidity(details.validityValue, details.validityUnit);
  }
  const bytes = Number(details.limitBytesTotal || details.limit_bytes_total || 0);
  if (Number.isSafeInteger(bytes) && bytes > 0 && bytes % 1073741824 === 0) {
    return normalizeProfileValidity(bytes / 1073741824, "gb");
  }
  throw new Error("Panel profile \"" + name + "\" has no usable time validity or data quota.");
}

function createHotspotAutoHeal(deps = {}) {
  const database = deps.db || db;
  const router = deps.mikrotikService || mikrotikService;
  const logger = deps.logger || console;
  const now = deps.now || (() => new Date());
  let running = false;
  let firstTimer = null;
  let timer = null;

  async function runHotspotAutoHeal() {
    if (running) return { skipped: true, reason: "already_running" };
    running = true;
    const summary = { profilesChecked: 0, profilesCreated: 0, profilesFailed: 0, usersChecked: 0, usersHealed: 0, usersSkipped: 0, usersFailed: 0 };
    try {
      // 1. Panel profiles missing on the router are re-created from metadata.
      const settings = await database.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");
      const metadata = parseMetadata(settings.rows?.[0]?.value);
      const routerProfiles = await router.getHotspotProfiles();
      const routerProfileNames = new Set((Array.isArray(routerProfiles) ? routerProfiles : []).map((profile) => String(profile?.name || "").trim()).filter(Boolean));
      for (const [name, details] of Object.entries(metadata)) {
        if (!name || name.toLowerCase() === "default" || !details || typeof details !== "object") continue;
        if (routerProfileNames.has(name)) continue;
        summary.profilesChecked++;
        try {
          const validity = validityForMetadataEntry(name, details);
          const sharedUsersRaw = Number(details.sharedUsers || details.shared_users || 1);
          const sharedUsers = Number.isSafeInteger(sharedUsersRaw) && sharedUsersRaw >= 1 ? sharedUsersRaw : 1;
          await router.createHotspotProfile({
            name,
            rateLimit: String(details.rateLimit || details.rate_limit || ""),
            sharedUsers,
            sessionTimeout: validity.validity,
            clearSessionTimeout: validity.unit === "gb",
            keepaliveTimeout: "",
            onLogin: buildHotspotOnLoginScript({ name, sharedUsers, validityValue: validity.value, validityUnit: validity.unit })
          });
          summary.profilesCreated++;
          routerProfileNames.add(name);
        } catch (error) {
          summary.profilesFailed++;
          logger.warn("[HOTSPOT AUTO-HEAL] Could not re-create missing profile " + name + ": " + (error?.message || error));
        }
      }

      // 2. Active vouchers whose router user is missing are re-provisioned.
      // Only live rows qualify: a future expiry, or a data-only row with a
      // quota and no expiry. Expired/deleted/archived rows are never healed,
      // and this job never writes to hotspot_vouchers.
      const voucherResult = await database.query(
        "SELECT id,username,profile,server,mac_address,data_limit,expires_at FROM hotspot_vouchers " +
        "WHERE status='active' AND (expires_at > NOW() OR expires_at IS NULL) ORDER BY id ASC"
      );
      const routerUsers = await router.getHotspotUsers();
      const routerUserNames = new Set((Array.isArray(routerUsers) ? routerUsers : []).map((user) => String(user?.username || "").trim().toUpperCase()).filter(Boolean));
      for (const row of voucherResult.rows || []) {
        summary.usersChecked++;
        const mac = normalizeMac(row.mac_address) || normalizeMac(row.username);
        const profile = String(row.profile || "").trim();
        if (!mac || !profile) { summary.usersSkipped++; continue; }
        if (routerUserNames.has(mac)) continue;
        const expiresAt = row.expires_at ? new Date(row.expires_at) : null;
        const quota = Math.max(0, Math.floor(Number(String(row.data_limit || "").trim()) || Number((metadata[profile] || {}).limitBytesTotal || 0)));
        try {
          if (expiresAt && !Number.isNaN(expiresAt.getTime())) {
            if (expiresAt.getTime() <= now().getTime()) { summary.usersSkipped++; continue; }
            await router.createHotspotUser({ username: mac, password: mac, profile, server: row.server || "all", comment: "Exp: " + dhakaTimestamp(expiresAt), macAddress: mac });
          } else if (quota > 0) {
            // Known limitation: RouterOS usage counters live on the router,
            // so after a router reset a healed data user restarts with the
            // full package quota (usage before the reset is unknowable
            // from the Panel).
            await router.createHotspotUser({ username: mac, password: mac, profile, server: row.server || "all", limitBytesTotal: quota, comment: "FAZ|DATA_ONLY", macAddress: mac });
          } else {
            summary.usersSkipped++;
            continue;
          }
          summary.usersHealed++;
          routerUserNames.add(mac);
        } catch (error) {
          summary.usersFailed++;
          logger.warn("[HOTSPOT AUTO-HEAL] Could not re-provision user " + mac + ": " + (error?.message || error));
        }
      }
      logger.log("[HOTSPOT AUTO-HEAL] Completed.", summary);
      return summary;
    } finally {
      running = false;
    }
  }

  function startHotspotAutoHeal() {
    // First run shortly after start (non-blocking); then every 15 minutes.
    // Overlapping runs are guarded by the `running` flag.
    firstTimer = setTimeout(() => {
      runHotspotAutoHeal().catch((error) => logger.error("[HOTSPOT AUTO-HEAL] Startup run failed:", error.message));
    }, 30000);
    if (typeof firstTimer.unref === "function") firstTimer.unref();
    timer = setInterval(() => {
      runHotspotAutoHeal().catch((error) => logger.error("[HOTSPOT AUTO-HEAL] Scheduled run failed:", error.message));
    }, AUTO_HEAL_INTERVAL_MS);
    if (typeof timer.unref === "function") timer.unref();
    return stopHotspotAutoHeal;
  }

  function stopHotspotAutoHeal() {
    if (firstTimer) clearTimeout(firstTimer);
    if (timer) clearInterval(timer);
    firstTimer = null;
    timer = null;
  }

  return { run: runHotspotAutoHeal, start: startHotspotAutoHeal, stop: stopHotspotAutoHeal };
}

const defaultHeal = createHotspotAutoHeal();

module.exports = {
  runHotspotAutoHeal: defaultHeal.run,
  startHotspotAutoHeal: defaultHeal.start,
  stopHotspotAutoHeal: defaultHeal.stop,
  createHotspotAutoHeal,
  AUTO_HEAL_INTERVAL_MS
};
