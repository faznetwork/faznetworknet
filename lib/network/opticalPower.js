"use strict";

/**
 * Parse only explicit dBm values or plain numeric SNMP strings.
 * Unknown OCTET STRING encodings are intentionally left null rather than
 * guessing a scale (for example, whether an integer is in tenths/hundredths).
 */
function parseOpticalPowerDbm(value, min = -50, max = 10) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= min && value <= max
      ? Math.round(value * 100) / 100
      : null;
  }

  const text = String(value).trim();
  let match = text.match(/^(-?(?:\d+(?:\.\d+)?|\.\d+))$/);
  if (!match) {
    // Allow surrounding diagnostic text only when the unit is explicitly dBm.
    match = text.match(/(-?(?:\d+(?:\.\d+)?|\.\d+))\s*dBm\b/i);
  }
  if (!match) return null;

  const number = Number(match[1]);
  if (!Number.isFinite(number) || number < min || number > max) return null;
  return Math.round(number * 100) / 100;
}

module.exports = { parseOpticalPowerDbm };
