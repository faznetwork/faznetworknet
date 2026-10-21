"use strict";

const crypto = require("crypto");
const db = require("../db");
const legacyRenewal = require("./publicPaymentController");

const PROVIDERS = new Set(["bkash", "nagad", "rocket", "upay"]);
const SESSION_TTL_MS = 5 * 60 * 1000;
const attempts = new Map();

function fail(res, status, message) {
  return res.status(status).set("Cache-Control", "no-store").json({ success: false, message });
}

function clean(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function rateLimit(req, key, limit = 12) {
  const now = Date.now();
  const id = String(req.ip || "unknown") + ":" + key;
  let entry = attempts.get(id);
  if (!entry || now - entry.start >= 60_000) entry = { start: now, count: 0 };
  entry.count += 1;
  attempts.set(id, entry);
  if (attempts.size > 4000) {
    for (const [k, v] of attempts) {
      if (now - v.start > 120_000) attempts.delete(k);
      if (attempts.size <= 3000) break;
    }
  }
  return entry.count <= limit;
}

async function getMfsSettings() {
  const keys = {
    bkash: { number: "mfs_bkash_number", enabled: "mfs_bkash_enabled" },
    nagad: { number: "mfs_nagad_number", enabled: "mfs_nagad_enabled" },
    rocket: { number: "mfs_rocket_number", enabled: "mfs_rocket_enabled" },
    upay: { number: "mfs_upay_number", enabled: "mfs_upay_enabled" }
  };
  const result = await db.query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])", [Object.values(keys).flatMap(item => [item.number, item.enabled])]);
  const values = Object.fromEntries((result.rows || []).map(row => [row.key, String(row.value || "").trim()]));
  return Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, {
    enabled: Object.prototype.hasOwnProperty.call(values, key.enabled) ? ["true", "1"].includes(values[key.enabled].toLowerCase()) : Boolean(values[key.number]),
    number: values[key.number] || ""
  }]));
}

async function findPppoeSubscriber(identifier) {
  const value = clean(identifier, 100);
  if (!value) return null;
  const result = await db.query(
    `SELECT c.id,c.username,c.full_name,c.package_name,c.monthly_bill,c.expiration_date,c.status,
            p.plan_name,p.price,p.duration_months,p.profile_name
       FROM customers c
       INNER JOIN pppoe_users u ON LOWER(u.username)=LOWER(c.username)
       LEFT JOIN packages p ON LOWER(p.plan_name)=LOWER(c.package_name)
      WHERE LOWER(c.username)=LOWER($1) OR c.id::text=$1
      ORDER BY CASE WHEN LOWER(c.username)=LOWER($1) THEN 0 ELSE 1 END
      LIMIT 1`,
    [value]
  );
  const row = result.rows[0];
  if (!row || !row.username || !row.plan_name) return null;
  const amount = Number(row.price ?? row.monthly_bill);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    id: String(row.id),
    username: String(row.username),
    name: String(row.full_name || row.username),
    package: String(row.plan_name),
    billingPeriod: "Current monthly billing period",
    amount,
    expiryDate: row.expiration_date || null,
    status: String(row.status || "active")
  };
}

async function settings(req, res) {
  try {
    res.set("Cache-Control", "no-store, max-age=0");
    return res.json({ success: true, providers: await getMfsSettings() });
  } catch (error) {
    console.error("[Public Payment Settings]", error.message);
    return fail(res, 503, "Payment settings are temporarily unavailable.");
  }
}

async function checkBill(req, res) {
  if (!rateLimit(req, "payment-check-bill", 10)) return fail(res, 429, "Too many attempts. Please try again in one minute.");
  try {
    const identifier = clean(req.body?.subscriberId || req.body?.identifier || req.body?.username);
    if (!identifier) return fail(res, 400, "Enter your Subscriber Username / ID.");
    const subscriber = await findPppoeSubscriber(identifier);
    if (!subscriber) return fail(res, 404, "PPPoE subscriber was not found or has no valid monthly bill.");
    req.session.pppoePaymentLookup = { username: subscriber.username, checkedAt: Date.now() };
    req.session.save(error => {
      if (error) return fail(res, 503, "Unable to establish a secure payment session. Please try again.");
      res.set("Cache-Control", "no-store");
      return res.json({ success: true, subscriber });
    });
  } catch (error) {
    console.error("[Public Payment Bill Check]", error.message);
    return fail(res, 503, "Unable to retrieve the bill. Please try again later.");
  }
}

