const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

test("public homepage has exactly one English Online Payment link to /payment", () => {
  const view = read("views/index.ejs");
  assert.match(view, /href="\/payment" class="online-payment-cta" aria-label="Online Payment">Online Payment/);
  assert.equal((view.match(/href="\/payment(?:\.html)?"/g) || []).length, 1);
  const server = read("server.js");
  assert.match(server, /app\.get\("\/payment",\(req,res\)=>res\.sendFile\(path\.join\(__dirname,"public","payment\.html"\)\)\)/);
});

test("payment portal is English-only, light-theme, PPPoE-only, and uses server-side five-minute sessions", () => {
  const page = read("public/payment.html");
  assert.match(page, /<html lang="en">/);
  assert.match(page, /<title>Online Payment/);
  assert.match(page, /PPPoE Broadband Bill Payment/);
  assert.match(page, /Subscriber Username \/ ID/);
  assert.match(page, /Check Bill/);
  assert.match(page, /Select MFS Provider/);
  assert.match(page, /TrxID/);
  assert.match(page, /Confirm Payment &amp; Renew/);
  assert.match(page, /#f4f7fb/);
  assert.match(page, /300000/);
  assert.match(page, /\/api\/public\/payment\/settings/);
  assert.match(page, /\/api\/public\/payment\/check-bill/);
  assert.match(page, /\/api\/public\/payment\/session/);
  assert.match(page, /\/api\/public\/payment\/confirm/);
  assert.doesNotMatch(page, /hotspot|MAC address|packages|\/api\/verify-trx/i);
  assert.doesNotMatch(page, /[\u0980-\u09FF]/);
});

test("public PPPoE payment API is registered before the generic webhook and uses persisted guest sessions", () => {
  const server = read("server.js");
  const api = read("controllers/pppoePublicPaymentApi.js");
  const firstPaymentRoute = server.indexOf('app.get("/api/public/payment/settings"');
  const genericWebhook = server.indexOf('app.post("*",paymentController.dynamicWebhook)');
  assert.ok(firstPaymentRoute >= 0 && genericWebhook > firstPaymentRoute);
  assert.match(server, /pppoePublicPaymentApi\.settings/);
  assert.match(server, /pppoePublicPaymentApi\.checkBill/);
  assert.match(server, /pppoePublicPaymentApi\.createSession/);
  assert.match(server, /pppoePublicPaymentApi\.confirm/);
  assert.match(api, /INNER JOIN pppoe_users/);
  assert.match(api, /mfs_bkash_number/);
  assert.match(api, /SESSION_TTL_MS = 5 \* 60 \* 1000/);
  assert.match(api, /req\.session\.pppoePaymentSession/);
  assert.match(api, /legacyRenewal\.verifyRenewal\(req, res\)/);
  assert.doesNotMatch(api, /password\s*:\s*customer\.password/i);
});
