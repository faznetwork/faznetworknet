"use strict";

// Normalize a RouterOS PPPoE caller-id / MAC address.
// Accepts AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, or aabbccddeeff.
// Returns the uppercase colon-separated form, or null when the value is
// empty or not a valid 48-bit MAC address. Never invents a MAC: an absent
// or invalid value is null, never a placeholder.
function normalizeMacAddress(value) {
  if (value === undefined || value === null) return null;
  const raw = String(value).trim().toUpperCase().replace(/-/g, ":").replace(/\s+/g, "");
  if (!raw) return null;
  if (/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(raw)) return raw;
  const compact = raw.replace(/:/g, "");
  if (/^[0-9A-F]{12}$/.test(compact)) return compact.match(/.{2}/g).join(":");
  return null;
}

module.exports = { normalizeMacAddress };
