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
    ':local fazManaged "FAZ_HOTSPOT_EXPIRY_V2"',
    ':local uName $user',
    ':local uMac $"mac-address"',
    ':local uAddress $address',
    ':local uid [/ip hotspot user find where name=$uName]',
    bindMac
  ].filter(Boolean).join('; ');

  // Quotas are provisioned on the individual Hotspot user by the backend.
  // The shared on-login hook must never reset a user's byte counter/limit.
  if (validity.unit === "gb") return prefix + ';';

  const schedulerEvent =
    '("/ip hotspot active remove [find where user=\\\"' + '" . $uName . "' +
    '\\\"]; /ip hotspot cookie remove [find where user=\\\"' + '" . $uName . "' +
    '\\\"]; /ip hotspot cookie remove [find where mac-address=\\\"' + '" . $uMac . "' +
    '\\\"]; /ip hotspot user remove [find where name=\\\"' + '" . $uName . "' +
    '\\\"]; /ip hotspot host remove [find where mac-address=\\\"' + '" . $uMac . "' +
    '\\\"]; /ip hotspot host remove [find where address=\\\"' + '" . $uAddress . "' +
    '\\\"]; /system scheduler remove [find where name=\\\"faz-exp-' + '" . $uName . "' +
    '\\\"];")';

  const timingScript = [
    ':local expiryClock ([:totime [/system clock get time]] + [:totime "' + validity.validity + '"])',
    ':local expiryClockText [:tostr $expiryClock]',
    ':local dayMark [:find $expiryClockText "d"]',
    ':local dayOffset 0',
    ':local expiryTime $expiryClockText',
    ':if ($dayMark != nil) do={ :set dayOffset [:tonum [:pick $expiryClockText 0 $dayMark]]; :set expiryTime [:pick $expiryClockText ($dayMark + 1) [:len $expiryClockText]]; }',
    ':local currentDate [/system clock get date]',
    ':local month [:pick $currentDate 0 3]',
    ':local day [:tonum [:pick $currentDate 4 6]]',
    ':local year [:tonum [:pick $currentDate 7 11]]',
    ':local months {"jan";"feb";"mar";"apr";"may";"jun";"jul";"aug";"sep";"oct";"nov";"dec"}',
    ':for i from=1 to=$dayOffset do={ :local maxDay 31; :if ($month="feb") do={ :set maxDay 28; :if ((($year % 4)=0) && ((($year % 100)!=0) || (($year % 400)=0))) do={ :set maxDay 29; } }; :if (($month="apr") || ($month="jun") || ($month="sep") || ($month="nov")) do={ :set maxDay 30; }; :if ($day >= $maxDay) do={ :set day 1; :local monthIndex [:find $months $month]; :set monthIndex (($monthIndex + 1) % 12); :set month ($months->$monthIndex); :if ($month="jan") do={ :set year ($year + 1); }; } else={ :set day ($day + 1); }; }',
    ':local dayText [:tostr $day]',
    ':if ([:len $dayText] = 1) do={ :set dayText ("0" . $dayText); }',
    ':local startDate ($month . "/" . $dayText . "/" . [:tostr $year])'
  ].join('; ');

  return prefix +
    ' :local sched ("faz-exp-" . $uName);' +
    ' ' + timingScript + ';' +
    ' :if ([:len [/system scheduler find where name=$sched]] = 0) do={ /system scheduler add name=$sched interval=' +
    validity.validity +
    ' start-date=$startDate start-time=$expiryTime on-event=' + schedulerEvent + '; };';
}

module.exports = { normalizeProfileValidity, parseStoredValidity, buildHotspotOnLoginScript };
