const crypto = require("node:crypto");
const db = require("../db");
const payments = require("./paymentController");

const buckets = new Map();
const SESSION_TTL_MS = 5 * 60 * 1000;

function limited(req, key, limit = 8) {
  const now = Date.now();
  const id = String(req.ip || "unknown") + ":" + key;
  let bucket = buckets.get(id);
  if (!bucket || now - bucket.start >= 60_000) bucket = { start: now, count: 0 };
  bucket.count++;
  buckets.set(id, bucket);
  if (buckets.size > 5000) {
    for (const [key, value] of buckets) {
      if (now - value.start > 120_000) buckets.delete(key);
      if (buckets.size <= 4000) break;
    }
  }
  return bucket.count <= limit;
}
function fail(res, status, message, extra = {}) {
  return res.status(status).set("Cache-Control", "no-store").json({ success: false, message, ...extra });
}
function clean(v, max = 120) { return String(v ?? "").trim().slice(0, max); }
function normalizePhone(v) {
  const bn = "০১২৩৪৫৬৭৮৯";
  let s = String(v || "").replace(/[০-৯]/g, ch => String(bn.indexOf(ch))).replace(/\D/g, "");
  if (s.startsWith("880") && s.length === 13) s = "0" + s.slice(3);
  return s;
}
async function resolveSubscriber(identifier) {
  const input = clean(identifier, 120);
  if (!input) return null;
  const phone = normalizePhone(input);
  const result = await db.query(
    `SELECT c.id,c.username,c.full_name,c.package_name,c.monthly_bill,c.expiration_date,c.status,c.phone,
            p.plan_name,p.price,p.duration_months,p.profile_name
       FROM customers c
       LEFT JOIN packages p ON LOWER(p.plan_name)=LOWER(c.package_name)
      WHERE LOWER(c.username)=LOWER($1)
         OR ($2<>'' AND REGEXP_REPLACE(COALESCE(c.phone,''),'[^0-9]','','g') IN ($2, CASE WHEN LEFT($2,1)='0' THEN '88'||SUBSTRING($2 FROM 2) ELSE $2 END))
      ORDER BY CASE WHEN LOWER(c.username)=LOWER($1) THEN 0 ELSE 1 END
      LIMIT 2`,
    [input, phone]
  );
  if (!result.rows.length) return null;
  if (result.rows.length > 1) {
    const exact = result.rows.find(row => String(row.username).toLowerCase() === input.toLowerCase());
    return exact || null;
  }
  return result.rows[0];
}
function getBillAmount(customer) {
  const packagePrice = Number(customer.price);
  const monthlyBill = Number(customer.monthly_bill);
  // A zero-priced or missing package row must not override a valid customer bill.
  const amount = Number.isFinite(packagePrice) && packagePrice > 0 ? packagePrice : monthlyBill;
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}
function publicSubscriber(customer) {
  const amount = getBillAmount(customer);
  return {
    username: String(customer.username),
    name: String(customer.full_name || customer.username),
    package: String(customer.plan_name || customer.package_name || ""),
    amount,
    expiryDate: customer.expiration_date || null,
    status: String(customer.status || "active").toLowerCase()
  };
}
async function getPaymentSettings() {
  const keys = ["mfs_bkash_number", "mfs_nagad_number", "mfs_rocket_number", "mfs_upay_number"];
  const result = await db.query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])", [keys]);
  const values = Object.fromEntries((result.rows || []).map(row => [row.key, row.value]));
  const providers = {};
  for (const id of ["bkash", "nagad", "rocket", "upay"]) {
    const number = clean(values["mfs_" + id + "_number"], 80);
    providers[id] = { enabled: Boolean(number), number };
  }
  return providers;
}
let paymentSessionSchemaPromise = null;
async function ensurePaymentSessionSchema() {
  if (!paymentSessionSchemaPromise) {
    paymentSessionSchemaPromise = (async () => {
      await db.query(`CREATE TABLE IF NOT EXISTS public_payment_sessions (
        session_id VARCHAR(128) PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        provider VARCHAR(20) NOT NULL CHECK (provider IN ('bkash','nagad','rocket','upay')),
        amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
      await db.query("CREATE INDEX IF NOT EXISTS idx_public_payment_sessions_expires_at ON public_payment_sessions(expires_at)");
    })().catch(error => {
      paymentSessionSchemaPromise = null;
      throw error;
    });
  }
  return paymentSessionSchemaPromise;
}

async function paymentSettings(req, res) {
  try {
    const providers = await getPaymentSettings();
    const accounts = Object.fromEntries(Object.entries(providers).map(([id, item]) => [id, item.number]));
    const mfs = Object.entries(providers).filter(([, item]) => item.enabled).map(([id, item]) => ({ id, name: id, enabled: true, number: item.number }));
    return res.set("Cache-Control", "no-store").json({ success: true, providers, accounts, mfs });
  } catch (error) {
    console.error("[Public Payment Settings]", error?.message || error);
    return fail(res, 503, "Payment methods are temporarily unavailable.");
  }
}
async function checkSubscriber(req, res) {
  if (!limited(req, "pppoe-check", 10)) return fail(res, 429, "Too many attempts. Please try again in one minute.");
  try {
    const identifier = clean(req.body?.identifier || req.body?.username || req.body?.customer_id || req.body?.subscriberId);
    if (!identifier) return fail(res, 400, "Enter your subscriber username or ID.");
    const customer = await resolveSubscriber(identifier);
    if (!customer || !customer.username || !customer.plan_name) return fail(res, 404, "Subscriber account not found. Please check your username or ID.");
    return res.set("Cache-Control", "no-store").json({ success: true, subscriber: publicSubscriber(customer) });
  } catch (error) {
    console.error("[Public PPPoE Bill Check]", error?.message || error);
    return fail(res, 503, "Unable to retrieve your bill right now. Please try again later.");
  }
}
async function createPaymentSession(req, res) {
  if (!limited(req, "pppoe-payment-session", 10)) return fail(res, 429, "Too many payment sessions. Please try again shortly.");
  try {
    const username = clean(req.body?.username || req.body?.identifier || req.body?.subscriberId);
    const provider = clean(req.body?.provider || req.body?.paymentMethod, 20).toLowerCase();
    if (!username || !["bkash", "nagad", "rocket", "upay"].includes(provider)) {
      return fail(res, 400, "A subscriber username and valid payment provider are required.");
    }
    const customer = await resolveSubscriber(username);
    if (!customer || !customer.username || !customer.plan_name) return fail(res, 404, "Subscriber account not found.");
    const amount = getBillAmount(customer);
    if (!Number.isFinite(amount) || amount <= 0) return fail(res, 400, "The current monthly bill is not configured correctly.");
    const providers = await getPaymentSettings();
    if (!providers[provider]?.enabled) return fail(res, 409, "This payment provider is not configured. Please choose another provider.");
    // The main schema bootstrap can be interrupted by unrelated legacy migrations; ensure this additive table independently.
    await ensurePaymentSessionSchema();
    const paymentSessionId = crypto.randomBytes(32).toString("hex");
    const expiresAt = Date.now() + SESSION_TTL_MS;
    // Keep session cleanup and insertion atomic; always release the pooled connection.
    const client = await db.getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query("DELETE FROM public_payment_sessions WHERE expires_at <= NOW()");
      await client.query(
        "INSERT INTO public_payment_sessions(session_id,username,provider,amount,expires_at) VALUES($1,$2,$3,$4,to_timestamp($5 / 1000.0))",
        [paymentSessionId, String(customer.username), provider, amount, expiresAt]
      );
      await client.query("COMMIT");
    } catch (transactionError) {
      await client.query("ROLLBACK").catch(() => {});
      throw transactionError;
    } finally {
      client.release();
    }
    const providerNames = { bkash: "bKash", nagad: "Nagad", rocket: "Rocket", upay: "Upay" };
    return res.set("Cache-Control", "no-store, max-age=0").status(201).json({
      success: true,
      paymentSessionId,
      expiresAt: new Date(expiresAt).toISOString(),
      expiresInSeconds: Math.floor(SESSION_TTL_MS / 1000),
      provider,
      providerName: providerNames[provider],
      amount,
      receivingNumber: providers[provider].number,
      instructions: {
        title: providerNames[provider] + " payment",
        primaryAction: "Send Money",
        note: "Send the exact bill amount and enter the transaction ID from the payment confirmation."
      }
    });
  } catch (error) {
    console.error("[Public Payment Session]", error?.message || error);
    return fail(res, 503, "Unable to start a payment session. Please try again.");
  }
}
async function confirmPayment(req, res) {
  if (!limited(req, "pppoe-payment-confirm", 6)) return fail(res, 429, "Too many payment confirmation attempts. Please try again later.");
  const paymentSessionId = clean(req.body?.paymentSessionId, 128);
  const trxId = clean(req.body?.transactionId || req.body?.trxId || req.body?.trx_id, 80).toUpperCase();
  if (!paymentSessionId || !trxId) return fail(res, 400, "A payment session and transaction ID are required.");
  let sessionResult;
  try {
    sessionResult = await db.query(
      "SELECT username,provider,amount,expires_at FROM public_payment_sessions WHERE session_id=$1 LIMIT 1",
      [paymentSessionId]
    );
  } catch (error) {
    console.error("[Public Payment Session Lookup]", error?.message || error);
    return fail(res, 503, "Payment verification is temporarily unavailable.");
  }
  const session = sessionResult.rows[0];
  if (!session) return fail(res, 410, "Payment session is invalid or has expired. Start a new payment session.");
  if (new Date(session.expires_at).getTime() <= Date.now()) {
    await db.query("DELETE FROM public_payment_sessions WHERE session_id=$1", [paymentSessionId]).catch(() => {});
    return fail(res, 410, "Payment session has expired. Start a new payment session.");
  }
  // The server owns the username, provider, amount, and expiry. Never trust browser-submitted amounts.
  await db.query("DELETE FROM public_payment_sessions WHERE session_id=$1", [paymentSessionId]);
  req.body = {
    ...req.body,
    username: session.username,
    amount: Number(session.amount),
    paymentMethod: session.provider,
    trxId,
    service_type: "pppoe"
  };
  return verifyRenewal(req, res);
}
async function verifyRenewal(req, res) {
  if (!limited(req, "pppoe-renewal", 6)) return fail(res, 429, "Too many attempts. Please try again in one minute.");
  try {
    const identifier = clean(req.body?.username || req.body?.identifier);
    const trxId = clean(req.body?.trxId || req.body?.trx_id, 80).toUpperCase();
    const method = clean(req.body?.paymentMethod || req.body?.gateway, 20).toLowerCase();
    const submittedAmount = Number(req.body?.amount);
    if (!identifier || !trxId || !["bkash", "nagad", "rocket", "upay"].includes(method)) {
      return fail(res, 400, "Subscriber ID, TrxID, and a valid MFS provider are required.");
    }
    const customer = await resolveSubscriber(identifier);
    if (!customer || !customer.username || !customer.plan_name) return fail(res, 404, "Subscriber account not found.");
    const expected = getBillAmount(customer);
    if (!Number.isFinite(expected) || expected <= 0 || Math.round(submittedAmount * 100) !== Math.round(expected * 100)) {
      return fail(res, 400, "The submitted bill amount does not match the current monthly bill.");
    }
    const trx = await db.query("SELECT trx_id,amount,channel,status,used FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1", [trxId]);
    if (!trx.rows.length) return fail(res, 404, "Transaction ID has not been received yet. Please retry after your payment notification has been processed.");
    const row = trx.rows[0];
    if (String(row.channel || "").toLowerCase() !== method) return fail(res, 400, "The selected payment provider does not match this transaction.");
    if (Math.round(Number(row.amount) * 100) !== Math.round(expected * 100)) return fail(res, 400, "The transaction amount does not match your bill.");
    if (String(row.status || "").toLowerCase() !== "unmatched" || row.used === true) return fail(res, 409, "This transaction ID has already been used or is not available for verification.");
    req.body = { ...req.body, trxId, service_type: "pppoe", username: customer.username };
    return payments.manualMatch(req, res);
  } catch (error) {
    console.error("[Public PPPoE Renewal]", error?.message || error);
    return fail(res, 503, "Payment verification or renewal could not be completed. Please retry with your transaction ID.");
  }
}
module.exports = { checkSubscriber, verifyRenewal, paymentSettings, createPaymentSession, confirmPayment };
