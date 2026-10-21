const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

test("public homepage links to the unified online payment portal", () => {
  const view = read("views/index.ejs");
  assert.match(view, /href="\/payment" class="online-payment-cta"/);
  assert.equal((view.match(/href="\/payment(?:\.html)?"/g) || []).length, 1, "homepage should have exactly one payment navigation link");
  assert.doesNotMatch(view, /online-payment-nav/);
  const server = read("server.js");
  assert.match(server, /app\.get\("\/payment",\(req,res\)=>res\.sendFile\(path\.join\(__dirname,"public","payment\.html"\)\)\)/);
});

test("payment portal is English-only and dedicated to PPPoE with a five-minute payment session", () => {
  const page = read("public/payment.html");
  assert.match(page, /<html lang="en">/);
  assert.match(page, /<title>Online Payment/);
  assert.match(page, /PPPoE Broadband Bill Payment/);
  assert.match(page, /Check Bill/);
  assert.match(page, /Confirm Payment & Renew/);
  assert.match(page, /\/api\/public\/payment\/settings/);
  assert.match(page, /startTimer\(\)/);
  assert.match(page, /300000/);
  assert.match(page, /\/api\/public\/payment\/check-bill/);
  assert.match(page, /\/api\/public\/payment\/session/);
  assert.match(page, /\/api\/public\/payment\/confirm/);
  assert.doesNotMatch(page, /hotspot|hotspot-mac|hotspot-phone|hotspot-packages|\/api\/verify-trx|submitMikrotik/i);
  assert.doesNotMatch(page, /[\u0980-\u09F2\u09F4-\u09FF]/, "all visible copy and markup must use English");
});

test("public PPPoE renewal validates bill, MFS channel and unused transaction before guarded renewal", () => {
  const controller = read("controllers/publicPaymentController.js");
  const server = read("server.js");
  assert.match(server, /app\.post\("\/api\/pppoe\/check-subscriber",publicPaymentController\.checkSubscriber\)/);
  assert.match(server, /app\.post\("\/api\/pppoe\/verify-renewal",publicPaymentController\.verifyRenewal\)/);
  assert.match(controller, /Math\.round\(submittedAmount \* 100\) !== Math\.round\(expected \* 100\)/);
  assert.match(controller, /row\.channel \|\| ""\)\.toLowerCase\(\) !== method/);
  assert.match(controller, /row\.used === true/);
  assert.match(controller, /payments\.manualMatch\(req, res\)/);
  assert.doesNotMatch(controller, /password\s*:\s*customer\.password/i);
});
