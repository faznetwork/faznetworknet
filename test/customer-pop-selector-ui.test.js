'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const adminView = fs.readFileSync(path.join(root, 'views/admin.ejs'), 'utf8');
const customerRoutes = fs.readFileSync(path.join(root, 'routes/customerRoutes.js'), 'utf8');

test('shared customer form exposes a POP selector and locked reseller assignment view', () => {
  assert.match(adminView, /id="addCustomerForm"/);
  assert.match(adminView, /id="customerPopSelect"/);
  assert.match(adminView, /id="customerPopLockedLabel"/);
  assert.match(adminView, /id="customerEditFormModalBody"/);
  assert.match(adminView, /function ensureCustomerEditFormModal\(\)/);
  assert.match(adminView, /body\.appendChild\(form\)/);
  assert.match(adminView, /origin\.parent\.insertBefore\(f,/);
});

test('POP options are loaded through the existing role-scoped endpoint with visible retry fallback', () => {
  assert.match(adminView, /fetch\('\/api\/pops\/options'/);
  assert.match(adminView, /id="customerPopRetry"/);
  assert.match(adminView, /customerPopOptionsPromise = null/);
  assert.match(adminView, /customer form remains available/);
  assert.match(adminView, /canonical FAZ Main \(Direct\) default/);
});

test('administrator selector defaults Direct POP and preselects existing customer POP', () => {
  assert.match(adminView, /faz main \(direct\)/);
  assert.match(adminView, /renderCustomerPopOptions\(customer\.pop_id, true\)/);
  assert.match(adminView, /customerPopSearch/);
});

test('reseller update payload cannot contain pop_id', () => {
  assert.match(adminView, /const isCustomerAdmin = \['super_admin', 'admin'\]\.includes\(customerActorRole\)/);
  assert.match(adminView, /\.\.\.\(isCustomerAdmin && String\(valueOf\('customerPopSelect'\)\)\.trim\(\) \? \{ pop_id: String\(valueOf\('customerPopSelect'\)\)\.trim\(\) \} : \{\}\)/);
  assert.match(adminView, /Assigned POP.*Locked/);
});

test('customer creation route protection remains unchanged', () => {
  assert.match(customerRoutes, /router\.post\('\/',\s*requireAdminOnly,\s*controller\.createCustomer\)/);
});
