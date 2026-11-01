'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const adminView = fs.readFileSync(path.join(root, 'views/admin.ejs'), 'utf8');
const customerProfileView = fs.readFileSync(path.join(root, 'views/customer-profile.ejs'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
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

test('administrator role normalization recognizes all supported spellings', () => {
  assert.ok(adminView.includes(".replace(/[\\s-]+/g, '_');"));
  const normalizeRole = role => String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  for (const role of ['admin', 'super_admin', 'super admin', 'super-admin']) {
    assert.ok(['admin', 'super_admin'].includes(normalizeRole(role)), role + ' must be recognized');
  }
});

test('administrator Add Customer selector offers reseller POPs without exposing the core/direct POP', () => {
  assert.match(adminView, /id="customerPopAdminControls"/);
  assert.match(adminView, /fetch\('\/api\/pops\/options'/);
  assert.match(adminView, /Choose a reseller-owned POP to assign this customer/);
  assert.match(adminView, /leave the selection empty to use the core\/direct default/i);
  assert.doesNotMatch(adminView, /toLowerCase\(\) === 'faz main \(direct\)'/);
  assert.match(adminView, /loadCustomerPopOptions\('', false\)/);
  assert.match(adminView, /adminControls\?\.classList\.remove\('d-none'\)/);
});

test('shared customer edit omits unchanged POP and reseller payloads omit pop_id', () => {
  assert.match(adminView, /const isCustomerAdmin = \['super_admin', 'admin'\]\.includes\(customerActorRole\)/);
  assert.match(adminView, /!editId \|\| String\(valueOf\('customerPopSelect'\)\)\.trim\(\) !== String\(document\.getElementById\('customerPopSelect'\)\?\.dataset\.initialValue \|\| ''\)\.trim\(\)/);
  assert.match(adminView, /\.\.\.\(isCustomerAdmin && String\(valueOf\('customerPopSelect'\)\)\.trim\(\)/);
});

test('Customer 360 Edit Info modal renders POP assignment immediately after Area / Zone', () => {
  assert.match(customerProfileView, /id="eArea"/);
  assert.match(customerProfileView, /id="ePopAssignment"/);
  assert.match(customerProfileView, /id="ePop"/);
  assert.ok(customerProfileView.indexOf('id="eArea"') < customerProfileView.indexOf('id="ePopAssignment"'));
  assert.match(customerProfileView, /id="ePopResellerView"/);
  assert.match(customerProfileView, /id="ePopLocked"/);
});

test('Customer 360 administrators load active POPs and preselect the current pop_id', () => {
  assert.ok(customerProfileView.includes("fetch('/api/pops/options'"));
  assert.match(customerProfileView, /currentPopId=customer\?\.pop_id==null\?'':String\(customer\.pop_id\)/);
  assert.match(customerProfileView, /select\.dataset\.initialValue=currentPopId/);
  assert.match(customerProfileView, /api\('\/api\/customers\/customers\/'\+encodeURIComponent\(id\)\)/);
  assert.match(customerProfileView, /await loadCustomerPopOptions\(\{\.\.\.c,pop_id:popRecord\?\.customer\?\.pop_id\?\?''\}\);open\('editModal'\)/);
  assert.match(server, /currentRole:req\.session\.role\|\|\(req\.session\.legacySuperAdmin/);
  assert.match(customerProfileView, /data-user-role="<%= currentRole \|\| 'staff' %>"/);
});

test('Customer 360 update only sends a changed active pop_id for administrators', () => {
  assert.match(customerProfileView, /delete payload\.pop_id/);
  assert.match(customerProfileView, /if\(isCustomerAdmin&&selectedPopId&&selectedPopId!==initialPopId&&activePopOptions\.some\(pop=>String\(pop\.id\)===selectedPopId\)\)payload\.pop_id=selectedPopId/);
  assert.ok(customerProfileView.includes("await api('/api/customers/'+id,{method:'PUT'"));
});

test('customer creation route protection remains unchanged', () => {
  assert.ok(customerRoutes.includes("router.post('/',requireAdminOnly,controller.createCustomer)"));
});
