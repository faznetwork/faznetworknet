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

test('role normalization recognizes administrator role spellings', () => {
  assert.ok(adminView.includes(".replace(/[\s-]+/g, '_');"));
  const normalizeRole = role => String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  for (const role of ['admin', 'super_admin', 'super admin', 'super-admin']) {
    assert.ok(['admin', 'super_admin'].includes(normalizeRole(role)), role + ' must be recognized');
  }
});

test('POP options use one shared role-scoped async loader and visible retry fallback', () => {
  assert.match(adminView, /async function ensureCustomerPopOptions\(\)/);
  assert.ok(adminView.includes("fetch('/api/pops/options'"));
  assert.match(adminView, /id="customerPopRetry"/);
  assert.match(adminView, /id="cpPopRetry"/);
  assert.match(adminView, /customerPopOptionsPromise = null/);
  assert.match(adminView, /FAZ Main \(Direct\) is selected when available/);
});

test('administrator selector defaults Direct POP and preselects existing customer POP', () => {
  assert.match(adminView, /faz main \(direct\)/);
  assert.match(adminView, /loadCustomerPopOptions\(customer\.pop_id, true\)/);
  assert.match(adminView, /select\.dataset\.initialValue = selected/);
});

test('Customer 360 POP field follows Area / Zone and uses role-scoped read-only reseller view', () => {
  assert.match(adminView, /id="cpAreaZone"/);
  assert.match(adminView, /id="cpPopAdminControls"/);
  assert.match(adminView, /id="cpPopSelect"/);
  assert.match(adminView, /id="cpPopResellerView"/);
  assert.match(adminView, /await loadCustomerHubPopOptions\(customer\)/);
  assert.match(adminView, /customer\.pop_id==null\?'':String\(customer\.pop_id\)/);
});

test('Customer 360 update only includes an explicitly changed active POP for administrators', () => {
  assert.match(adminView, /const popAssignmentChanged=isCustomerAdmin&&selectedPopId!==initialPopId&&customerPopOptions\.some\(pop=>String\(pop\.id\)===selectedPopId\)/);
  assert.match(adminView, /\.\.\.\(popAssignmentChanged\?\{pop_id:selectedPopId\}:\{\}\)/);
  assert.match(adminView, /areaZone:m\.querySelector\('#cpAreaZone'\)\.value\.trim\(\)/);
});

test('shared customer edit payload omits unchanged POP while customer creation can use the selected default', () => {
  assert.match(adminView, /!editId \|\| String\(valueOf\('customerPopSelect'\)\)\.trim\(\) !== String\(document\.getElementById\('customerPopSelect'\)\?\.dataset\.initialValue \|\| ''\)\.trim\(\)/);
  assert.match(adminView, /const isCustomerAdmin = \['super_admin', 'admin'\]\.includes\(customerActorRole\)/);
});

test('customer creation route protection remains unchanged', () => {
  assert.ok(customerRoutes.includes("router.post('/', requireAdminOnly, controller.createCustomer)"));
});
