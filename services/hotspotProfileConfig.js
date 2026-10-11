"use strict";

const UNIT_ALIASES = {
  m: "minutes", min: "minutes", minute: "minutes", minutes: "minutes",
  h: "hours", hr: "hours", hour: "hours", hours: "hours",
  d: "days", day: "days", days: "days", gb: "gb"
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
  const suffix = { minutes: "m", hours: "h", days: "d" }[u];
  const singular = { minutes: "Minute", hours: "Hour", days: "Day" }[u];
  return { value: n, unit: u, validity: String(n) + suffix, validityLabel: n + " " + singular + (n === 1 ? "" : "s"), limitBytesTotal: 0 };
}

function parseStoredValidity(profile) {
  const timeout = String(profile?.sessionTimeout || profile?.["session-timeout"] || "").trim();
  const match = timeout.match(/^(\d+)(m|h|d)$/i);
  if (!match) return { value: 1, unit: "days", validity: "1d", validityLabel: "1 Day", limitBytesTotal: 0 };
  return normalizeProfileValidity(Number(match[1]), match[2].toLowerCase());
}

function buildHotspotOnLoginScript(config) {
  const validity = normalizeProfileValidity(config.validityValue, config.validityUnit);
  const sharedUsers = Math.max(1, Number(config.sharedUsers) || 1);
  const profileName = String(config.name || "").replace(/[^a-zA-Z0-9_. -]/g, "").slice(0, 80);
  const policy = validity.validity || validity.validityLabel;
  const bindMac = sharedUsers === 1 ? " /ip hotspot user set $uid mac-address=$loginMac;" : "";
  const prefix = [
    ':local u $user',
    ':local loginMac $"mac-address"',
    ':local auth "unknown"',
    ':local activeId [/ip hotspot active find where user=$u]',
    ':if ([:len $activeId] > 0) do={ :set auth [/ip hotspot active get $activeId login-by]; }',
    ':local uid [/ip hotspot user find where name=$u]',
    ':if ([:len $uid] > 0) do={ :local oldComment [/ip hotspot user get $uid comment]; :if ([:find $oldComment "FAZ|PROFILE="] = nil) do={ /ip hotspot user set $uid comment=("FAZ|PROFILE=' + profileName + '|VALIDITY=' + policy + '|FIRST_LOGIN=" . [/system clock get date] . " " . [/system clock get time] . "|MAC=" . $loginMac . "|AUTH=" . $auth); };' + bindMac + ' }'
  ].join("; ");

  if (validity.unit === "gb") {
    return prefix + " :if ([:len $uid] > 0) do={ /ip hotspot user set $uid limit-bytes-total=" + validity.limitBytesTotal + "; };";
  }

  // Anchor expiry to first login; reconnects must not extend prepaid validity.
  const schedulerEvent =
    '("/ip hotspot active remove [find where user=\\"' + '" . $u . "' +
    '\\"]; /ip hotspot user disable [find where name=\\"' + '" . $u . "' +
    '\\"]; /system scheduler remove [find where name=\\"faz-exp-' + '" . $u . "' + '\\"];")';
  return prefix +
    " :if ([:len $uid] > 0) do={ /ip hotspot user set $uid limit-bytes-total=0; };" +
    ' :local sched ("faz-exp-" . $u);' +
    ' :if ([:len [/system scheduler find where name=$sched]] = 0) do={ /system scheduler add name=$sched interval=' +
    validity.validity +
    ' start-time=[/system clock get time] on-event=' + schedulerEvent + '; };';
}

module.exports = { normalizeProfileValidity, parseStoredValidity, buildHotspotOnLoginScript };
