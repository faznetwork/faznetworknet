const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminView = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin.ejs'), 'utf8');

const routedModules = [
  ['/admin/monitor/usage', 'usage'],
  ['/admin/monitor/online', 'monitor-online'],
  ['/admin/network/diagram', 'network-diagram'],
  ['/admin/vpn', 'vpn'],
  ['/admin/vpn/port-forwarding', 'vpn-port-forwarding'],
  ['/admin/account/dashboard', 'account-dashboard'],
  ['/admin/account/manage', 'account-manage'],
  ['/admin/support/software', 'software-support-tickets'],
  ['/admin/support/website', 'website-support-tickets'],
  ['/admin/expenses/add', 'expenses-add'],
  ['/admin/expenses/all', 'expenses-all'],
  ['/admin/expenses/report', 'expenses-report'],
  ['/admin/hr/departments', 'hr-departments'],
  ['/admin/hr/employees', 'hr-employees'],
  ['/admin/hr/employees/added', 'hr-added-employees'],
  ['/admin/resellers/sub-staff', 'sub-staff']
];

test('every previously inert admin menu item has a canonical href and route mapping', () => {
  for (const [url, moduleKey] of routedModules) {
    assert.ok(adminView.includes(`href="${url}"`), `menu link missing for ${url}`);
    assert.ok(
      adminView.includes(`'${url}': { view: 'module', module: '${moduleKey}' }`),
      `route map missing for ${url}`
    );
    assert.ok(
      adminView.includes(`'${moduleKey}': '`),
      `module title missing for ${moduleKey}`
    );
  }
});

test('unimplemented modules are clearly labelled and do not pretend to save data', () => {
  assert.ok(adminView.includes('এই মডিউলটি এখনো কার্যকরভাবে তৈরি হয়নি।'));
  assert.ok(adminView.includes('save/edit functionality'));
  assert.ok(adminView.includes('function showAdminModulePlaceholder(moduleKey)'));
});

test('placeholder content uses responsive Bootstrap spacing and returns to admin dashboard', () => {
  assert.ok(adminView.includes('class="admin-view p-2 p-md-3"'));
  assert.ok(adminView.includes('class="card-body p-3 p-md-5"'));
  assert.ok(adminView.includes('href="/admin/dashboard" class="btn btn-success"'));
});
