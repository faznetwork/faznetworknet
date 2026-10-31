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
  assert.ok(read('public/css/reseller-workspace.css').includes(`--reseller-font:'Inter',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif`));
  assert.ok(read('public/css/reseller-workspace.css').includes('family=Inter'));
  assert.ok(!read('public/css/reseller-workspace.css').includes('Plus+Jakarta+Sans'));
  assert.ok(read('public/js/reseller-workspace.js').includes("Object.assign(document.body.style,{position:'fixed'"));
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


test('reseller workspace pages share a consistent heading/body typography and content grid', () => {
  const css = read('public/css/reseller-workspace.css');
  for (const contract of [
    '--reseller-body-size:14px;--reseller-body-weight:400',
    '--reseller-heading-size:1.125rem;--reseller-heading-weight:600',
    '--reseller-panel-gutter:24px',
    '--reseller-panel-gutter:16px',
    '--reseller-panel-gutter:12px',
    '.reseller-page-title{font-size:var(--reseller-heading-size)',
    '.reseller-section-heading h2{font-size:var(--reseller-heading-size)',
    '.reseller-panel>.reseller-section-heading{padding:20px var(--reseller-panel-gutter) 0',
    '.reseller-panel>.table-responsive{padding:0 var(--reseller-panel-gutter) 20px',
    '.reseller-panel>.pos-terminal{padding:0 var(--reseller-panel-gutter) 24px',
    '.reseller-panel>.reseller-customer-directory-wrap{padding:0 var(--reseller-panel-gutter)'
  ]) assert.ok(css.includes(contract), 'Missing shared layout/typography contract: '+contract);
  const profile = read('views/reseller-customer-profile.ejs');
  assert.ok(profile.includes('font-size:14px;font-weight:400;line-height:1.55'));
  assert.ok(profile.includes('.section-title{font-size:1.125rem;line-height:1.35;font-weight:600'));
});


test('reseller typography enforces the semantic weight hierarchy', () => {
  const css = read('public/css/reseller-workspace.css');
  assert.ok(css.includes('body{background:var(--fzn-bg);color:var(--fzn-ink);font-family:var(--reseller-font);font-size:14px;font-weight:400'));
  assert.ok(css.includes('.reseller-content p,.reseller-content .form-text,.reseller-content small,.reseller-content .small,.reseller-content .text-secondary,.reseller-content .text-muted{font-family:var(--reseller-font);font-size:inherit;font-weight:400'));
  assert.ok(css.includes('.reseller-section-heading p{font-size:.8rem;line-height:1.55;color:#64748b;font-weight:400'));
  assert.ok(css.includes('.reseller-content label,.reseller-content .form-label{font-family:var(--reseller-font);font-weight:500}'));
  assert.ok(css.includes('--reseller-page-title-weight:700'));
  assert.ok(css.includes('.reseller-page-title{font-size:var(--reseller-heading-size);line-height:var(--reseller-heading-line-height);font-weight:var(--reseller-page-title-weight)'));
  assert.ok(css.includes('.reseller-content h1,.reseller-content h2,.reseller-content h3{font-weight:600}'));
  assert.ok(css.includes('.metric-card--pops .metric-foot,.metric-card--active .metric-foot,.metric-card--inactive .metric-foot,.metric-card--renewals .metric-foot{color:rgba(255,255,255,.82);font-weight:400}'));
  assert.ok(css.includes('font-size:.72rem;font-weight:500;line-height:1.2;text-transform:capitalize}.pop-status-badge'));

  const voucher = read('views/reseller-vouchers.ejs');
  assert.ok(voucher.includes('.pos-kicker{font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;font-weight:500'));
  assert.ok(voucher.includes('.pos-chip{border:1px solid #cbd5e1;background:#fff;border-radius:9px;padding:8px 13px;font-weight:500}'));
  assert.ok(voucher.includes('.pos-issue{width:100%;padding:14px;border:0;border-radius:11px;background:#16a34a;color:#fff;font-weight:600}'));
  assert.ok(voucher.includes('.reseller-content .form-label.fw-semibold{font-weight:500}'));
  assert.ok(voucher.includes('.pos-line .muted{font-weight:400;color:#cbd5e1}'));

  const profile = read('views/reseller-customer-profile.ejs');
  assert.ok(profile.includes('.section-subtitle{font-size:.82rem;line-height:1.5;color:#64748b;font-weight:400'));
  assert.ok(profile.includes('.label{font-weight:500}'));
  assert.ok(profile.includes('.hero h1{font-weight:700;line-height:1.25}'));
  assert.doesNotMatch(profile, /class="h3 fw-bold mb-1"/);
});

test('all shared reseller stylesheet consumers use cache token 20261101-4', () => {
  const consumers = ['reseller-dashboard.ejs','reseller-vouchers.ejs','reseller-customers.ejs','reseller-payments.ejs'];
  for (const view of consumers) {
    const source = read(path.join('views', view));
    assert.match(source, /reseller-workspace\\.css\\?v=20261101-4/);
    assert.doesNotMatch(source, /reseller-workspace\\.css\\?v=20261101-3/);
  }
});
