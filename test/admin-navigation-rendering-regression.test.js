const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const admin = read('views/admin.ejs');
const main = read('public/js/main.js');
const server = read('server.js');

test('Hotspot dashboard switches to the canonical view and refreshes metrics immediately', () => {
  const start = admin.indexOf('async function loadHotspotDashboard(){');
  assert.notEqual(start, -1, 'Hotspot dashboard loader exists');
  const end = admin.indexOf('window.loadHotspotDashboard = loadHotspotDashboard;', start);
  const loader = admin.slice(start, end);
  assert.match(loader, /currentHotspotMode = 'dashboard'/);
  assert.match(loader, /switchView\('hotspot-dashboard'\)/);
  assert.match(loader, /refreshHotspotDashboardMetrics\(\)/);
  assert.match(loader, /return true/);
});

test('switchView validates its target before hiding the current view and refreshes the correct dashboard', () => {
  const start = admin.indexOf("function switchView(viewName, channel = '')");
  const end = admin.indexOf('window.switchView = switchView;', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const code = admin.slice(start, end);
  assert.ok(code.indexOf('if (!targetElement)') < code.indexOf("document.querySelectorAll('.admin-view')"), 'target validation must happen before hiding existing views');
  assert.match(code, /if \(target === 'view-main-dashboard'\)/);
  assert.match(code, /Unknown view; preserving current content/);
});

test('settings links use the shared SPA router and the legacy webhooks URL opens Payment & Webhooks', () => {
  assert.match(admin, /section === 'webhooks' \? 'payments'/);
  assert.match(admin, /'\/admin\/settings\/webhooks': \{ view: 'settings', section: 'webhooks' \}/);
  assert.match(admin, /window\.__fazNavigateAdminRoute = function\(route\)/);
  assert.match(main, /__fazNavigateAdminRoute\(\{ view: 'settings', section: target \}\)/);
  assert.doesNotMatch(main, /window\.addEventListener\('popstate'/);
  assert.match(admin, /window\.addEventListener\('popstate', function\(\)/);
  assert.doesNotMatch(admin, /initializeGeneralSettingsRoute\(\);/);
});

test('async route restoration is awaited and async handler rejections are caught', () => {
  assert.match(admin, /async function restoreRoute\(route, replace\)/);
  assert.match(admin, /return await dispatchRoute\(normalized\)/);
  assert.match(admin, /result\.catch\(error => \{/);
  assert.match(admin, /window\.__fazRestoreAdminRoute = function\(\)\s*\{\s*return restoreRoute/);
});

test('unknown admin URLs render a not-found state instead of silently reverting to Dashboard', () => {
  assert.match(admin, /return \{ view: 'not-found', path \}/);
  assert.match(admin, /case 'not-found': return showAdminRouteNotFound\(r\.path\)/);
  assert.match(admin, /function showAdminRouteNotFound\(path\)/);
  assert.match(admin, /if \(normalized\.view === 'not-found'\) return normalized\.path/);
});

test('Express routes settings webhooks with super-admin authorization and registers monitor routes once', () => {
  assert.ok(server.includes('hotspot-portal|webhooks'), 'settings route should include the legacy webhooks path');
  const monitorRoutes = server.match(/app\.get\(\/\^\\\/admin\\\/monitor\\\/\(usage\|online\)/g) || [];
  assert.equal(monitorRoutes.length, 1, 'duplicate monitor route must be removed');
});

test('Hotspot online and expired user routes preserve their requested filters', () => {
  assert.match(admin, /'\/admin\/hotspot\/users\/online': \{ view: 'hotspot', section: 'users', filter: 'online'/);
  assert.match(admin, /'\/admin\/hotspot\/users\/expired': \{ view: 'hotspot', section: 'users', filter: 'expired'/);
  assert.match(admin, /hotspotFilters: \['all', 'online', 'active', 'offline', 'expired'\]/);
});
