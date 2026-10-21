const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const admin = read('views/admin.ejs');
const server = read('server.js');
const main = read('public/js/main.js');

test('static admin views are isolated from the dynamic page rendering target', () => {
  const staticStart = admin.indexOf('<div id="adminStaticViews">');
  const dynamicStart = admin.indexOf('<div id="dynamicPageContent" class="admin-dynamic-content"');
  assert.ok(staticStart >= 0, 'static admin view root must exist');
  assert.ok(dynamicStart > staticStart, 'dynamic render host must be a sibling after static views');
  const staticMarkup = admin.slice(staticStart, dynamicStart);
  for (const id of ['view-main-dashboard', 'view-hotspot-dashboard', 'view-general-settings', 'view-customer-filter']) {
    assert.ok(staticMarkup.includes(`id="${id}"`), `static view was moved out of the persistent root: ${id}`);
  }
  assert.equal((admin.match(/id="dynamicPageContent"/g) || []).length, 1, 'there must be one dedicated dynamic host');
  assert.ok(admin.includes("dynamic.innerHTML = html"), 'Hotspot renderer should write to the dedicated dynamic host');
});

test('Hotspot navigation keeps its dashboard DOM alive while rendering sub-pages', () => {
  assert.ok(admin.includes('id="view-hotspot-dashboard"'), 'Hotspot dashboard must remain in persistent static markup');
  assert.ok(admin.includes('function appendHotspotView(html)'), 'Hotspot dynamic renderer must exist');
  assert.ok(admin.includes("view.insertAdjacentHTML('afterbegin', hotspotSubnavMarkup())"), 'Hotspot subnav must live inside the view that gets hidden');
  assert.ok(admin.includes("window.loadHotspotDashboard = loadHotspotDashboard"), 'Hotspot dashboard entry point must remain available');
  assert.ok(admin.includes("case 'hotspot':"), 'router must dispatch Hotspot routes');
});

test('route wrapper catches rejected view-loader promises without redirecting to dashboard', () => {
  assert.ok(admin.includes("return result.catch(error =>"), 'asynchronous route errors must be handled centrally');
  assert.ok(admin.includes('showAdminNavigationError(error)'), 'route failures must provide visible feedback');
  assert.ok(admin.includes("if (path.startsWith('/admin/')) return { view: 'not-found', path };"), 'unknown admin paths must not silently become the dashboard');
  assert.ok(admin.includes("if (normalized.view === 'not-found') return normalized.path || '/admin';"), 'not-found URL must remain stable');
});

test('Express page routes cover Webhooks settings and avoid duplicate monitor registrations', () => {
  assert.ok(server.includes('hotspot-portal|webhooks'), 'Webhooks settings route must use the authenticated shared renderer');
  const monitorRoutes = server.match(/app\.get\(\/\^\\\/admin\\\/monitor\\\//g) || [];
  assert.equal(monitorRoutes.length, 1, 'monitor route should only be registered once');
});

test('settings navigation has one router owner and all General Settings links have route entries', () => {
  assert.ok(!main.includes('General Settings sidebar router'), 'main.js must not compete with the admin EJS route/history router');
  const routesStart = admin.indexOf('function routeFromPath');
  const routesEnd = admin.indexOf('function readRoute', routesStart);
  const routeMap = admin.slice(routesStart, routesEnd);
  for (const path of [
    '/admin/settings/brand-identity',
    '/admin/settings/billing-expiry',
    '/admin/settings/payment-webhooks',
    '/admin/settings/sms-alerts',
    '/admin/settings/hotspot-portal',
    '/admin/settings/webhooks'
  ]) {
    assert.ok(admin.includes(`href="${path}"`), `settings link missing: ${path}`);
    assert.ok(routeMap.includes(`'${path}'`), `settings client route missing: ${path}`);
  }
});
