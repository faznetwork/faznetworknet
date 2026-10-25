"use strict";

(function attachRemainingTime(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.FazRemainingTime = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : null), function createRemainingTime() {
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  function expiryMilliseconds(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    if (typeof value !== "string" || !value.trim()) return NaN;
    const raw = value.trim();
    // PostgreSQL timestamp strings without an offset are interpreted as Dhaka wall time.
    // ISO timestamps with Z or an explicit offset already represent an absolute instant.
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return Date.parse(raw + "T00:00:00+06:00");
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(raw)) {
      return Date.parse(raw.replace(" ", "T") + "+06:00");
    }
    return Date.parse(raw);
  }

  function format(expiry, nowValue) {
    const expiresAt = expiryMilliseconds(expiry);
    const now = nowValue === undefined ? Date.now() : expiryMilliseconds(nowValue);
    if (!Number.isFinite(expiresAt) || !Number.isFinite(now)) return "—";
    const delta = expiresAt - now;
    if (delta <= 0) return "Expired";
    if (delta < MINUTE) return "< 1m left";
    if (delta < HOUR) return Math.min(59, Math.ceil(delta / MINUTE)) + "m left";
    if (delta < DAY) return Math.min(23, Math.ceil(delta / HOUR)) + "h left";
    return Math.ceil(delta / DAY) + "d left";
  }

  return Object.freeze({ format, expiryMilliseconds });
});
