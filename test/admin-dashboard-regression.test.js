'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminTemplate = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin.ejs'), 'utf8');

test('voucher print document uses a multiline template literal with escaped dynamic values', () => {
  assert.ok(adminTemplate.includes('const printable = `<!doctype html>'));
  assert.ok(adminTemplate.includes('<div class="pin">${escapeHtml(pin)}</div>'));
  assert.ok(adminTemplate.includes('${escapeHtml(profileName)}'));
  assert.ok(!adminTemplate.includes("const printable = '<!doctype html>"));
});

test('admin navigation helper loads independently and remains globally exposed', () => {
  const navigationScript = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'admin-navigation.js'), 'utf8');
  assert.match(adminTemplate, /<script src="\/js\/admin-navigation\.js[^"]*" defer><\/script>/);
  assert.ok(adminTemplate.indexOf('/js/admin-navigation.js') < adminTemplate.indexOf('<body'));
  assert.match(navigationScript, /function\s+toggleSubmenu\s*\(/);
  assert.match(navigationScript, /window\.toggleSubmenu\s*=\s*toggleSubmenu/);
  assert.match(adminTemplate, /async function\s+loadCustomerSection\s*\(/);
  assert.match(adminTemplate, /window\.loadCustomerSection\s*=\s*loadCustomerSection/);
});

test('dashboard KPI cards use neutral surfaces and semantic pastel icon accents', () => {
  const cardRule = adminTemplate.match(/\.dashboard-kpi-card\{([^}]+)\}/);
  assert.ok(cardRule, 'Dashboard KPI card rule must exist');
  assert.match(cardRule[1], /background:#fff/);
  assert.match(cardRule[1], /border:1px solid #e2e8f0/);
  assert.doesNotMatch(cardRule[1], /linear-gradient/);
  assert.ok(adminTemplate.includes('.kpi-gradient-emerald .dashboard-kpi-icon{background:#ecfdf5;color:#059669'));
});

test('mobile topbar separates title/actions and retains an accessible sign-out action', () => {
  assert.ok(adminTemplate.includes('class="admin-topbar-heading"'));
  assert.ok(adminTemplate.includes('class="admin-topbar-actions"'));
  assert.ok(adminTemplate.includes('aria-label="Sign out"'));
  assert.ok(adminTemplate.includes('.admin-topbar-brand'));
  assert.match(adminTemplate, /#pageTitle\s*\{[^}]*text-overflow:ellipsis/);
});

test('NOC and Hotspot overview polling remain defined and scheduled', () => {
  assert.match(adminTemplate, /async function pollNocStats\s*\(/);
  assert.match(adminTemplate, /function startNocPolling\s*\(/);
  assert.match(adminTemplate, /window\.nocStatsTimer\s*=\s*setInterval/);
  assert.match(adminTemplate, /window\.hotspotOverviewTimer\s*=\s*setInterval/);
});
