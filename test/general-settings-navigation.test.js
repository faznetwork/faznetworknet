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
  ['/admin/settings/hotspot-portal', 'hotspot-portal'],
  ['/admin/settings/webhooks', 'webhooks']
];

test('every General Settings sidebar link has a client target and an Express page route', () => {
  for (const [url, target] of settingsPaths) {
    assert.ok(adminView.includes(`href="${url}" data-settings-nav="${target}"`), `sidebar link missing for ${url}`);
    assert.ok(mainScript.includes(`'${url}': '${target}'`) || mainScript.includes(`'${url}': '${target}'`), `client route missing for ${url}`);
    assert.ok(serverSource.includes('webhooks)\\/?$/') || url !== '/admin/settings/webhooks', 'settings route regex must include the shared settings sections');
  }
  assert.match(serverSource, /app\.get\(\/\^\\\/admin\\\/settings\\\//);
  assert.match(serverSource, /hotspot-portal\|webhooks\)/);
});

test('settings submenu click and browser history keep route, panel, and active item synchronized', () => {
  assert.match(mainScript, /const validTargets = Object\.keys\(pathsByTarget\)/);
  assert.match(mainScript, /window\.history\.pushState/);
  assert.match(mainScript, /addEventListener\('popstate'/);
  assert.match(mainScript, /item\.dataset\.settingsNav === target/);
  assert.match(adminView, /function initializeGeneralSettingsRoute\(\)/);
  assert.match(adminView, /syncGeneralSettingsSidebar\(target\)/);
});

test('settings save forms submit asynchronously and have matching API handlers', () => {
  for (const id of ['systemBrandForm', 'systemBillingForm', 'systemSmsForm', 'generalWebhookForm', 'generalMfsForm', 'webhookApiSettingsForm', 'hotspotPortalSettingsForm']) {
    assert.ok(adminView.includes(`id="${id}"`), `settings form missing: ${id}`);
  }
  assert.match(adminView, /function saveSystemSettings\(payload,buttonId,resultId\)/);
  assert.match(adminView, /fetch\('\/api\/settings\/update'/);
  assert.match(adminView, /fetch\('\/api\/admin\/webhook-settings'/);
  assert.match(portalScript, /f\.addEventListener\('submit',save\)/);
  assert.match(portalScript, /req\(api,\{method:'PUT'/);
  assert.match(settingsRoutes, /router\.post\("\/update",controller\.updateSettings\)/);
  assert.match(webhookRoutes, /router\.put\("\/",controller\.save\)/);
});
