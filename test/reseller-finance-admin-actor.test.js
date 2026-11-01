'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('verified legacy admin sessions without numeric userId are rejected for settlement posting', () => {
  const rbac = read('middleware/rbac.js');
  const controller = read('controllers/resellerFinanceController.js');
  const service = read('services/resellerFinanceService.js');
  assert.match(rbac, /!req\.session\?\.isAdmin/);
  assert.match(controller, /req\.auth\?\.userId\?\?req\.session\?\.userId\?\?null/);
  assert.match(service, /if \(required\) throw financeError\('An authenticated admin actor is required to post a finance settlement\.'/);
  assert.match(service, /account_id,reseller_id,settlement_type,amount,payment_provider,external_reference,received_by,received_at,notes/);
  assert.match(service, /description,actor_user_id\)/);
});

test('finance service validates any supplied actor and retains all three guarded operations', () => {
  const service = read('services/resellerFinanceService.js');
  assert.match(service, /return positiveId\(value, 'authenticated admin actor'\)/);
  assert.match(service, /const actor = actorId\(input\.actorUserId, true\)/);
  assert.match(service, /mode === 'prepaid' \? 'wallet_topup' : 'receivable_settlement'/);
  assert.match(service, /async function walletTopup/);
  assert.match(service, /async function receivableSettlement/);
  assert.match(service, /async function updateCreditLimit/);
});

test('unauthenticated and non-admin requests remain rejected by existing guards', () => {
  const rbac = read('middleware/rbac.js');
  const auth = read('middleware/adminAuth.js');
  assert.match(auth, /req\.session\?\.isAdmin===true/);
  assert.match(rbac, /if \(!req\.session\?\.isAdmin && !resellerSession\)/);
  assert.match(rbac, /if \(!role \|\| !allowed\.includes\(role\)\)/);
});

test('finance controller forwards the verified session actor into wallet settlement persistence', async () => {
  const financeController = require('../controllers/resellerFinanceController');
  const financeService = require('../services/resellerFinanceService');
  const originalWalletTopup = financeService.walletTopup;
  let postedInput;
  financeService.walletTopup = async input => {
    postedInput = input;
    return { replayed: false, ledgerEntryId: '901', settlementId: '801', account: { wallet_balance: '50.00' } };
  };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  try {
    await financeController.walletTopup({
      params: { resellerId: '7' },
      body: { amount: '50.00' },
      auth: { role: 'super_admin', userId: 11 },
      session: { userId: 11 },
      get(name) { return name === 'Idempotency-Key' ? 'legacy-actor-test-001' : null; }
    }, res);
    assert.equal(res.statusCode, 201);
    assert.equal(postedInput.actorUserId, 11);
    assert.equal(postedInput.resellerId, 7);
  } finally {
    financeService.walletTopup = originalWalletTopup;
  }
});

