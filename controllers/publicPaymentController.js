const db = require("../db");
const payments = require("./paymentController");

const buckets = new Map();
function limited(req, key, limit = 8) {
  const now = Date.now();
  const id = String(req.ip || "unknown") + ":" + key;
  let bucket = buckets.get(id);
  if (!bucket || now - bucket.start >= 60_000) bucket = { start: now, count: 0 };
  bucket.count++;
  buckets.set(id, bucket);
  if (buckets.size > 5000) { for (const [key, value] of buckets) { if (now - value.start > 120_000) buckets.delete(key); if (buckets.size <= 4000) break; } }
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
async function checkSubscriber(req, res) {
  if (!limited(req, "pppoe-check", 10)) return fail(res, 429, "অনেকবার চেষ্টা করা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।");
  try {
    const identifier = clean(req.body?.identifier || req.body?.username || req.body?.customer_id);
    if (!identifier) return fail(res, 400, "Subscriber ID বা username লিখুন।");
    const customer = await resolveSubscriber(identifier);
    if (!customer || !customer.username || !customer.plan_name) return fail(res, 404, "অ্যাকাউন্ট পাওয়া যায়নি। Subscriber ID/username যাচাই করুন।");
    const status = String(customer.status || "active").toLowerCase();
    return res.set("Cache-Control", "no-store").json({
      success: true,
      subscriber: {
        username: customer.username,
        name: customer.full_name || customer.username,
        package: customer.plan_name,
        amount: Number(customer.price ?? customer.monthly_bill ?? 0),
        expiryDate: customer.expiration_date || null,
        status
      }
    });
  } catch (error) {
    console.error("[Public PPPoE Bill Check]", error?.message || error);
    return fail(res, 503, "বিল যাচাই করা যাচ্ছে না। কিছুক্ষণ পরে আবার চেষ্টা করুন।");
  }
}
async function verifyRenewal(req, res) {
  if (!limited(req, "pppoe-renewal", 6)) return fail(res, 429, "অনেকবার চেষ্টা করা হয়েছে। এক মিনিট পরে আবার চেষ্টা করুন।");
  try {
    const identifier = clean(req.body?.username || req.body?.identifier);
    const trxId = clean(req.body?.trxId || req.body?.trx_id, 80).toUpperCase();
    const method = clean(req.body?.paymentMethod || req.body?.gateway, 20).toLowerCase();
    const submittedAmount = Number(req.body?.amount);
    if (!identifier || !trxId || !["bkash", "nagad", "rocket", "upay"].includes(method)) {
      return fail(res, 400, "Subscriber ID, TrxID এবং বৈধ MFS মাধ্যম আবশ্যক।");
    }
    const customer = await resolveSubscriber(identifier);
    if (!customer || !customer.username || !customer.plan_name) return fail(res, 404, "Subscriber account পাওয়া যায়নি।");
    const expected = Number(customer.price ?? customer.monthly_bill ?? 0);
    if (!Number.isFinite(expected) || expected <= 0 || Math.round(submittedAmount * 100) !== Math.round(expected * 100)) {
      return fail(res, 400, "প্রদত্ত বিলের পরিমাণ বর্তমান মাসিক বিলের সঙ্গে মিলছে না।", { expectedAmount: expected });
    }
    const trx = await db.query("SELECT trx_id,amount,channel,status,used FROM transactions WHERE UPPER(TRIM(trx_id))=$1 LIMIT 1", [trxId]);
    if (!trx.rows.length) return fail(res, 404, "TrxID এখনো পাওয়া যায়নি। SMS payment forwarder আপডেট হলে আবার চেষ্টা করুন।");
    const row = trx.rows[0];
    if (String(row.channel || "").toLowerCase() !== method) return fail(res, 400, "নির্বাচিত MFS মাধ্যম TrxID-এর সঙ্গে মিলছে না।");
    if (Math.round(Number(row.amount) * 100) !== Math.round(expected * 100)) return fail(res, 400, "লেনদেনের পরিমাণ বিলের সঙ্গে মিলছে না।");
    if (String(row.status || "").toLowerCase() !== "unmatched" || row.used === true) return fail(res, 409, "এই TrxID ইতিমধ্যে ব্যবহার করা হয়েছে বা যাচাইয়ের জন্য উপলব্ধ নয়।");
    // Reuse the existing guarded renewal path: it claims the transaction atomically,
    // validates the exact bill again, updates RouterOS, persists expiry, and finalizes the payment.
    req.body = { ...req.body, trxId, service_type: "pppoe", username: customer.username };
    return payments.manualMatch(req, res);
  } catch (error) {
    console.error("[Public PPPoE Renewal]", error?.message || error);
    return fail(res, 503, "পেমেন্ট যাচাই বা renewal সম্পন্ন হয়নি। TrxID দিয়ে পুনরায় status যাচাই করুন।");
  }
}
module.exports = { checkSubscriber, verifyRenewal };
