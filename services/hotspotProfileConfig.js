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
    return { value: 1, unit: "days", validity: "1d", validityLabel: "1 Day", limitBytesTotal: 0 };
  }
  if (totalMs % units.d === 0) return normalizeProfileValidity(totalMs / units.d, "days");
  if (totalMs % units.h === 0) return normalizeProfileValidity(totalMs / units.h, "hours");
  if (totalMs % units.m === 0) return normalizeProfileValidity(totalMs / units.m, "minutes");
  return { value: 1, unit: "days", validity: "1d", validityLabel: "1 Day", limitBytesTotal: 0 };
}

/**
 * Build one deterministic on-login hook for a specific Hotspot User Profile.
 * Each profile has its own configured validity (e.g. 1h or 30d), so this
 * script can be shared by users of that profile. It never rewrites the
 * backend-owned user comment or changes a user's phone-number password.
 */
function buildHotspotOnLoginScript(config = {}) {
  const validity = normalizeProfileValidity(config.validityValue || 1, config.validityUnit || "days");
  const sharedUsers = Math.max(1, Number(config.sharedUsers) || 1);
  const bindMac = sharedUsers === 1
    ? ':if ([:len $uid] > 0 && [:len $uMac] > 0) do={ /ip hotspot user set $uid mac-address=$uMac; }'
    : '';
  const prefix = [
    ':local fazManaged "FAZ_HOTSPOT_EXPIRY_V3"',
    ':local uName $user',
    ':local uMac $"mac-address"',
    ':local uid [/ip hotspot user find where name=$uName]',
    bindMac
  ].filter(Boolean).join('; ');

  // Data-only packages have no calendar expiry and must not create a time scheduler.
  if (validity.unit === "gb") return prefix + ';';

  // The per-user RouterOS comment is authoritative: "Exp: YYYY-MM-DD".
  // Recreate the one-shot scheduler on each login so renewal cannot leave a stale date.
  const schedulerEvent =
    '("/ip hotspot active remove [find where user=\\\"' + '" . $uName . "' +
    '\\\"]; /ip hotspot cookie remove [find where user=\\\"' + '" . $uName . "' +
    '\\\"]; /ip hotspot cookie remove [find where mac-address=\\\"' + '" . $uMac . "' +
    '\\\"]; /ip hotspot user remove [find where name=\\\"' + '" . $uName . "' +
    '\\\"]; /ip hotspot host remove [find where mac-address=\\\"' + '" . $uMac . "' +
    '\\\"]; /system scheduler remove [find where name=\\\"EXP_' + '" . $uName . "' +
    '\\\"];")';

  const expiryScript = [
    ':local sched ("EXP_" . $uName)',
    ':foreach oldSched in=[/system scheduler find where name=$sched] do={ /system scheduler remove $oldSched; }',
    ':local userComment ""',
    ':if ([:len $uid] > 0) do={ :set userComment [/ip hotspot user get $uid comment]; }',
    ':if (([:len $userComment] = 15) && ([:pick $userComment 0 5] = "Exp: ") && ([:pick $userComment 9 10] = "-") && ([:pick $userComment 12 13] = "-")) do={',
    ':local expIso [:pick $userComment 5 15]',
    ':local expYear [:tonum [:pick $expIso 0 4]]',
    ':local expMonth [:tonum [:pick $expIso 5 7]]',
    ':local expDay [:tonum [:pick $expIso 8 10]]',
    ':local months {"jan";"feb";"mar";"apr";"may";"jun";"jul";"aug";"sep";"oct";"nov";"dec"}',
    ':local maxDay 31',
    ':if (($expMonth = 4) || ($expMonth = 6) || ($expMonth = 9) || ($expMonth = 11)) do={ :set maxDay 30; }',
    ':if ($expMonth = 2) do={ :set maxDay 28; :if ((($expYear % 4) = 0) && ((($expYear % 100) != 0) || (($expYear % 400) = 0))) do={ :set maxDay 29; } }',
    ':if (([:typeof $expYear] = "num") && ([:typeof $expMonth] = "num") && ([:typeof $expDay] = "num") && ($expYear >= 2000) && ($expMonth >= 1) && ($expMonth <= 12) && ($expDay >= 1) && ($expDay <= $maxDay)) do={',
    ':local currentDate [/system clock get date]',
    ':local currentMonth [:pick $currentDate 0 3]',
    ':local currentDay [:tonum [:pick $currentDate 4 6]]',
    ':local currentYear [:tonum [:pick $currentDate 7 11]]',
    ':local currentMonthIndex [:find $months $currentMonth]',
    ':local isExpired false',
    ':if ($expYear < $currentYear) do={ :set isExpired true; } else={ :if ($expYear = $currentYear) do={ :if ($expMonth < ($currentMonthIndex + 1)) do={ :set isExpired true; } else={ :if (($expMonth = ($currentMonthIndex + 1)) && ($expDay < $currentDay)) do={ :set isExpired true; } } } }',
    ':if ($isExpired) do={ /ip hotspot active remove [find where user=$uName]; /ip hotspot cookie remove [find where user=$uName]; /ip hotspot cookie remove [find where mac-address=$uMac]; /ip hotspot user remove [find where name=$uName]; /ip hotspot host remove [find where mac-address=$uMac]; } else={',
    ':local monthIndex ($expMonth - 1)',
    ':local startDate (($months->$monthIndex) . "/" . [:pick $expIso 8 10] . "/" . [:tostr $expYear])',
    '/system scheduler add name=$sched start-date=$startDate start-time=23:59:59 on-event=' + schedulerEvent,
    '}; } else={ :log warning ("FAZ HotSpot expiry comment invalid for user " . $uName . "; expected Exp: YYYY-MM-DD"); }'
  ].join('\n');

  return prefix + ' ' + expiryScript + ';';
}
module.exports = { normalizeProfileValidity, parseStoredValidity, buildHotspotOnLoginScript };
