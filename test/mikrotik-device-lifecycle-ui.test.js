'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs');
const routerRoutes = read('routes/routerDeviceRoutes.js');

const devicesStart = adminView.indexOf('window.loadDevices = loadDevices;');
const devicesEnd = adminView.indexOf('window.loadOltManagement =', devicesStart);
const devicesView = adminView.slice(devicesStart, devicesEnd);

test('MikroTik Devices renders an Active or Inactive state for every saved router', () => {
  assert.ok(devicesView.includes("const savedRouters = Array.isArray(routerResponse.devices) ? routerResponse.devices : [];"));
  assert.ok(devicesView.includes('text-bg-success\">Active</span>'));
  assert.ok(devicesView.includes('text-bg-secondary\">Inactive</span>'));
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
  assert.ok(adminView.includes('Its current Active / Inactive state was preserved.'));
  assert.ok(adminView.includes('saved successfully as Inactive. The live gateway was not changed.'));
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
