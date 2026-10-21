const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

test("public payment API routes are registered and wired to the PPPoE controller", () => {
  const server = read("server.js");
  assert.match(server, /app\.get\("\/api\/public\/payment\/settings",publicPaymentController\.paymentSettings\)/);
  assert.match(server, /app\.post\("\/api\/public\/payment\/check-bill",publicPaymentController\.checkSubscriber\)/);
  assert.match(server, /app\.post\("\/api\/public\/payment\/session",publicPaymentController\.createPaymentSession\)/);
  assert.match(server, /app\.post\("\/api\/public\/payment\/confirm",publicPaymentController\.confirmPayment\)/);
});

test("payment sessions persist server-authoritative subscriber, provider, amount, and expiry in PostgreSQL", () => {
  const controller = read("controllers/publicPaymentController.js");
  const schema = read("db/schema.sql");
  assert.match(controller, /INSERT INTO public_payment_sessions/);
  assert.match(controller, /SELECT username,provider,amount,expires_at FROM public_payment_sessions/);
  assert.match(controller, /DELETE FROM public_payment_sessions WHERE session_id=\$1/);
  assert.match(controller, /SESSION_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(controller, /amount: Number\(session\.amount\)/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS public_payment_sessions/);
  assert.match(schema, /CHECK \(provider IN \('bkash','nagad','rocket','upay'\)\)/);
});

test("payment portal uses the four public API endpoints and does not submit a browser-controlled amount on confirmation", () => {
  const page = read("public/payment.html");
  assert.match(page, /\/api\/public\/payment\/settings/);
  assert.match(page, /\/api\/public\/payment\/check-bill/);
  assert.match(page, /\/api\/public\/payment\/session/);
  assert.match(page, /\/api\/public\/payment\/confirm/);
  assert.match(page, /JSON\.stringify\(payload\)/);
  assert.match(page, /payload\.transactionId/);
  assert.doesNotMatch(page, /JSON\.stringify\(\{paymentSessionId,transactionId:trxId,amount/);
});

test("public PPPoE payment session returns the configured receiving number and falls back to customer bill when package price is zero", () => {
  const controller = read("controllers/publicPaymentController.js");
  const page = read("public/payment.html");
  assert.match(controller, /function getBillAmount\(customer\)/);
  assert.match(controller, /packagePrice > 0 \? packagePrice : monthlyBill/);
  assert.match(controller, /providerName: providerNames\[provider\]/);
  assert.match(controller, /receivingNumber: providers\[provider\]\.number/);
  assert.match(page, /modal\.querySelector\("\.modal"\)\.dataset\.provider=provider\.id/);
  assert.match(page, /#e2136e/);
  assert.match(page, /#f7941d/);
  assert.match(page, /#832b73/);
  assert.match(page, /#0054a6/);
  assert.match(page, /Verify TrxID & Renew/);
  assert.match(page, /id="modal-amount"/);\n  assert.match(page, /assets\\/images\\/bkash-logo\\.png/);\n  assert.match(page, /assets\\/images\\/nagad-logo\\.png/);\n  assert.doesNotMatch(page, /<svg/);\n  assert.match(page, /assets\\/images\\/bkash-logo\\.png/);\n  assert.match(page, /assets\\/images\\/nagad-logo\\.png/);\n  assert.doesNotMatch(page, /<svg/);
});


test("public payment confirmation supports backend-selected sender-phone matching without trusting client amount", () => {
  const controller = read("controllers/publicPaymentController.js");
  const page = read("public/payment.html");
  assert.match(controller, /payment_verification_method/);
  assert.match(controller, /verificationMethod === "senderPhoneNumber"/);
  assert.match(controller, /sender_phone/);
  assert.match(controller, /ROUND\(amount::numeric,2\)=ROUND\(\$3::numeric,2\)/);
  assert.match(controller, /LOWER\(TRIM\(status\)\)='unmatched'/);
  assert.match(controller, /COALESCE\(used,FALSE\)=FALSE/);
  assert.match(controller, /verifiedTrxId = clean\(matches\.rows\[0\]\.trx_id/);
  assert.match(page, /id="sender-phone"/);
  assert.match(page, /id="trx-id"/);
  assert.match(page, /applyVerificationMethod/);
  assert.match(page, /payload\.senderPhoneNumber/);
  assert.match(page, /payload\.transactionId/);
  assert.match(page, /#e2136e/);
  assert.match(page, /#f7941d/);
});


test("Hotspot captive checkout uses local MFS image assets and submits MAC credentials with either verification input", () => {
  const page = read("public/login.html");
  assert.match(page, /assets\/images\/bkash-logo\.png/);
  assert.match(page, /assets\/images\/nagad-logo\.png/);
  assert.match(page, /assets\/images\/rocket-logo\.png/);
  assert.match(page, /assets\/images\/upay-logo\.png/);
  assert.doesNotMatch(page, /<svg/);
  assert.match(page, /service_type: 'hotspot'/);
  assert.match(page, /payload\.senderPhoneNumber = phoneInput/);
  assert.match(page, /payload\.trxId = trxInput/);
  assert.match(page, /document\.getElementById\('mt-user'\)\.value = routerMac/);
  assert.match(page, /document\.getElementById\('mt-pass'\)\.value = routerMac/);
  assert.match(page, /paymentSessionExpiresAt=Date\.now\(\)\+300000/);
});
