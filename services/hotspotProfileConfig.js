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
  if (totalMs % units.d === 0) return normalizeProfileValidity(totalMs / units.d, "days");
  if (totalMs % units.h === 0) return normalizeProfileValidity(totalMs / units.h, "hours");
  if (totalMs % units.m === 0) return normalizeProfileValidity(totalMs / units.m, "minutes");
  return { value: 0, unit: "", validity: "", validityLabel: "", limitBytesTotal: 0 };
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
  const bindMac = sharedUsers === 1
    ? ':if ([:len $uid] > 0 && [:len $uMac] > 0) do={ /ip hotspot user set $uid mac-address=$uMac; }'
    : '';
  return [
    ':local fazManaged "FAZ_HOTSPOT_SESSION_BINDING_V4"',
    ':local uName $user',
    ':local uMac $"mac-address"',
    ':local uid [/ip hotspot user find where name=$uName]',
    bindMac
  ].filter(Boolean).join('; ') + ';';
}
module.exports = { normalizeProfileValidity, parseStoredValidity, buildHotspotOnLoginScript };
