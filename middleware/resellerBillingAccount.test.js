'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function loadMiddlewareWithStub(stub) {
  const servicePath = require.resolve('../services/resellerBillingAccountService');
  const middlewarePath = require.resolve('./resellerBillingAccount');
  const service = require(servicePath);
  const originalEnsureBillingAccount = service.ensureBillingAccount;
  service.ensureBillingAccount = stub;
  delete require.cache[middlewarePath];
  const { loadResellerBillingAccount } = require('./resellerBillingAccount');
  return {
    loadResellerBillingAccount,
    restore() {
      service.ensureBillingAccount = originalEnsureBillingAccount;
      delete require.cache[middlewarePath];
    }
  };
}

function response() {
  return { locals: {} };
}

test('shared billing middleware assigns account and availability locals on success', async () => {
  const account = { resellerId: 42, availableBalance: 125 };
  const harness = loadMiddlewareWithStub(async resellerId => {
    assert.equal(resellerId, 42);
    return account;
  });

  try {
    const req = { auth: { resellerId: 42 } };
    const res = response();
    let nextCalls = 0;
    await harness.loadResellerBillingAccount(req, res, () => { nextCalls += 1; });

    assert.equal(req.billingAccount, account);
    assert.equal(req.billingAccountUnavailable, false);
    assert.equal(res.locals.billingAccount, account);
    assert.equal(res.locals.billingAccountUnavailable, false);
    assert.equal(nextCalls, 1);
  } finally {
    harness.restore();
  }
});

test('shared billing middleware normalizes a missing account to null and unavailable=true', async () => {
  const harness = loadMiddlewareWithStub(async () => null);

  try {
    const req = { auth: { resellerId: 42 } };
    const res = response();
    await harness.loadResellerBillingAccount(req, res, () => {});

    assert.equal(req.billingAccount, null);
    assert.equal(req.billingAccountUnavailable, true);
    assert.equal(res.locals.billingAccount, null);
    assert.equal(res.locals.billingAccountUnavailable, true);
  } finally {
    harness.restore();
  }
});

test('shared billing middleware exposes unavailable locals and logs diagnostics on loader failure', async () => {
  const failure = Object.assign(new Error('billing store unavailable'), { code: 'BILLING_STORE_DOWN' });
  const harness = loadMiddlewareWithStub(async () => { throw failure; });
  const originalError = console.error;
  const diagnostics = [];
  console.error = (...args) => diagnostics.push(args);

  try {
    const req = { auth: { resellerId: 42 } };
    const res = response();
    let nextCalls = 0;
    await harness.loadResellerBillingAccount(req, res, () => { nextCalls += 1; });

    assert.equal(req.billingAccount, null);
    assert.equal(req.billingAccountUnavailable, true);
    assert.equal(res.locals.billingAccount, null);
    assert.equal(res.locals.billingAccountUnavailable, true);
    assert.equal(nextCalls, 1);
    assert.equal(diagnostics.length, 1);
    assert.equal(diagnostics[0][1].code, 'BILLING_STORE_DOWN');
  } finally {
    harness.restore();
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
    const routeStart = server.indexOf('app.get("' + routePath + '"');
    assert.notEqual(routeStart, -1, 'expected route registration for ' + routePath);
    const routeEnd = server.indexOf(';', routeStart);
    const routeDefinition = server.slice(routeStart, routeEnd === -1 ? server.length : routeEnd);
    assert.ok(routeDefinition.includes('loadResellerBillingAccount'),
      routePath + ' must load billing locals before its handler');
  }

  assert.ok(server.includes('app.get("/reseller/login"'), 'public reseller login remains outside the billing loader');
  assert.ok(server.includes('app.get("/reseller/accept-invite"'), 'public reseller invite acceptance remains outside the billing loader');
});

test('dashboard controller passes both normalized billing locals to its view', () => {
  const controller = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'resellerPortalController.js'), 'utf8');
  assert.ok(controller.includes('billingAccountUnavailable: !billingAccount'));
});
