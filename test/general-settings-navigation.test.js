const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs');
const mainScript = read('public/js/main.js');
const portalScript = read('public/js/hotspot-portal-settings.js');
const serverSource = read('server.js');
const settingsRoutes = read('routes/settingsRoutes.js');
const webhookRoutes = read('routes/webhookSettingsRoutes.js');

const settingsPaths = [
  ['/admin/settings/brand-identity', 'brand'],
  ['/admin/settings/billing-expiry', 'billing'],
  ['/admin/settings/payment-webhooks', 'payments'],
  ['/admin/settings/sms-alerts', 'sms'],
  ['/admin/settings/hotspot-portal', 'hotspot-portal']
];

test('every General Settings sidebar link has a client target and an Express page route', () => {
  for (const [url, target] of settingsPaths) {
    assert.ok(adminView.includes(`href="${url}" data-settings-nav="${target}"`), `sidebar link missing for ${url}`);
    assert.ok(adminView.includes(`'${url}': { view: 'settings', section: '${target}' }`), `SPA route missing for ${url}`);
  }
  assert.ok(serverSource.includes('hotspot-portal'), 'shared settings route must include the Hotspot portal');
  assert.ok(!serverSource.includes('hotspot-portal|webhooks'), 'legacy Webhooks page route must be removed');
  assert.ok(!adminView.includes('data-settings-nav="webhooks"'), 'legacy Webhooks sidebar link must be removed');
  assert.ok(!mainScript.includes('/admin/settings/webhooks'), 'legacy Webhooks client route must be removed');
  assert.ok(serverSource.includes('renderAdminSettingsPage'), 'shared settings page renderer must exist');
});

test('settings submenu click and browser history keep route, panel, and active item synchronized', () => {
  assert.match(mainScript, /const validTargets = new Set\(\['brand', 'billing', 'payments', 'sms', 'hotspot-portal'\]\)/);
  assert.match(adminView, /window\.history\.pushState/);
  assert.match(adminView, /addEventListener\('popstate'/);
  assert.match(adminView, /function restoreRoute\(/);
  assert.match(adminView, /item\.dataset\.settingsNav === target/);
  assert.match(adminView, /function initializeGeneralSettingsRoute\(\)/);
  assert.match(adminView, /syncGeneralSettingsSidebar\(target\)/);
});

test('settings save forms submit asynchronously and have matching API handlers', () => {
  for (const id of ['systemBrandForm', 'systemBillingForm', 'systemSmsForm', 'webhookApiSettingsForm', 'hotspotPortalSettingsForm']) {
    assert.ok(adminView.includes(`id="${id}"`), `settings form missing: ${id}`);
  }
  assert.match(adminView, /function saveSystemSettings\(payload,buttonId,resultId\)/);
  assert.match(adminView, /generalSettingsPost\('\/api\/settings\/update'/);
  assert.match(adminView, /fetch\('\/api\/admin\/webhook-settings'/);
  assert.match(portalScript, /f\.addEventListener\('submit',save\)/);
  assert.match(portalScript, /req\(api,\{method:'PUT'/);
  assert.match(settingsRoutes, /router\.post\("\/update",controller\.updateSettings\)/);
  assert.match(webhookRoutes, /router\.put\("\/",controller\.save\)/);
});
