const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const admin = read('views/admin.ejs');
const main = read('public/js/main.js');
const server = read('server.js');

test('Hotspot dashboard switches to the canonical view and starts its data refresh immediately', () => {
  const start = admin.indexOf('async function loadHotspotDashboard(){');
  assert.notEqual(start, -1, 'Hotspot dashboard loader exists');
  const end = admin.indexOf('window.loadHotspotDashboard = loadHotspotDashboard;', start);
  const loader = admin.slice(start, end);
  assert.match(loader, /currentHotspotMode = 'dashboard'/);
  assert.match(loader, /switchView\('hotspot-dashboard'\)/);
  assert.match(loader, /refreshHotspotDashboardMetrics\(\)/);
  assert.match(loader, /return true/);
});

test('switchView does not silently fall back to the main dashboard for an invalid target', () => {
  assert.match(admin, /const target = viewName === 'dashboard' \? 'view-main-dashboard'/);
  assert.match(admin, /if \(!target \|\| !document\.getElementById\(target\)\)/);
  assert.match(admin, /Refusing to replace the current view with an unknown target/);
  assert.match(admin, /if \(target === 'view-main-dashboard'\)/);
});

test('all settings sections resolve to an existing panel; legacy webhooks URL aliases Payment & Webhooks', () => {
  assert.match(admin, /const validTargets = \['brand', 'billing', 'payments', 'sms', 'hotspot-portal'\]/);
  assert.match(admin, /section === 'webhooks' \? 'payments'/);
  assert.match(admin, /'\/admin\/settings\/webhooks': \{ view: 'settings', section: 'webhooks' \}/);
  assert.match(admin, /'\/admin\/settings\/webhooks': \{ view: 'settings', section: 'webhooks' \}/);
  assert.match(main, /__fazNavigateAdminRoute\(\{ view: 'settings', section: target \}\)/);
  assert.doesNotMatch(main, /window\.addEventListener\('popstate'/);
  assert.match(admin, /window\.addEventListener\('popstate', function\(\)/);
});

test('initial routing and history restoration share one awaited route dispatcher', () => {
  assert.match(admin, /async function restoreRoute\(route, replace\)/);
  assert.match(admin, /return await dispatchRoute\(normalized\)/);
  assert.match(admin, /window\.__fazNavigateAdminRoute = function\(route\)/);
  assert.doesNotMatch(admin, /initializeGeneralSettingsRoute\(\);/);
  assert.match(admin, /result\.catch\(error => \{/);
});

test('unknown admin URLs render an explicit not-found state rather than the dashboard', () => {
  assert.match(admin, /return \{ view: 'not-found', path \}/);
  assert.match(admin, /case 'not-found': return showAdminRouteNotFound\(r\.path\)/);
  assert.match(admin, /function showAdminRouteNotFound\(path\)/);
  assert.match(admin, /if \(normalized\.view === 'not-found'\) return normalized\.path/);
});

test('Express settings routes cover the legacy webhooks path with super-admin authorization', () => {
  assert.match(server, /app\.get\(\/\^\\\/admin\\\/settings\\\/\(general\|brand-identity\|billing-expiry\|payment-webhooks\|sms-alerts\|hotspot-portal\|webhooks\)/);
  const duplicateMonitorRoutes = server.match(/app\.get\(\/\^\\\/admin\\\/monitor\\\/\(usage\|online\)/g) || [];
  assert.equal(duplicateMonitorRoutes.length, 1, 'monitor page route should be registered once');
});
