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
  const bindMac = sharedUsers === 1
    ? ':if ([:len $uid] > 0 && [:len $uMac] > 0) do={ /ip hotspot user set $uid mac-address=$uMac; }'
    : '';
  const prefix = [
    ':local uName $user',
    ':local uMac $"mac-address"',
    ':local uAddress $address',
    ':local activeId [/ip hotspot active find where user=$uName]',
    ':local uid [/ip hotspot user find where name=$uName]',
    bindMac
  ].filter(Boolean).join('; ');

  // Preserve the backend-owned "Exp: YYYY-MM-DD" comment. The scheduler carries
  // its own user/MAC/IP values and removes itself after the one expiry run.
  if (validity.unit === "gb") {
    return prefix + '; :if ([:len $uid] > 0) do={ /ip hotspot user set $uid limit-bytes-total=' + validity.limitBytesTotal + '; };';
  }

  const schedulerEvent =
    '("/ip hotspot active remove [find where user=\\"' + '" . $uName . "' +
    '\\"]; /ip hotspot cookie remove [find where user=\\"' + '" . $uName . "' +
    '\\"]; /ip hotspot cookie remove [find where mac-address=\\"' + '" . $uMac . "' +
    '\\"]; /ip hotspot user remove [find where name=\\"' + '" . $uName . "' +
    '\\"]; /ip hotspot host remove [find where mac-address=\\"' + '" . $uMac . "' +
    '\\"]; /ip hotspot host remove [find where address=\\"' + '" . $uAddress . "' +
    '\\"]; /system scheduler remove [find where name=\\"faz-exp-' + '" . $uName . "' + '\\"];")';

  return prefix +
    '; :if ([:len $uid] > 0) do={ /ip hotspot user set $uid limit-bytes-total=0; };' +
    ' :local sched ("faz-exp-" . $uName);' +
    ' :if ([:len [/system scheduler find where name=$sched]] = 0) do={ /system scheduler add name=$sched interval=' +
    validity.validity +
    ' start-time=([/system clock get time] + ' + validity.validity + ') on-event=' + schedulerEvent + '; };';
}

module.exports = { normalizeProfileValidity, parseStoredValidity, buildHotspotOnLoginScript };
