"use strict";

const TIME_ZONE = "Asia/Dhaka";
const DATE_ONLY = /^\\d{4}-\\d{2}-\\d{2}$/;

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

function addDays(value, days) {
  const { year, month, day } = parseDateOnly(value, "base date");
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
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
  const current = String(currentExpiryDate ?? "").trim();
  const baseDate = current && current > today ? (parseDateOnly(current, "current expiry") && current) : today;
  return addCalendarMonths(baseDate, months);
}

function formatExpiryCutoff(expiryDate) {
  parseDateOnly(expiryDate, "expiry date");
  return String(expiryDate) + " 00:00:00";
}

async function calculateExpiry({ durationMonths, query, currentExpiryDate, now = new Date() }) {
  if (typeof query !== "function") throw new TypeError("A database query function is required to read the billing-cycle setting.");
  const result = await query("SELECT value FROM app_settings WHERE key='billing_cycle_type' LIMIT 1");
  const policy = String(result.rows?.[0]?.value || "");
  const today = dhakaDate(now);
  const current = String(currentExpiryDate ?? "").trim();
  const base = current && current > today ? (parseDateOnly(current, "current expiry") && current) : today;
  const months = Math.max(1, Math.trunc(Number(durationMonths) || 1));
  if (policy === "rolling_30") return addDays(base, 30 * months);
  // monthly_1st retains its existing calendar-month behaviour; same_date_monthly
  // explicitly selects the same calendar day next month with month-end clamping.
  return addCalendarMonths(base, months);
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
  calculateSameDateExpiry,
  formatExpiryCutoff,
  calculateExpiry,
  applyRouterRenewal
};
