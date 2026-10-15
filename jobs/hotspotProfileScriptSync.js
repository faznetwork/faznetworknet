"use strict";

const db = require("../db");
const mikrotikService = require("../services/mikrotikService");
const { normalizeProfileValidity, parseStoredValidity, buildHotspotOnLoginScript } = require("../services/hotspotProfileConfig");

const LEGACY_HOTSPOT_HOOK = /FAZ\|(?:EXP|PROFILE|INIT)=|FIRST_LOGIN=/i;
const MANAGED_HOTSPOT_HOOK = /FAZ_HOTSPOT_EXPIRY_V[23]/i;
const CUSTOM_HOOK_MARKER = "FAZ_CUSTOM_ON_LOGIN_HOOK_START";

function parseMetadata(value) {
  try {
    const parsed = JSON.parse(String(value || "{}"));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch (_) {
    return {};
  }
}

function customHookFrom(oldLogin) {
  const script = String(oldLogin || "").trim();
  const markerAt = script.indexOf(CUSTOM_HOOK_MARKER);
  if (markerAt >= 0) {
    const markerEnd = script.indexOf(";", markerAt);
    return markerEnd >= 0 ? script.slice(markerEnd + 1).trim() : "";
  }
  if (!script || LEGACY_HOTSPOT_HOOK.test(script) || MANAGED_HOTSPOT_HOOK.test(script)) return "";
  return script;
}

function validityForProfile(profile, metadata) {
  if (metadata && metadata.validityValue !== undefined && metadata.validityValue !== null &&
      String(metadata.validityValue).trim() !== "" && metadata.validityUnit) {
    try {
      return normalizeProfileValidity(metadata.validityValue, metadata.validityUnit);
    } catch (_) {}
  }

  const oldLogin = String(profile?.raw?.["on-login"] || "");
  const legacyValidity = oldLogin.match(/VALIDITY\s*=\s*(\d+(?:\.\d+)?)\s*(m|min|minutes?|h|hr|hours?|d|days?|gb)\b/i);
  if (legacyValidity) {
    const unit = legacyValidity[2].toLowerCase().startsWith("g") ? "gb"
      : legacyValidity[2].toLowerCase().startsWith("m") ? "minutes"
      : legacyValidity[2].toLowerCase().startsWith("h") ? "hours" : "days";
    try {
      return normalizeProfileValidity(Number(legacyValidity[1]), unit);
    } catch (_) {}
  }

  const bytes = Number(metadata?.limitBytesTotal || 0);
  if (Number.isSafeInteger(bytes) && bytes > 0 && bytes % 1073741824 === 0) {
    try { return normalizeProfileValidity(bytes / 1073741824, "gb"); } catch (_) {}
  }

  return parseStoredValidity(profile);
}

/**
 * Idempotently normalize FAZ-managed / package-configured Hotspot User Profiles.
 * This only writes each profile's on-login field; it does not alter rate limits,
 * session timeouts, shared-user counts, user passwords, or RouterOS server login-by.
 */
async function syncHotspotProfileScripts(deps = {}) {
  const database = deps.db || db;
  const router = deps.mikrotikService || mikrotikService;
  const logger = deps.logger || console;
  const settings = await database.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");
  const metadata = parseMetadata(settings.rows?.[0]?.value);
  const profiles = await router.getHotspotProfiles();
  let checked = 0, updated = 0, skipped = 0, unchanged = 0, ineligible = 0, failed = 0;

  for (const profile of profiles || []) {
    const name = String(profile?.name || "").trim();
    if (!name) { skipped++; ineligible++; continue; }
    const oldLogin = String(profile?.raw?.["on-login"] || "");
    const configured = metadata[name] && typeof metadata[name] === "object";
    const legacy = LEGACY_HOTSPOT_HOOK.test(oldLogin);
    const alreadyManaged = MANAGED_HOTSPOT_HOOK.test(oldLogin);
    const storedTimeout = String(profile?.sessionTimeout || profile?.["session-timeout"] || "").trim().toLowerCase();
    const hasKnownTimeValidity = Boolean(storedTimeout && storedTimeout !== "none" && /^(?:\d+\s*[wdhm]\s*)+$/i.test(storedTimeout));
    // Sync every package-managed/legacy profile and every manual profile with a
    // concrete time validity. Preserve unconfigured hooks when validity is unknown.
    if (!configured && !legacy && !alreadyManaged && !hasKnownTimeValidity) { skipped++; ineligible++; continue; }

    checked++;
    try {
      const validity = validityForProfile(profile, configured ? metadata[name] : {});
      const onLogin = buildHotspotOnLoginScript({
        name,
        sharedUsers: Number(profile.sharedUsers) || 1,
        validityValue: validity.value,
        validityUnit: validity.unit
      });
      const customHook = customHookFrom(oldLogin);
      const nextScript = onLogin + (customHook
        ? '; :local fazCustomHookMarker "' + CUSTOM_HOOK_MARKER + '"; ' + customHook
        : "");
      if (nextScript === oldLogin) { skipped++; unchanged++; continue; }
      await router.updateHotspotProfile({ name, onLogin: nextScript });
      updated++;
    } catch (error) {
      failed++;
      logger.warn("[HOTSPOT PROFILE SYNC] Could not normalize " + name + ": " + (error?.message || error));
    }
  }

  // A Hotspot Server Profile is separate from the User Profile above.
  // Normalize auth only on profiles referenced by enabled Hotspot servers.
  const authResult = { checked: 0, updated: 0, skipped: 0, failed: 0 };
  if (typeof router.getHotspotServers === "function" &&
      typeof router.ensureHotspotServerProfileAuth === "function") {
    try {
      const servers = await router.getHotspotServers();
      const profileNames = [...new Set((servers || []).map(server => String(server?.profile || "").trim()).filter(Boolean))];
      for (const profileName of profileNames) {
        authResult.checked++;
        try {
          const outcome = await router.ensureHotspotServerProfileAuth(profileName);
          if (outcome?.updated) authResult.updated++;
          else authResult.skipped++;
        } catch (error) {
          authResult.failed++;
          failed++;
          logger.warn("[HOTSPOT SERVER AUTH SYNC] Could not normalize " + profileName + ": " + (error?.message || error));
        }
      }
    } catch (error) {
      authResult.failed++;
      failed++;
      logger.warn("[HOTSPOT SERVER AUTH SYNC] Could not inspect active Hotspot servers: " + (error?.message || error));
    }
  }
  logger.log("[HOTSPOT SERVER AUTH SYNC] Completed.", authResult);

  const result = { checked, updated, skipped, unchanged, ineligible, failed, serverAuth: authResult };
  logger.log("[HOTSPOT PROFILE SYNC] Completed.", result);
  return result;
}

module.exports = { syncHotspotProfileScripts, validityForProfile, customHookFrom };
