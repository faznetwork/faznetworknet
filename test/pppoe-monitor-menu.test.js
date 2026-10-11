const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs');
const server = read('server.js');
const pppoeRoutes = read('routes/pppoeRoutes.js');

test('Monitor Usage and Online have distinct direct routes and restore the correct mode', () => {
  assert.ok(adminView.includes("'/admin/monitor/usage': { view: 'monitor', mode: 'usage' }"));
  assert.ok(adminView.includes("'/admin/monitor/online': { view: 'monitor', mode: 'online' }"));
  assert.ok(adminView.includes("case 'monitor': return callIfAvailable('loadNetworkMonitor', [r.mode || 'online']);"));
  assert.ok(adminView.includes("case 'loadNetworkMonitor': return { view: 'monitor'"));
});

test('Monitor pages are admin-only and use the existing active-session API', () => {
  assert.ok(server.includes('app.get(/^\\/admin\\/monitor\\/(usage|online)\\/?$/,requireRole(["super_admin","admin"])'));
  assert.ok(pppoeRoutes.includes('router.get("/active",requireRole(["super_admin","admin"]),controller.active)'));
  assert.ok(adminView.includes("window.jsonFetch('/api/pppoe/active')"));
});

test('Usage counters are labelled as current session data and the tables are responsive', () => {
  assert.ok(adminView.includes('Current active-session byte counters only; these are not lifetime billing totals.'));
  assert.ok(adminView.includes('class="table-responsive border rounded-3"'));
  assert.ok(adminView.includes('Recent snapshot · fallback'));
  assert.ok(adminView.includes("data.source === 'mikrotik-live' ? 'MikroTik live'"));
});
