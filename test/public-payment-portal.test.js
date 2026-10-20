const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = p => fs.readFileSync(path.join(root, p), "utf8");

test("public homepage links to the unified online payment portal", () => {
  const view = read("views/index.ejs");
  assert.match(view, /href="\/payment\.html" class="online-payment-nav"/);
  assert.match(view, /href="\/payment\.html" class="online-payment-cta"/);
});

test("unified payment portal uses dynamic public MFS/package settings and five-minute payment session", () => {
  const page = read("public/payment.html");
  assert.match(page, /\/api\/public\/portal-config/);
  assert.match(page, /\/api\/settings\/public/);
  assert.match(page, /startTimer\(\)/);
  assert.match(page, /300000/);
  assert.match(page, /\/api\/verify-trx/);
  assert.match(page, /\/api\/pppoe\/check-subscriber/);
  assert.match(page, /\/api\/pppoe\/verify-renewal/);
  assert.match(page, /submitMikrotik\(data\.username,data\.password/);
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
