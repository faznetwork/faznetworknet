const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs');
const server = read('server.js');

test('Account dashboard and manage paths restore distinct functional views', () => {
  assert.ok(adminView.includes("'/admin/account/dashboard': { view: 'account-dashboard' }"));
  assert.ok(adminView.includes("'/admin/account/manage': { view: 'account-manage' }"));
  assert.ok(adminView.includes("case 'account-dashboard': return callIfAvailable('loadAccountDashboard');"));
  assert.ok(adminView.includes("case 'account-manage': return callIfAvailable('loadStaffManagement', ['account-manage']);"));
  assert.ok(adminView.includes("window.loadAccountDashboard = async function()"));
});

test('Account pages require admin roles and use existing account/support APIs', () => {
  assert.ok(server.includes('app.get(/^\\/admin\\/account\\/(dashboard|manage)\\/?$/,requireRole(["super_admin","admin"])'));
  assert.ok(adminView.includes("window.jsonFetch('/api/admin/users')"));
  assert.ok(adminView.includes("window.jsonFetch('/api/admin/users/invitations')"));
  assert.ok(adminView.includes("window.jsonFetch('/api/admin/security/tickets?category=all')"));
});

test('Account dashboard cards and tables use responsive layout without replacing static views', () => {
  assert.ok(adminView.includes('Accounts visible'));
  assert.ok(adminView.includes('Open support tickets'));
  assert.ok(adminView.includes('class="col-12 col-sm-6 col-xl-3"'));
  assert.ok(adminView.includes("root.id = 'fazDynamicModuleRoot'"));
  assert.ok(adminView.includes('class="table-responsive"'));
});
