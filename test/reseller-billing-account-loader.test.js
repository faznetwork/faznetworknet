'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('billing account ensure is idempotent and preserves existing balances and mode', () => {
  const service = read('services/resellerBillingAccountService.js');
  assert.match(service, /ON CONFLICT \(reseller_id\) DO NOTHING/);
  assert.match(service, /SELECT id,reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status/);
  assert.doesNotMatch(service, /UPDATE public\.reseller_billing_accounts/);
});

test('reseller workspace routes load a shared authenticated billing snapshot', () => {
  const server = read('server.js');
  const middleware = read('middleware/resellerBillingAccount.js');
  for (const route of ['/reseller/dashboard','/reseller/vouchers/generate','/reseller/vouchers/history','/reseller/customers','/reseller/customers/add','/reseller/payments']) {
    const line = server.split('\n').find(value => value.includes('app.get("' + route + '"'));
    assert.ok(line && line.includes('loadResellerBillingAccount'), 'Missing billing middleware: ' + route);
  }
  assert.match(middleware, /req\.auth\?\.resellerId/);
  assert.match(middleware, /res\.locals\.billingAccount = billingAccount/);
  assert.match(middleware, /res\.locals\.billingAccountUnavailable = true/);
});

test('dashboard uses shared account snapshot and safe fallback instead of raw conflict text', () => {
  const controller = read('controllers/resellerPortalController.js');
  assert.match(controller, /const billingAccount = req\.billingAccount \|\| null/);
  assert.match(controller, /ensureBillingAccount\(resellerId\)/);
  assert.match(controller, /Reseller dashboard is temporarily unavailable\. Please retry or contact support\./);
});
