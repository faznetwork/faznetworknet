"use strict";

// Single fixed billing policy for the whole system: Same-Date Monthly.
// A recharge on day D expires at 00:00:00 Asia/Dhaka on day D of the next
// month (month-end clamped: 31 Jan -> 28 Feb, 31 Mar -> 30 Apr). There is no
// rolling-30 or calendar-1st cycle anymore, and no billing-cycle setting is
// read here; do not reintroduce a policy lookup.

const TIME_ZONE = "Asia/Dhaka";
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function dhakaDate(value = new Date()) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("A valid Date is required to calculate a Dhaka billing date.");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = type => parts.find(item => item.type === type)?.value;
  return part("year") + "-" + part("month") + "-" + part("day");
}

function normalizeDate(value, now = new Date()) {
  if (value instanceof Date) return dhakaDate(value);
  if (value === null || value === undefined || String(value).trim() === "") return dhakaDate(now);
  const raw = String(value).trim();
  if (DATE_ONLY.test(raw)) return raw;
  // PostgreSQL drivers may return an expiry as a Date or ISO timestamp. Convert
  // instants to the ISP billing timezone before passing a date-only value onward.
  const timestamp = new Date(raw);
  if (!Number.isNaN(timestamp.getTime())) return dhakaDate(timestamp);
  return raw;
}

function parseDateOnly(value, label = "date") {
  const date = String(value ?? "").trim();
  if (!DATE_ONLY.test(date)) throw new TypeError("Invalid " + label + "; expected YYYY-MM-DD.");
  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    throw new TypeError("Invalid " + label + "; expected a real calendar date.");
  }
  return { year, month, day };
}

function addCalendarMonths(value, months) {
  const { year, month, day } = parseDateOnly(value, "base date");
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

function calculateSameDateExpiry(durationMonths = 1, currentExpiryDate = null, now = new Date()) {
  const months = Number(durationMonths);
  if (!Number.isInteger(months) || months < 1 || months > 1200) {
    throw new RangeError("Billing duration must be an integer between 1 and 1200 months.");
  }
  const today = dhakaDate(now);
  const current = normalizeDate(currentExpiryDate, now);
  const baseDate = current && current > today ? (parseDateOnly(current, "current expiry") && current) : today;
  return addCalendarMonths(baseDate, months);
}

async function calculateExpiry({ durationMonths, currentExpiryDate, now = new Date() }) {
  // Same-date monthly only; no billing-cycle setting is consulted.
  return calculateSameDateExpiry(durationMonths, currentExpiryDate, now);
}

async function applyRouterRenewal(mikrotikService, username, { password, profile, comment, disabled = false, onMutation = () => {} }) {
  await mikrotikService.updateSecret(username, { password, profile, comment, disabled });
  onMutation();
  await mikrotikService.kickActiveUser(username);
  return { username, profile, comment };
}

module.exports = {
  TIME_ZONE,
  dhakaDate,
  normalizeDate,
  calculateSameDateExpiry,
  calculateExpiry,
  applyRouterRenewal
};
