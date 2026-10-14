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

/**
 * Build one shared, idempotent on-login hook.
 *
 * Validity is per Hotspot user, not per shared User Profile. The backend stores
 * each user's purchase expiry as "Exp: YYYY-MM-DD"; this script schedules
 * cleanup for that user's expiry date without changing comments, passwords,
 * byte limits, or the profile's session-timeout for every other customer.
 */
function buildHotspotOnLoginScript(config = {}) {
  const sharedUsers = Math.max(1, Number(config.sharedUsers) || 1);
  const bindMac = sharedUsers === 1
    ? ':if ([:len $uid] > 0 && [:len $uMac] > 0) do={ /ip hotspot user set $uid mac-address=$uMac; }'
    : '';

  const schedulerEvent =
    '("/ip hotspot active remove [find where user=\\"' + '" . $uName . "' +
    '\\"]; /ip hotspot cookie remove [find where user=\\"' + '" . $uName . "' +
    '\\"]; /ip hotspot cookie remove [find where mac-address=\\"' + '" . $uMac . "' +
    '\\"]; /ip hotspot user remove [find where name=\\"' + '" . $uName . "' +
    '\\"]; /ip hotspot host remove [find where mac-address=\\"' + '" . $uMac . "' +
    '\\"]; /ip hotspot host remove [find where address=\\"' + '" . $uAddress . "' +
    '\\"]; /system scheduler remove [find where name=\\\"faz-exp-' + '" . $uName . "' +
    '\\"];")';

  const expirySetup = [
    ':if ([:len $uid] > 0) do={',
    ':local userComment [/ip hotspot user get $uid comment]',
    ':if ([:pick $userComment 0 5] = "Exp: ") do={',
    ':local expiryISO [:pick $userComment 5 15]',
    ':if ([:len $expiryISO] = 10) do={',
    ':local expiryYear [:tonum [:pick $expiryISO 0 4]]',
    ':local expiryMonth [:tonum [:pick $expiryISO 5 7]]',
    ':local expiryDay [:pick $expiryISO 8 10]',
    ':if (($expiryYear > 2000) && ($expiryMonth >= 1) && ($expiryMonth <= 12)) do={',
    ':local months {"jan";"feb";"mar";"apr";"may";"jun";"jul";"aug";"sep";"oct";"nov";"dec"}',
    ':local monthIndex ($expiryMonth - 1)',
    ':local expiryMonthText ($months->$monthIndex)',
    ':local startDate ($expiryMonthText . "/" . $expiryDay . "/" . [:tostr $expiryYear])',
    ':local sched ("faz-exp-" . $uName)',
    ':if ([:len [/system scheduler find where name=$sched]] = 0) do={ /system scheduler add name=$sched start-date=$startDate start-time=23:59:59 interval=0s on-event=' + schedulerEvent + '; }',
    '}',
    '}',
    '}',
    '}'
  ].join(' ');

  return [
    ':local fazManaged "FAZ_HOTSPOT_EXPIRY_V2"',
    ':local uName $user',
    ':local uMac $"mac-address"',
    ':local uAddress $address',
    ':local uid [/ip hotspot user find where name=$uName]',
    bindMac,
    expirySetup
  ].filter(Boolean).join('; ');
}

module.exports = { normalizeProfileValidity, parseStoredValidity, buildHotspotOnLoginScript };
