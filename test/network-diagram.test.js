const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs');
const controller = read('controllers/networkMapController.js');
const routes = read('routes/networkMapRoutes.js');

test('Network Diagram has a direct path and restores its loader through browser routing', () => {
  assert.ok(adminView.includes("'/admin/network/diagram': { view: 'network-diagram' }"));
  assert.ok(adminView.includes("case 'network-diagram': return callIfAvailable('loadNetworkDiagram');"));
  assert.ok(adminView.includes("case 'loadNetworkDiagram': return { view: 'network-diagram' };"));
  assert.ok(adminView.includes("window.loadNetworkDiagram = async function()"));
});

test('network diagram reads only safe device and topology fields', () => {
  assert.ok(routes.includes('router.get("/diagram", controller.getDiagram)'));
  assert.ok(controller.includes('exports.getDiagram = async (req, res) =>'));
  assert.ok(controller.includes('FROM network_devices'));
  assert.ok(controller.includes('FROM network_topology_links'));
  assert.ok(!controller.includes('encrypted_management_password'));
  assert.ok(!controller.includes('management_username'));
});

test('network diagram UI is responsive and labels unverified links instead of guessing', () => {
  assert.ok(adminView.includes('class="col-12 col-md-6 col-xxl-4"'));
  assert.ok(adminView.includes('No topology relationships recorded yet. The diagram will not invent connections.'));
  assert.ok(adminView.includes('Device details only · no credentials exposed'));
  assert.ok(adminView.includes("root.id = 'fazDynamicModuleRoot'"));
});
