'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const billingService = require('../services/resellerBillingAccountService');
const { loadResellerBillingAccount } = require('./resellerBillingAccount');

function response() {
  return { locals: {} };
}

test('shared billing middleware assigns account and availability locals on success', async () => {
  const original = billingService.ensureBillingAccount;
  const account = { resellerId: 42, availableBalance: 125 };
  billingService.ensureBillingAccount = async resellerId => {
    assert.equal(resellerId, 42);
    return account;
  };

  try {
    const req = { auth: { resellerId: 42 } };
    const res = response();
    let nextCalls = 0;
    await loadResellerBillingAccount(req, res, () => { nextCalls += 1; });

    assert.equal(req.billingAccount, account);
    assert.equal(req.billingAccountUnavailable, false);
    assert.equal(res.locals.billingAccount, account);
    assert.equal(res.locals.billingAccountUnavailable, false);
    assert.equal(nextCalls, 1);
  } finally {
    billingService.ensureBillingAccount = original;
  }
});

test('shared billing middleware normalizes a missing account to null and unavailable=true', async () => {
  const original = billingService.ensureBillingAccount;
  billingService.ensureBillingAccount = async () => null;

  try {
    const req = { auth: { resellerId: 42 } };
    const res = response();
    await loadResellerBillingAccount(req, res, () => {});

    assert.equal(req.billingAccount, null);
    assert.equal(req.billingAccountUnavailable, true);
    assert.equal(res.locals.billingAccount, null);
    assert.equal(res.locals.billingAccountUnavailable, true);
  } finally {
    billingService.ensureBillingAccount = original;
  }
});

test('shared billing middleware exposes unavailable locals and logs diagnostics on loader failure', async () => {
  const original = billingService.ensureBillingAccount;
  const originalError = console.error;
  const failure = Object.assign(new Error('billing store unavailable'), { code: 'BILLING_STORE_DOWN' });
  const diagnostics = [];
  billingService.ensureBillingAccount = async () => { throw failure; };
  console.error = (...args) => diagnostics.push(args);

  try {
    const req = { auth: { resellerId: 42 } };
    const res = response();
    let nextCalls = 0;
    await loadResellerBillingAccount(req, res, () => { nextCalls += 1; });

    assert.equal(req.billingAccount, null);
    assert.equal(req.billingAccountUnavailable, true);
    assert.equal(res.locals.billingAccount, null);
    assert.equal(res.locals.billingAccountUnavailable, true);
    assert.equal(nextCalls, 1);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0][1].code, 'BILLING_STORE_DOWN');
  } finally {
    billingService.ensureBillingAccount = original;
    console.error = originalError;
  }
});

test('every authenticated reseller workspace page route loads shared billing locals before rendering', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  const routes = [
    '/reseller/dashboard',
    '/reseller/vouchers/generate',
    '/reseller/vouchers/history',
    '/reseller/customers',
    '/reseller/customers/add',
    '/reseller/payments',
    '/reseller/customers/:id',
    '/reseller/hotspot/voucher-batches/:batchKey/print'
  ];

  for (const routePath of routes) {
    const escaped = routePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const route = server.match(new RegExp('app\\.get\\("' + escaped + '"([^;]*);'));
    assert.ok(route, 'expected route registration for ' + routePath);
    assert.match(route[1], /loadResellerBillingAccount/, routePath + ' must load billing locals before its handler');
  }

  assert.match(server, /app\\.get\\("\/reseller\/login"/, 'public reseller login remains outside the billing loader');
  assert.match(server, /app\\.get\\("\/reseller\/accept-invite"/, 'public reseller invite acceptance remains outside the billing loader');
});

test('dashboard controller passes both normalized billing locals to its view', () => {
  const controller = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'resellerPortalController.js'), 'utf8');
  assert.match(controller, /billingAccount,\\s*billingAccountUnavailable:\\s*!billingAccount/);
});

