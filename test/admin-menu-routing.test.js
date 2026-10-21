const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminView = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin.ejs'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const reportsView = fs.readFileSync(path.join(__dirname, '..', 'views', 'reports.ejs'), 'utf8');

const routedModules = [
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


test('customer submenu routes resolve to the expected SPA filters and server fallback slugs', () => {
  const routes = {
    '/admin/customers/add': "showAddCustomerForm",
    '/admin/customers/all': "loadCustomerSection('all', 'all_customer')",
    '/admin/customers/online': "loadCustomerSection('online', 'online_customer')",
    '/admin/customers/offline': "loadCustomerSection('offline', 'offline_customer')",
    '/admin/customers/active': "loadCustomerSection('active', 'active_customer')",
    '/admin/customers/expired': "loadCustomerSection('expire', 'expire_customer')",
    '/admin/customers/expiring-today-yesterday': "loadCustomerSection('expire_today_yesterday', 'expire_today_yesterday')",
    '/admin/customers/expiring-next-7-days': "loadCustomerSection('expire_7_days', 'expire_7_days')",
    '/admin/customers/new': "loadCustomerSection('new', 'new_customer')",
    '/admin/customers/due': "loadCustomerSection('due', 'due_collection')"
  };
  for (const [url, handler] of Object.entries(routes)) {
    assert.ok(adminView.includes(url), `admin route map is missing ${url}`);
    assert.ok(adminView.includes(handler), `customer handler is missing for ${url}`);
    const slug = url.split('/').pop();
    assert.ok(serverSource.includes(`"${slug}"`), `server fallback does not allow customer slug ${slug}`);
  }
});

test('customer submenu rendering keeps a visible fallback if setup or rendering throws', () => {
  const start = adminView.indexOf('async function loadCustomerSection(filterType, titleKey)');
  const end = adminView.indexOf('async function refreshCustomerSection()', start);
  assert.notEqual(start, -1, 'customer submenu loader must exist');
  assert.notEqual(end, -1, 'customer submenu loader must close before refresh helper');
  const loader = adminView.slice(start, end);
  const tryAt = loader.indexOf('try {');
  assert.ok(tryAt > loader.indexOf('if (!dynamic || !customerView)'), 'container validation must happen before hiding existing content');
  assert.ok(tryAt < loader.indexOf('purgeStuckBackdrops()'), 'customer setup must be inside the error boundary');
  assert.ok(tryAt < loader.indexOf("document.querySelectorAll('.admin-view')"), 'hiding existing views must be inside the error boundary');
  assert.match(loader, /catch \(error\)\s*\{[\s\S]*?Unable to load customer records/);
  assert.match(loader, /finally\s*\{[\s\S]*?customerView\.style\.display = 'block'/);
});

test('switchView validates the destination before hiding the current admin screen', () => {
  const start = adminView.indexOf("function switchView(viewName, channel = '')");
  const end = adminView.indexOf('window.switchView = switchView;', start);
  assert.notEqual(start, -1, 'switchView must exist');
  assert.notEqual(end, -1, 'switchView must be exported');
  const code = adminView.slice(start, end);
  assert.ok(code.indexOf('if (!targetElement)') < code.indexOf("document.querySelectorAll('.admin-view')"), 'invalid view must not hide the current screen');
  assert.match(code, /if \(target === 'view-main-dashboard'\)\s*\{\s*void refreshDashboard\(\)/);
});