async function createSession(req, res) {
  if (!rateLimit(req, "payment-session", 12)) return fail(res, 429, "Too many attempts. Please try again in one minute.");
  try {
    const username = clean(req.body?.subscriberId || req.body?.username, 100);
    const provider = clean(req.body?.provider, 20).toLowerCase();
    if (!username || !PROVIDERS.has(provider)) return fail(res, 400, "A subscriber ID and valid MFS provider are required.");
    const lookup = req.session.pppoePaymentLookup;
    if (!lookup || lookup.username.toLowerCase() !== username.toLowerCase() || Date.now() - lookup.checkedAt > 10 * 60 * 1000) {
      return fail(res, 401, "Check your subscriber bill again before starting payment.");
    }
    const subscriber = await findPppoeSubscriber(username);
    if (!subscriber) return fail(res, 404, "PPPoE subscriber was not found.");
    const providers = await getMfsSettings();
    if (!providers[provider]?.enabled) return fail(res, 409, "This payment provider is not configured.");
    const paymentSessionId = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + SESSION_TTL_MS;
    req.session.pppoePaymentSession = {
      id: paymentSessionId,
      username: subscriber.username,
      provider,
      amount: subscriber.amount,
      expiresAt
    };
    req.session.save(error => {
      if (error) return fail(res, 503, "Unable to create a payment session.");
      res.set("Cache-Control", "no-store");
      return res.json({
        success: true,
        paymentSessionId,
        expiresAt: new Date(expiresAt).toISOString(),
        expiresInSeconds: 300,
        provider,
        amount: subscriber.amount,
        receivingNumber: providers[provider].number
      });
    });
  } catch (error) {
    console.error("[Public Payment Session]", error.message);
    return fail(res, 503, "Unable to start payment. Please try again.");
  }
}

async function confirm(req, res) {
  if (!rateLimit(req, "payment-confirm", 6)) return fail(res, 429, "Too many attempts. Please try again later.");
  const session = req.session.pppoePaymentSession;
  const paymentSessionId = clean(req.body?.paymentSessionId, 128);
  const transactionId = clean(req.body?.transactionId || req.body?.trxId, 120).toUpperCase();
  if (!session || !paymentSessionId || !crypto.timingSafeEqual(
    Buffer.from(session.id), Buffer.from(paymentSessionId.padEnd(session.id.length, "\0").slice(0, session.id.length))
  ) || session.id.length !== paymentSessionId.length) {
    return fail(res, 401, "Your payment session is invalid. Select a provider again.");
  }
  if (Date.now() >= Number(session.expiresAt)) {
    delete req.session.pppoePaymentSession;
    return fail(res, 410, "Your payment session has expired. Start a new payment session.");
  }
  if (!transactionId || transactionId.length < 4) return fail(res, 400, "Enter a valid TrxID.");
  try {
    const subscriber = await findPppoeSubscriber(session.username);
    if (!subscriber) return fail(res, 404, "PPPoE subscriber was not found.");
    const providers = await getMfsSettings();
    if (!providers[session.provider]?.enabled) return fail(res, 409, "The selected payment provider is no longer configured.");
    // The existing renewal controller verifies the received transaction, channel and amount,
    // and delegates to the guarded payment claim + RouterOS renewal path.
    req.body = {
      username: subscriber.username,
      trxId: transactionId,
      paymentMethod: session.provider,
      amount: subscriber.amount,
      service_type: "pppoe"
    };
    return legacyRenewal.verifyRenewal(req, res);
  } catch (error) {
    console.error("[Public Payment Confirmation]", error.message);
    return fail(res, 503, "Payment verification is temporarily unavailable.");
  }
}

module.exports = { settings, checkBill, createSession, confirm };
