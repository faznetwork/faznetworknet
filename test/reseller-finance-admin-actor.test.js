'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('verified legacy admin sessions without numeric userId retain an optional audit actor', () => {
  const rbac = read('middleware/rbac.js');
  const controller = read('controllers/resellerFinanceController.js');
  const service = read('services/resellerFinanceService.js');
  assert.match(rbac, /!req\.session\?\.isAdmin/);
  assert.match(controller, /req\.auth\?\.userId\?\?req\.session\?\.userId\?\?null/);
  assert.match(service, /if \(value === null \|\| value === undefined \|\| String\(value\)\.trim\(\) === ''\) return null/);
  assert.match(service, /billing_account_id,reseller_id,idempotency_key,amount,currency,payment_method,external_reference,status,received_at,actor_user_id,notes/);
  assert.match(service, /description,actor_user_id\)/);
});

test('finance service validates any supplied actor and retains all three guarded operations', () => {
  const service = read('services/resellerFinanceService.js');
  assert.match(service, /return positiveId\(value, 'authenticated admin actor'\)/);
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
