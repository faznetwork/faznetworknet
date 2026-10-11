const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminView = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin.ejs'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const reportsView = fs.readFileSync(path.join(__dirname, '..', 'views', 'reports.ejs'), 'utf8');

const routedModules = [
  ['/admin/monitor/usage', 'usage'],
  ['/admin/monitor/online', 'monitor-online'],
  ['/admin/network/diagram', 'network-diagram'],
  ['/admin/vpn', 'vpn'],
  ['/admin/vpn/port-forwarding', 'vpn-port-forwarding'],
  ['/admin/account/dashboard', 'account-dashboard'],
  ['/admin/account/manage', 'account-manage'],
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
  assert.ok(adminView.includes("root.innerHTML = `"));
  assert.ok(adminView.includes('<section class="p-2 p-md-3">'));
  assert.ok(adminView.includes('class="card-body p-3 p-md-5"'));
  assert.ok(adminView.includes('href="/admin/dashboard" class="btn btn-success"'));
});

test('expense submenu URLs use the existing functional expense ledger and CRUD endpoints', () => {
  for (const url of ['/admin/expenses/add', '/admin/expenses/all', '/admin/expenses/report']) {
    assert.ok(adminView.includes(`href="${url}"`), `expense menu link missing for ${url}`);
    assert.ok(serverSource.includes('app.get(/^\\/admin\\/expenses\\/(add|all|report)\\/?$/'), 'authenticated expense page route missing');
  }
  assert.ok(reportsView.includes("const routeKind=location.pathname.split('/').pop();const kind=['add','all','report'].includes(routeKind)?'expenses':routeKind;"));
  assert.ok(reportsView.includes("load().then(()=>{if(routeKind==='add')openExpense()});"));
  assert.ok(reportsView.includes("api('/api/reports/expenses'+(id?'/'+id:''),{method:id?'PUT':'POST'"));
});
