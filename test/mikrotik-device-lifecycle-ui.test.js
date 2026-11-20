'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs').replace(/\r\n/g, '\n');
const routerRoutes = read('routes/routerDeviceRoutes.js');

const devicesStart = adminView.indexOf('window.loadDevices = loadDevices;');
const devicesEnd = adminView.indexOf('window.loadOltManagement =', devicesStart);
const devicesView = adminView.slice(devicesStart, devicesEnd);

test('MikroTik Devices renders Primary / Standby roles and a connection status for every saved router', () => {
  assert.ok(devicesView.includes("const savedRouters = Array.isArray(routerResponse.devices) ? routerResponse.devices : [];"));
  assert.ok(devicesView.includes('Primary</span>'));
  assert.ok(devicesView.includes('Standby</span>'));
  assert.ok(devicesView.includes('data-router-status'));
  assert.ok(devicesView.includes("savedRouters.map(router =>"));
});

test('inactive routers can be activated with confirmation and a visible pending state', () => {
  assert.ok(devicesView.includes("data-router-activate"));
  assert.ok(devicesView.includes("Are you sure you want to switch the active MikroTik gateway?"));
  assert.ok(devicesView.includes("'/api/mikrotik/devices/' + encodeURIComponent(target.id) + '/activate'"));
  assert.ok(devicesView.includes("spinner-border spinner-border-sm me-1"));
  assert.ok(devicesView.includes("if (!response.ok || body.success !== true)"));
  assert.ok(!devicesView.includes("router-deactivate"));
  assert.ok(!devicesView.includes("'/deactivate'"));
});

test('saved routers can be edited through the existing lifecycle API without UI activation side effects', () => {
  assert.ok(devicesView.includes('data-router-edit'));
  assert.ok(devicesView.includes("form.dataset.routerId = String(router.id)"));
  assert.ok(devicesView.includes("dispatchEvent(new Event('input', { bubbles: true }))"));
  assert.ok(adminView.includes("method:editing?'PUT':'POST'"));
  assert.ok(adminView.includes("'/api/mikrotik/devices/'+encodeURIComponent(routerId)"));
  assert.ok(adminView.includes('verification_token:testedVerificationToken'), 'save must reuse its passed connection verification');
  assert.ok(adminView.includes('Its current Active / Inactive state was preserved.'));
  assert.ok(adminView.includes('saved successfully as Inactive. The live gateway was not changed.'));
});

test('gateway summary cards appear above the saved router table', () => {
  const summaryAt = devicesView.indexOf('aria-label="MikroTik gateway summary"');
  const tableAt = devicesView.indexOf('IP &amp; API Port');
  assert.ok(summaryAt >= 0 && tableAt > summaryAt, 'gateway counters should sit above the table');
  assert.ok(devicesView.includes('Saved routers'));
  assert.ok(devicesView.includes('Active gateway'));
  assert.ok(devicesView.includes('Standby routers'));
});

test('MikroTik Management displays only the authoritative saved-gateway list', () => {
  assert.ok(devicesView.includes("jsonFetch('/api/mikrotik/devices')"));
  assert.ok(!devicesView.includes("jsonFetch('/api/devices')"));
  assert.ok(!devicesView.includes('Registered Network Inventory'));
  assert.ok(!devicesView.includes('inventoryRouters'));
  assert.ok(!devicesView.includes('MikroTik Inventory'));
});

test('the lifecycle endpoints remain registered on the existing MikroTik router', () => {
  assert.ok(routerRoutes.includes("router.post('/devices/:id/activate', controller.activateDevice);"));
  assert.ok(routerRoutes.includes("router.post('/devices/:id/deactivate', controller.deactivateDevice);"));
});

