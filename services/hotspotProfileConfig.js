"use strict";

const UNIT_ALIASES = {
  m: "minutes", min: "minutes", minute: "minutes", minutes: "minutes",
  h: "hours", hr: "hours", hour: "hours", hours: "hours",
  d: "days", day: "days", days: "days", mo: "months", month: "months", months: "months", gb: "gb", data: "gb", quota: "gb"
};

function normalizeProfileValidity(value, unit) {
  const n = Number(value);
  const u = UNIT_ALIASES[String(unit || "").trim().toLowerCase()];
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error("Validity must be a positive whole number.");
  if (!u) throw new Error("Validity unit must be minutes, hours, days, or GB.");
  if (u === "gb") {
    const bytes = n * 1073741824;
    if (!Number.isSafeInteger(bytes)) throw new Error("GB quota is too large.");
    return { value: n, unit: u, validity: "", validityLabel: n + " GB", limitBytesTotal: bytes };
  }
  if (u === "months") return { value: n, unit: u, validity: String(n * 30) + "d", validityLabel: n + " Month" + (n === 1 ? "" : "s"), limitBytesTotal: 0 };
  const suffix = { minutes: "m", hours: "h", days: "d" }[u];
  const singular = { minutes: "Minute", hours: "Hour", days: "Day", months: "Month" }[u];
  return { value: n, unit: u, validity: String(n) + suffix, validityLabel: n + " " + singular + (n === 1 ? "" : "s"), limitBytesTotal: 0 };
}

function parseStoredValidity(profile) {
  const timeout = String(profile?.sessionTimeout || profile?.["session-timeout"] || "").trim().toLowerCase();
  const compact = timeout.replace(/\s+/g, "");
  const durationPattern = /(\d+)(w|d|h|m)/g;
  let match, consumed = "", totalMs = 0;
  const units = { w: 604800000, d: 86400000, h: 3600000, m: 60000 };
  while ((match = durationPattern.exec(compact))) {
    consumed += match[0];
    totalMs += Number(match[1]) * units[match[2]];
  }
  if (!compact || consumed !== compact || !Number.isSafeInteger(totalMs) || totalMs <= 0) {
    const raw = profile?.raw || profile || {};
    const quota = Number(profile?.limitBytesTotal || profile?.limit_bytes_total || raw["limit-bytes-total"] || 0);
    return { value: quota > 0 ? quota / 1073741824 : 0, unit: quota > 0 ? "gb" : "", validity: "", validityLabel: quota > 0 ? (quota / 1073741824) + " GB" : "", limitBytesTotal: quota };
  }
  const singleUnit = compact.match(/^(\d+)([dhm])$/);
  if (singleUnit) return normalizeProfileValidity(Number(singleUnit[1]), { d: "days", h: "hours", m: "minutes" }[singleUnit[2]]);
  if (totalMs % units.d === 0) return normalizeProfileValidity(totalMs / units.d, "days");
  if (totalMs % units.h === 0) return normalizeProfileValidity(totalMs / units.h, "hours");
  if (totalMs % units.m === 0) return normalizeProfileValidity(totalMs / units.m, "minutes");
  return { value: 0, unit: "", validity: "", validityLabel: "", limitBytesTotal: 0 };
}

function resolveHotspotPackage(profile = {}, metadata = {}) {
  let normalized;
  const metadataUnit = String(metadata.validityUnit || "").trim().toLowerCase();
  const metadataQuota = Math.max(0, Number(metadata.limitBytesTotal || metadata.limit_bytes_total || 0));
  if (["gb", "data", "quota"].includes(metadataUnit)) {
    const metadataValue = Number(metadata.validityValue);
    normalized = {
      value: Number.isSafeInteger(metadataValue) && metadataValue > 0 ? metadataValue : metadataQuota / 1073741824,
      unit: "gb",
      validity: "",
      validityLabel: metadataValue > 0 ? metadataValue + " GB" : "",
      limitBytesTotal: metadataQuota || (Number.isSafeInteger(metadataValue) && metadataValue > 0 ? metadataValue * 1073741824 : 0)
    };
  } else if (Number(metadata.validityValue) > 0 && metadata.validityUnit) normalized = normalizeProfileValidity(metadata.validityValue, metadata.validityUnit);
  else normalized = parseStoredValidity(profile);
  const validity = String(normalized.validity || "").trim();
  const durationPattern = /(\d+(?:\.\d+)?)(w|d|h|m|s)/gi;
  const factors = { w: 604800000, d: 86400000, h: 3600000, m: 60000, s: 1000 };
  let match, consumed = "", durationMs = 0;
  while ((match = durationPattern.exec(validity))) { consumed += match[0]; durationMs += Number(match[1]) * factors[match[2].toLowerCase()]; }
  if (consumed !== validity.replace(/\s+/g, "") || !Number.isFinite(durationMs)) durationMs = 0;
  const limitBytesTotal = Math.max(0, Number(metadataQuota || normalized.limitBytesTotal || 0));
  const type = durationMs > 0 && limitBytesTotal > 0 ? "COMBO" : durationMs > 0 ? "TIME_ONLY" : limitBytesTotal > 0 ? "DATA_ONLY" : "INVALID";
  return { type, durationMs: type === "DATA_ONLY" ? 0 : durationMs, validity: durationMs > 0 ? validity : "", limitBytesTotal, expiresAt: type === "DATA_ONLY" ? null : undefined, comment: type === "DATA_ONLY" ? "FAZ|DATA_ONLY" : "" };
}

/**
 * Build one deterministic on-login hook for a specific Hotspot User Profile.
 * Each profile has its own configured validity (e.g. 1h or 30d), so this
 * script can be shared by users of that profile. It never rewrites the
 * backend-owned user comment or changes a user's phone-number password.
 */
function buildHotspotOnLoginScript(config = {}) {
  // Validate package validity centrally, but never create or manage RouterOS schedulers.
  if (config.validityValue !== undefined && config.validityValue !== null && config.validityUnit) normalizeProfileValidity(config.validityValue, config.validityUnit);
  const sharedUsers = Math.max(1, Number(config.sharedUsers) || 1);
  // V5 (bind-once): bind the device MAC only when the router user has no
  // mac-address yet. A later login from a different device must NOT
  // overwrite the first binding.
  const bindMac = sharedUsers === 1
    ? ':if ([:len $uid] > 0 && [:len $uMac] > 0) do={ :local curMac [/ip hotspot user get $uid mac-address]; :if ($curMac = "") do={ /ip hotspot user set $uid mac-address=$uMac; } }'
    : '';
  return [
    ':local fazManaged "FAZ_HOTSPOT_SESSION_BINDING_V5"',
    ':local uName $user',
    ':local uMac $"mac-address"',
    ':local uid [/ip hotspot user find where name=$uName]',
    bindMac
  ].filter(Boolean).join('; ') + ';';
}
module.exports = { normalizeProfileValidity, parseStoredValidity, resolveHotspotPackage, buildHotspotOnLoginScript };
