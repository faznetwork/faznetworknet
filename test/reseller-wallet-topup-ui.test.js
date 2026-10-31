'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function source(relativePath) { return fs.readFileSync(path.join(root, relativePath), 'utf8'); }

test('Account & Balance metric uses emerald-to-teal theme and cache-busted stylesheet', () => {
  const css = source('public/css/reseller-workspace.css');
  const view = source('views/reseller-dashboard.ejs');
  assert.match(css, /\.metric-card--account\{background:linear-gradient\(135deg,#059669 0%,#0d9488 100%\)/);
  assert.match(css, /\.metric-card--account \.metric-icon\{[^}]*background:rgba\(255,255,255,\.18\)/);
  assert.match(css, /\.metric-card--account \.metric-value\{[^}]*color:#fff/);
  assert.match(view, /reseller-workspace\.css\?v=20261101-5/);
});

test('reseller dashboard exposes guidance without claiming a request was submitted', () => {
  const view = source('views/reseller-dashboard.ejs');
  const script = source('public/js/reseller-dashboard.js');
  assert.match(view, /id="resellerBalanceGuidance"/);
  assert.match(view, /id="resellerBalanceGuidanceModal"/);
  assert.match(script, /trigger.dataset.billingMode === 'postpaid'/);
  assert.match(script, /does not submit a payment or create a request/);
});

test('admin top-up is delegated from the existing reseller directory', () => {
  const script = source('public/js/pop-reseller-admin.js');
  assert.match(script, /data-action="wallet-topup"/);
  assert.match(script, /action === 'wallet-topup'/);
  assert.match(script, /id="fprWalletTopupModal"/);
  assert.match(script, /name="paymentProvider"/);
  assert.match(script, /name="externalReference"/);
  assert.match(script, /name="notes"/);
  for (const provider of ['bKash', 'Nagad', 'Bank', 'Cash']) assert.ok(script.includes('value="' + provider + '"'), 'missing payment provider ' + provider);
});

test('admin top-up checks active prepaid billing and uses canonical finance endpoint', () => {
  const script = source('public/js/pop-reseller-admin.js');
  assert.match(script, /account\.account_status !== 'active'/);
  assert.match(script, /account\.billing_mode !== 'prepaid'/);
  assert.match(script, /\/admin\/reseller-finance\/accounts\//);
  assert.match(script, /\/wallet-topups/);
  assert.match(script, /'Idempotency-Key'/);
  assert.doesNotMatch(script, /\/api\/admin\/reseller-finance\/wallet-topup/);
});

test('top-up failures are visible and success refreshes the reseller directory', () => {
  const script = source('public/js/pop-reseller-admin.js');
  assert.match(script, /Wallet top-up failed/);
  assert.match(script, /console\.error\('\[Reseller Finance UI\] Wallet top-up failed:/);
  assert.match(script, /await window\.loadResellerAccess\(\)/);
  assert.match(script, /submit\.disabled = true/);
});

test('finance API remains admin-scoped and uses existing transactional service', () => {
  const routes = source('routes/resellerFinanceRoutes.js');
  const controller = source('controllers/resellerFinanceController.js');
  const service = source('services/resellerFinanceService.js');
  assert.match(routes, /router\.post\('\/accounts\/:resellerId\/wallet-topups',controller\.walletTopup\)/);
  assert.match(controller, /financeService\.walletTopup/);
  assert.match(service, /db\.withTransaction/);
  assert.match(service, /pg_advisory_xact_lock/);
  assert.match(service, /INSERT INTO public\.reseller_ledger_entries/);
});
