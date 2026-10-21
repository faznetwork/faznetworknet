const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const admin = read('views/admin.ejs');
const server = read('server.js');

function section(source, start, end) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, 'missing section start: ' + start);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, 'missing section end: ' + end);
  return source.slice(from, to);
}

test('switchView validates the destination before hiding the current page', () => {
  const code = section(admin, 'function switchView(viewName, channel = \'\')', 'window.switchView = switchView;');
  assert.match(code, /const targetElement = target \? document\.getElementById\(target\) : null/);
  assert.match(code, /if \(!targetElement\)\s*\{[\s\S]*?return false;/);
  assert.doesNotMatch(code, /: 'view-main-dashboard'\)\);/);
  assert.match(code, /if \(target === 'view-main-dashboard'\)/);
  assert.match(code, /if \(target === 'view-all-customer'/);
  assert.match(code, /target === 'view-payments'/);
  assert.match(code, /target === 'view-general-settings'/);
});

test('Hotspot dashboard sets its mode and loads metrics immediately', () => {
  const code = section(admin, 'async function loadHotspotDashboard()', 'window.loadHotspotDashboard = loadHotspotDashboard;');
  assert.match(code, /currentHotspotMode = 'dashboard'/);
  assert.match(code, /window\.switchView\('hotspot-dashboard'\)/);
  assert.match(code, /Promise\.allSettled\(/);
  assert.match(code, /refreshHotspotDashboardMetrics\(\)/);
  assert.match(code, /window\.refreshHotspotVoucherStats\(\)/);
  assert.match(code, /return true/);
});

test('async navigation failures are consumed and produce a retryable error view', () => {
  const code = section(admin, 'function renderNavigationFailure(name, error)', 'function routeForCall(name, args)');
  assert.match(code, /data-navigation-retry/);
  assert.match(code, /window\.__fazRestoreAdminRoute/);
  assert.match(code, /result\.catch\(error =>/);
  assert.match(code, /renderNavigationFailure\(name, error\)/);
});

test('every SPA route is explicitly accepted by the Express admin-shell allowlist', () => {
  const routes = section(admin, 'function routeFromPath(path)', 'function readRoute()');
  const routePaths = [...routes.matchAll(/'([^']+)'\s*:\s*\{/g)]
    .map(match => match[1])
    .filter(route => route.startsWith('/admin/') && route !== '/admin/settings');
  const allowlist = section(server, 'const supportedAdminPaths=new Set([', ']);');
  const serverPaths = new Set([...allowlist.matchAll(/"([^"]+)"/g)].map(match => match[1]));
  assert.deepEqual(routePaths.filter(route => !serverPaths.has(route)), [], 'SPA routes missing from Express allowlist');
  assert.match(server, /if\(!supportedAdminPaths\.has\(adminPath\)\) return next\(\)/);
});

test('legacy Webhooks URL resolves to the unified Payment & Webhooks settings panel', () => {
  const code = section(admin, 'if (route.view === \'settings\') {', 'if (route.view === \'customers\') {');
  assert.match(code, /requestedSection === 'webhooks' \? 'payments' : requestedSection/);
  assert.ok(server.includes('hotspot-portal|webhooks'), 'legacy Webhooks URL must remain authenticated');
});

test('Hotspot voucher and sales views use the shared view lifecycle', () => {
  const records = section(admin, 'window.loadHotspotVoucherRecords = async function(filter,title){', 'window.kickHotspotVoucher =');
  const sales = section(admin, 'window.loadHotspotVoucherSales = async function(){', 'let currentHotspotMode =');
  assert.match(records, /appendHotspotView\('/);
  assert.match(sales, /appendHotspotView\('/);
  assert.match(records, /currentHotspotMode = String\(filter \|\| 'all'\)/);
  assert.match(sales, /currentHotspotMode = 'sales'/);
});

test('Hotspot submenu routes stay active and the parent remains expanded', () => {
  const sidebar = section(admin, '<li class="menu-item">\n                <button class="dropdown-toggle" onclick="toggleSubmenu(event, this)">\n                    <i class="bi bi-wifi"></i>', '<li class="menu-item" data-rbac-roles="super_admin">');
  for (const route of [
    '/admin/hotspot/dashboard','/admin/hotspot/add-user','/admin/hotspot/users/all',
    '/admin/hotspot/users/active','/admin/hotspot/profiles','/admin/hotspot/vouchers/generate',
    '/admin/hotspot/vouchers/manage','/admin/hotspot/vouchers/cleanup','/admin/hotspot/sales'
  ]) assert.ok(sidebar.includes('data-admin-route="' + route + '"'), 'missing sidebar route: ' + route);
  assert.match(admin, /function syncAdminSidebarForRoute\(route\)/);
  assert.match(admin, /syncAdminSidebarForRoute\(normalized\)/);
});

test('duplicate Monitor Express route is removed', () => {
  const monitor = 'app.get(/^\\/admin\\/monitor\\/(usage|online)';
  assert.equal(server.split(monitor).length - 1, 1, 'Monitor route must be registered exactly once');
});