test('the complete devices view and router modal scripts parse as JavaScript', () => {
  assert.doesNotThrow(() => new vm.Script(devicesView));
  const modalStart = adminView.indexOf("<script>\n    (function(){\n      const form=document.getElementById('mikrotikAddRouterForm');");
  const modalEnd = adminView.indexOf('</script>', modalStart);
  assert.ok(modalStart >= 0 && modalEnd > modalStart, 'router modal script boundaries must exist');
  const modalScript = adminView.slice(modalStart + '<script>'.length, modalEnd);
  assert.doesNotThrow(() => new vm.Script(modalScript));
});

test('MikroTik Management does not expose or invoke the deprecated cloud-incompatible discovery endpoint', () => {
  assert.ok(!devicesView.includes('Discover MikroTik Ports'));
  assert.ok(!devicesView.includes('devicesDiscoverBtn'));
  assert.ok(!devicesView.includes('devicesDiscoveryResult'));
  assert.ok(!devicesView.includes('/api/devices/mikrotik/discover'));
});

test('MikroTik rows expose test, activate, edit, and safe delete actions with clear role and status labels', () => {
  assert.ok(devicesView.includes('data-router-test'));
  assert.ok(devicesView.includes('data-router-activate'));
  assert.ok(devicesView.includes('data-router-edit'));
  assert.ok(devicesView.includes('data-router-delete'));
  assert.ok(devicesView.includes("'/api/mikrotik/devices/' + encodeURIComponent(router.id) + '/test-connection'"));
  assert.ok(devicesView.includes("method: 'DELETE'"));
  assert.ok(devicesView.includes('window.confirm('));
  assert.ok(devicesView.includes('Primary'));
  assert.ok(devicesView.includes('Standby'));
  assert.ok(devicesView.includes('Last check: Online'));
  assert.ok(devicesView.includes('aria-busy'));
  assert.ok(routerRoutes.includes("router.post('/devices/:id/test-connection', controller.testSavedDevice);"));
  assert.ok(routerRoutes.includes("router.delete('/devices/:id', controller.deleteDevice);"));
});

test('dashboard PPPoE and traffic polling requires a verified gateway and dashboard route', () => {
  const dashboardStart = adminView.indexOf('async function refreshDashboard()');
  const dashboardEnd = adminView.indexOf('async function loadRouterMetrics()', dashboardStart);
  const dashboardCode = adminView.slice(dashboardStart, dashboardEnd);
  const verifyAt = dashboardCode.indexOf('await ensureActiveGatewayVerified()');
  const pppoeAt = dashboardCode.indexOf("jsonFetch('/api/pppoe/users'");
  assert.ok(dashboardCode.includes('isAdminDashboardRoute()'));
  assert.ok(verifyAt >= 0 && pppoeAt > verifyAt, 'gateway must be verified before PPPoE fetches');
  assert.ok(dashboardCode.includes('if (gatewayVerified)'));
  const trafficStart = adminView.indexOf('async function pollTraffic()');
  const trafficEnd = adminView.indexOf('function startTrafficPolling()', trafficStart);
  const trafficCode = adminView.slice(trafficStart, trafficEnd);
  assert.ok(trafficCode.includes('await ensureActiveGatewayVerified()'));
  assert.ok(trafficCode.includes('silent: true'));
});

test('MikroTik modal moves focus out before Bootstrap hides it', () => {
  const modalStart = adminView.indexOf("const modalElement=$('mikrotikAddRouterModal');");
  const modalEnd = adminView.indexOf("let testedFingerprint=", modalStart);
  const modalCode = adminView.slice(modalStart, modalEnd);
  assert.ok(modalCode.includes("addEventListener('hide.bs.modal'"));
  assert.ok(modalCode.includes('modalElement.contains(document.activeElement)'));
  assert.ok(modalCode.includes('document.activeElement.blur()'));
});

test('manual RouterOS connection checks use a bounded request timeout', () => {
  assert.ok(adminView.includes('requestController=new AbortController()'));
  assert.ok(adminView.includes('setTimeout(()=>requestController.abort(),15000)'));
  assert.ok(adminView.includes("status==='unreachable'") || adminView.includes("body.status==='unreachable'"));
});
