const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs');
const server = read('server.js');
const service = read('services/mikrotikService.js');
const controller = read('controllers/routerController.js');
const routes = read('routes/routerRoutes.js');

test('VPN and port-forwarding menus restore separate canonical read-only views', () => {
  assert.ok(adminView.includes("'/admin/vpn': { view: 'vpn' }"));
  assert.ok(adminView.includes("'/admin/vpn/port-forwarding': { view: 'vpn-port-forwarding' }"));
  assert.ok(adminView.includes("case 'vpn': return callIfAvailable('loadVpnModule');"));
  assert.ok(adminView.includes("case 'vpn-port-forwarding': return callIfAvailable('loadPortForwarding');"));
});

test('VPN pages are super-admin-only and reuse router APIs', () => {
  assert.ok(server.includes('app.get(/^\\/admin\\/vpn(?:\\/port-forwarding)?\\/?$/,requireRole(["super_admin"])'));
  assert.ok(routes.includes('router.get("/vpn", routerController.vpn)'));
  assert.ok(routes.includes('router.get("/port-forwarding", routerController.portForwarding)'));
  assert.ok(controller.includes('mikrotikService.getVpnInventory()'));
  assert.ok(controller.includes('mikrotikService.getPortForwardRules()'));
});

test('VPN inventory omits secrets and firewall UI is read-only and responsive', () => {
  assert.ok(service.includes('async getVpnInventory()'));
  assert.ok(service.includes('async getPortForwardRules()'));
  assert.ok(!service.includes('ipsec-secret'));
  assert.ok(!service.includes('private-key'));
  assert.ok(adminView.includes('Read-only for production safety.'));
  assert.ok(adminView.includes('Read-only view. Creating or changing firewall rules'));
  assert.ok(adminView.includes('class="table-responsive border rounded-3"'));
  assert.ok(adminView.includes("window.jsonFetch('/api/router/port-forwarding')"));
});
