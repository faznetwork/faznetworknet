function parseDateOnlyInDhaka(value) {
  if (value == null || value === "") return null;
  if (value instanceof Date) { if (Number.isNaN(value.getTime())) return null; const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value); const part = type => parts.find(item => item.type === type)?.value; return new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")))); }
  if (typeof value === "string") {
    const raw = value.trim();
    // PostgreSQL DATE and ISO timestamp values are year-first.
    const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      const year = Number(iso[1]), month = Number(iso[2]), day = Number(iso[3]);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) return parsed;
      return null;
    }
    // ISO timestamp strings represent instants and must use Bangladesh's calendar date.
    if (/^\d{4}-\d{2}-\d{2}[T\s]/.test(raw)) {
      const instant = new Date(raw);
      if (Number.isNaN(instant.getTime())) return null;
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(instant);
      const part = type => parts.find(item => item.type === type)?.value;
      return new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day"))));
    }
    // Human-entered dates are always day-first. Never pass DD/MM/YYYY to Date().
    const dayFirst = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s|$)/);
    if (dayFirst) {
      const day = Number(dayFirst[1]), month = Number(dayFirst[2]), year = Number(dayFirst[3]);
      const parsed = new Date(Date.UTC(year, month - 1, day));
      if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) return parsed;
      return null;
    }
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(parsed);
  const part = type => parts.find(item => item.type === type)?.value;
  return new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day"))));
}

function evaluateCustomerBillingStatus(customer) {
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(new Date());
  const part = type => todayParts.find(item => item.type === type)?.value;
  const today = Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")));

  if (!customer?.expiration_date) {
    return { status: "unpaid", badgeClass: "badge bg-danger", label: "Unpaid / Expired", daysLeft: 0 };
  }
  const expDate = parseDateOnlyInDhaka(customer.expiration_date);
  if (!expDate) return { status: "unpaid", badgeClass: "badge bg-danger", label: "Unpaid / Expired", daysLeft: 0 };

  const daysLeft = Math.floor((expDate.getTime() - today) / 86400000);
  // Expiration is effective from the start of the expiry date in Bangladesh.
  // Keep this boundary aligned with jobs/billingCron.js, which expires accounts
  // when expiration_date <= today's Asia/Dhaka date.
  if (daysLeft <= 0) return { status: "expired", badgeClass: "badge bg-danger", label: "Unpaid / Expired", daysLeft: 0 };
  if (daysLeft <= 3) return { status: "due", badgeClass: "badge bg-warning text-dark", label: `Expiring Soon (${daysLeft}d)`, daysLeft };
  return { status: "paid", badgeClass: "badge bg-success", label: "Paid / Active", daysLeft };
}

module.exports = { evaluateCustomerBillingStatus, parseDateOnlyInDhaka };
