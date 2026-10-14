const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("public routes retain customer login and remove deprecated account check", () => {
  const routes = read("routes/publicRoutes.js");
  assert.doesNotMatch(routes, /customer-check|publicCustomerCheck/);
  assert.match(routes, /router\.post\(["']\/customer-login["'],\s*controller\.publicCustomerLogin\)/);
});

test("public customer controller retains login and removes deprecated account check", () => {
  const controller = read("controllers/customerController.js");
  assert.doesNotMatch(controller, /publicCustomerCheck/);
  assert.match(controller, /publicCustomerLogin/);
});

test("public homepage retains customer login and removes deprecated account status section", () => {
  const view = read("views/index.ejs");
  assert.match(view, /id="customerLoginBtn"/);
  assert.doesNotMatch(view, /Quick Pay \/ Check Status/);
  assert.doesNotMatch(view, /id="account"/);
});

test("public hotspot package checkout uses configured MFS accounts and TrxID verification", () => {
  const view = read("views/index.ejs");
  const server = read("server.js");
  const controller = read("controllers/paymentController.js");
  assert.match(view, /data-buy-hotspot/);
  assert.match(view, /hotspotPurchaseForm/);
  assert.match(view, /paymentMethod/);
  assert.match(view, /hotspotBuyerTrxId/);
  assert.match(server, /paymentAccounts/);
  assert.match(controller, /requestedProfile/);
  assert.match(controller, /const method=String\(body\.paymentMethod\|\|body\.gateway/);
});

test("Hotspot checkout allows only unused unmatched payments and validates Hotspot price instead of PPPoE linkage", () => {
  const controller = read("controllers/paymentController.js");
  const verify = controller.slice(controller.indexOf("async function verifyTrx"), controller.indexOf("module.exports"));
  assert.match(verify, /AND \(used = false OR used IS NULL\)/);
  assert.match(verify, /LOWER\(TRIM\(status\)\) = 'unmatched'/);
  assert.match(verify, /const matches=profiles\.filter/);
  assert.match(verify, /profileIdentifierMatches/);
  assert.match(verify, /claimed_at=NOW\(\),claimed_by=\$1,claim_flow='hotspot'/);
  assert.doesNotMatch(verify, /This transaction is linked to a PPPoE customer/);
  assert.doesNotMatch(verify, /const pppoePrice=/);
});

test("test runner uses Node's built-in test framework", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.scripts.test, "node --test");
});
