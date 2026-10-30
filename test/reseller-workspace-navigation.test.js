'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('reseller workspace exposes isolated authenticated page routes before customer profile route', () => {
  const server = read('server.js');
  const addRoute = server.indexOf('app.get("/reseller/customers/add"');
  const profileRoute = server.indexOf('app.get("/reseller/customers/:id"');
  assert.ok(addRoute >= 0 && profileRoute >= 0 && addRoute < profileRoute);
  for (const route of ['/reseller/dashboard','/reseller/vouchers/generate','/reseller/vouchers/history','/reseller/customers','/reseller/customers/add','/reseller/payments']) {
    const line = server.split('\n').find(value => value.includes('app.get("' + route + '"'));
    assert.ok(line, 'Missing page route ' + route);
    assert.match(line, /requireRole\(\["reseller"\]\),loadTenantScope/);
    assert.match(line, /Cache-Control/);
    assert.match(line, /activePath:req.path/);
  }
});

test('reseller workspace pages use the shared shell and separated page assets', () => {
  for (const view of ['reseller-dashboard.ejs','reseller-vouchers.ejs','reseller-customers.ejs','reseller-payments.ejs']) {
    const source = read(path.join('views',view));
    assert.match(source, /partials\/reseller-sidebar/);
    assert.match(source, /partials\/reseller-topbar/);
    assert.match(source, /partials\/reseller-scripts/);
    if (view === 'reseller-dashboard.ejs' || view === 'reseller-payments.ejs') assert.doesNotMatch(source, /id="voucherPop"/, 'Dashboard and payments must not render voucher controls');
  }
  assert.match(read('public/css/reseller-workspace.css'), /--fzn-green:#0a3d2e/);
  assert.ok(read('public/css/reseller-workspace.css').includes('Plus+Jakarta+Sans'));
  assert.ok(read('public/js/reseller-workspace.js').includes("document.body.style.position='fixed'"));
  assert.ok(read('public/js/reseller-workspace.js').includes('window.scrollTo(0,lockedScrollY)'));
});

test('voucher and customer views remain separated and preserve existing API contracts', () => {
  const voucher = read('views/reseller-vouchers.ejs');
  const customers = read('views/reseller-customers.ejs');
  assert.match(voucher, /Generate Hotspot Vouchers/);
  assert.match(voucher, /Voucher Batch History/);
  assert.doesNotMatch(customers, /voucher/i);
  assert.match(customers, /name="activationDate"/);
  assert.match(customers, /id="newCustomerExpiryDate" type="hidden" name="expirationDate"/);
  assert.doesNotMatch(customers, /id="newCustomerExpiryDate"[^>]*type="date"/);
  assert.match(customers, /newCustomerExpiryPreview/);
  assert.ok(read('public/js/reseller-customers.js').includes('data-duration-months'));
  assert.ok(read('public/js/reseller-customers.js').includes('addCalendarMonths(connection,months)'));
  assert.match(customers, /id="newCustomerVlan"[^>]*readonly/);
  assert.match(customers, /id="newCustomerIpPool"[^>]*readonly/);
  assert.match(read('public/js/reseller-customers.js'), /api\+'\/packages'/);
  assert.match(read('public/js/reseller-customers.js'), /api\+'\/customers'/);
  assert.match(read('routes/resellerPortalRoutes.js'), /router\.post\('\/customers', controller\.createCustomer\)/);
  assert.match(read('routes/resellerPortalRoutes.js'), /router\.post\('\/hotspot\/voucher-batches', hotspotController\.issueBatch\)/);
});

test('reports and payments use existing scoped per-customer payment history only', () => {
  const view = read('views/reseller-payments.ejs');
  const js = read('public/js/reseller-payments.js');
  assert.match(view, /Customer Payment History/);
  assert.match(js, /\/customers\/'\+encodeURIComponent\(customerId\)\+'\/payments/);
  assert.doesNotMatch(js, /\/payments\/transactions|\/reports/);
});

test('reseller workspace activePath is explicitly passed and partials safely default missing locals', () => {
  const server = read('server.js');
  const lines = server.split(String.fromCharCode(10));
  for (const route of ['/reseller/dashboard','/reseller/vouchers/generate','/reseller/vouchers/history','/reseller/customers','/reseller/customers/add','/reseller/payments']) {
    const line = lines.find(value => value.includes('app.get("' + route + '"'));
    assert.ok(line, 'Missing route ' + route);
    assert.ok(line.includes('activePath:req.path'), 'Missing activePath local for ' + route);
  }
  for (const partial of ['reseller-scripts.ejs','reseller-sidebar.ejs']) {
    const source = read(path.join('views/partials', partial));
    assert.ok(source.includes("typeof activePath !== 'undefined'"));
    assert.ok(source.includes('safeActivePath'));
  }
  for (const view of ['reseller-dashboard.ejs','reseller-vouchers.ejs','reseller-customers.ejs','reseller-payments.ejs']) {
    const source = read(path.join('views', view));
    assert.ok(source.includes("include('partials/reseller-scripts', { activePath })"));
  }
});

test('reseller package duration drives a validated month-end-safe expiry date', () => {
  const vm = require('node:vm');
  const context = { window: {}, document: { addEventListener() {} }, Intl, Date, Number, String, Math };
  vm.runInNewContext(read('public/js/reseller-workspace.js'), context);
  const calculate = context.window.ResellerWorkspace.addCalendarMonths;
  assert.equal(calculate('2026-01-31', 1), '2026-02-28');
  assert.equal(calculate('2026-01-31', 2), '2026-03-31');
  assert.equal(calculate('2026-02-28', 12), '2027-02-28');
  assert.equal(calculate('2026-01-31', 0), '');
  assert.equal(calculate('2026-02-30', 1), '');
});
