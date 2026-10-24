/**
 * Validates structured OLT optical rows from a verified adapter.
 * This module performs no network I/O and intentionally does not parse guessed CLI syntax.
 */
const { normalizeMac } = require("./macMatcher");

function parseOpticalRows(rows, observedAt = new Date()) {
  if (!Array.isArray(rows)) throw new TypeError("OLT optical rows must be an array");
  const timestamp = observedAt instanceof Date ? observedAt : new Date(observedAt);
  if (Number.isNaN(timestamp.getTime())) throw new TypeError("Invalid observation timestamp");

  return rows.map((row) => {
    const mac = normalizeMac(row?.macAddress ?? row?.mac ?? row?.onuMac);
    const rawPower = row?.rxPowerDbm ?? row?.rxPower ?? row?.rx_power_dbm;
    const power = rawPower === null || rawPower === undefined || String(rawPower).trim() === ""
      ? null : Number(String(rawPower).replace(/\s*dBm\s*$/i, "").trim());
    const validPower = Number.isFinite(power) && power >= -50 && power <= 10;
    const onuId = String(row?.onuId ?? row?.onu_id ?? "").trim();
    const ponPort = String(row?.ponPort ?? row?.pon ?? "").trim();

    return {
      onuId: onuId || null,
      ponPort: ponPort || null,
      macAddress: mac,
      rxPowerDbm: mac && validPower ? Math.round(power * 100) / 100 : null,
      observedAt: timestamp.toISOString(),
      valid: Boolean(mac && validPower),
      invalidReason: !mac ? "invalid_or_missing_mac" : !validPower ? "invalid_or_missing_rx_power" : null
    };
  });
}

module.exports = { parseOpticalRows };
