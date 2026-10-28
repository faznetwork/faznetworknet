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

test("public hotspot package checkout uses configured MFS accounts and TrxID verification", async () => {
  const view = read("views/index.ejs");
  const settings = read("controllers/settingsController.js");
  const controller = read("controllers/paymentController.js");
  assert.match(view, /data-buy-hotspot/);
  assert.match(view, /hotspotPurchaseForm/);
  assert.match(view, /paymentMethod/);
  assert.match(view, /hotspotBuyerTrxId/);
  assert.match(settings, /mfs_bkash_number/);
  assert.match(settings, /mfs_nagad_number/);
  assert.match(settings, /activePaymentMethods/);
  const settingsController = require("../controllers/settingsController");
  const appSettings = require("../services/appSettings");
  const originalBrand = appSettings.getBrandSettings;
  const originalAll = appSettings.getAllSettings;
  appSettings.getBrandSettings = async () => ({ company_name: "FAZ NETWORK" });
  appSettings.getAllSettings = async () => ({ mfs_bkash_number: "01711111111", mfs_nagad_number: "", mfs_rocket_number: "01822222222", mfs_upay_number: "" });
  const response = { headers: {}, payload: null, set(key,value){ this.headers[key]=value; return this; }, status(code){ this.statusCode=code; return this; }, json(payload){ this.payload=payload; return this; } };
  try {
    await settingsController.publicSettings({}, response);
    assert.equal(response.statusCode, undefined);
    assert.deepEqual(response.payload.settings.active_payment_methods, ["bkash", "rocket"]);
    assert.equal(response.payload.settings.payment_accounts.bkash, "01711111111");
    assert.equal(response.payload.settings.payment_accounts.nagad, "");
  } finally {
    appSettings.getBrandSettings = originalBrand;
    appSettings.getAllSettings = originalAll;
  }
  assert.match(controller, /requestedProfile/);
  assert.match(controller, /const method=String\(body\.paymentMethod\|\|body\.gateway/);
});

test("Hotspot checkout allows only unused unmatched payments and validates Hotspot price instead of PPPoE linkage", () => {
  const controller = read("controllers/paymentController.js");
  const verify = controller.slice(controller.indexOf("async function verifyTrx"), controller.indexOf("module.exports"));
  assert.match(verify, /status='unmatched' AND \(used=false OR used IS NULL\)/);
  assert.match(verify, /status='unmatched' AND \(used=false OR used IS NULL\)/);
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
