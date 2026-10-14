const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs');
const server = read('server.js');
const routes = read('routes/adminUserRoutes.js');

test('Staff Management and Sub-Staff restore separate canonical paths', () => {
  assert.ok(adminView.includes("'/admin/staff': { view: 'staff' }"));
  assert.ok(adminView.includes("'/admin/resellers/sub-staff': { view: 'sub-staff' }"));
  assert.ok(adminView.includes("case 'sub-staff': return callIfAvailable('loadStaffManagement', ['sub-staff']);"));
  assert.ok(adminView.includes("case 'loadStaffManagement': return { view: String(args[0] || 'all') === 'sub-staff' ? 'sub-staff' : String(args[0] || 'all') === 'account-manage' ? 'account-manage' : 'staff' };"));
});

test('Staff pages are admin-only and use the existing invitation/account APIs', () => {
  assert.ok(server.includes('app.get(/^\\/admin\\/(staff|resellers\\/sub-staff)\\/?$/,requireRole(["super_admin","admin"])'));
  assert.ok(routes.includes("router.get('/', controller.listUsers)"));
  assert.ok(routes.includes("router.post('/', controller.createUser)"));
  assert.ok(routes.includes("router.get('/invitations', controller.listInvitations)"));
  assert.ok(routes.includes("router.patch('/:id/status', controller.updateUserStatus)"));
  assert.ok(adminView.includes("if (currentStaffMode === 'sub-staff') invitations = invitations.filter(item => item.role === 'staff');"));
  // The existing UI uses the shared invitations endpoint and filters staff-role invitations client-side.
  assert.ok(routes.includes("router.post('/', controller.createUser)"));
  assert.ok(adminView.includes("window.jsonFetch('/api/admin/users/invitations')"));
});

test('Sub-Staff only shows staff-role accounts and keeps the form/table responsive', () => {
  assert.ok(adminView.includes("if (currentStaffMode === 'sub-staff') users = users.filter(user => user.role === 'staff');"));
  assert.ok(adminView.includes("role:currentStaffMode === 'sub-staff' || !currentAdminCanInvitePrivileged ? 'staff'"));
  assert.ok(adminView.includes('class="card-body p-0 table-responsive"'));
  assert.ok(adminView.includes('id="rbacStaffHeading"'));
});
