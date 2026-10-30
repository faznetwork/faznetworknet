'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminPath = path.join(__dirname, '..', 'views', 'admin.ejs');
const modulePath = path.join(__dirname, '..', 'public', 'js', 'pop-reseller-admin.js');
const admin = fs.readFileSync(adminPath, 'utf8');
const ui = fs.readFileSync(modulePath, 'utf8');

test('Sub-Staff navigation remains intact and separate from POP/reseller navigation', () => {
  assert.ok(admin.includes('<li><a href="/admin/resellers/sub-staff"><span data-key="sub_staff">Sub-Staff</span></a></li>'));
  assert.ok(admin.includes('href="/admin/network/pop-management"'));
  assert.ok(admin.includes('href="/admin/resellers/accounts"'));
  assert.ok(admin.indexOf('href="/admin/network/pop-management"') > admin.indexOf('href="/admin/resellers/sub-staff"'));
});

test('POP and reseller routes are registered in the existing SPA route lifecycle', () => {
  assert.ok(admin.includes("if (route.view === 'pop-management') return { view: 'pop-management' };"));
  assert.ok(admin.includes("if (route.view === 'reseller-accounts') return { view: 'reseller-accounts' };"));
  assert.ok(admin.includes("'/admin/network/pop-management': { view: 'pop-management' }"));
  assert.ok(admin.includes("'/admin/resellers/accounts': { view: 'reseller-accounts' }"));
  assert.ok(admin.includes("if (normalized.view === 'pop-management') return '/admin/network/pop-management';"));
  assert.ok(admin.includes("if (normalized.view === 'reseller-accounts') return '/admin/resellers/accounts';"));
  assert.ok(admin.includes("case 'pop-management': return callIfAvailable('loadPopManagement');"));
  assert.ok(admin.includes("case 'reseller-accounts': return callIfAvailable('loadResellerAccess');"));
  assert.ok(admin.includes('<script src="/js/pop-reseller-admin.js?v=milestone4-20261030"></script>'));
});

test('POP UI uses stable POP totals, direct POP protection and soft status toggles only', () => {
  assert.ok(ui.includes('Total POP Customers'));
  assert.ok(ui.includes('Number(pop.customer_count || 0)'));
  assert.ok(ui.includes("const DIRECT_POP_NAME = 'FAZ Main (Direct)'"));
  assert.ok(ui.includes("pop.name !== DIRECT_POP_NAME"));
  assert.ok(ui.includes("method: 'PATCH', body: { status: nextStatus }"));
  assert.ok(!/method\s*:\s*['"]DELETE['"]/i.test(ui));
  assert.ok(!/api\/pops\/[^'"]+['"]\s*,\s*\{\s*method\s*:\s*['"]DELETE/i.test(ui));
});

test('Reseller UI consumes assigned POP projection and invitation lifecycle actions', () => {
  for (const status of ['pending', 'active', 'expired', 'inactive']) assert.ok(ui.includes(status));
  assert.ok(ui.includes('reseller.assigned_pops'));
  assert.ok(ui.includes("apiRequest('/resellers/invite'"));
  assert.ok(ui.includes("'/resellers/' + encodeURIComponent(id) + '/resend-invite'"));
  assert.ok(ui.includes("'/resellers/' + encodeURIComponent(id) + '/cancel-invite'"));
  assert.ok(ui.includes('assigned_pop_ids:'));
});

test('UI exposes API failures and prevents activation before invitation acceptance', () => {
  assert.ok(ui.includes('role="alert"'));
  assert.ok(ui.includes("console.error('[POP/Reseller Admin UI]"));
  assert.ok(ui.includes("This invitation must be accepted and a password set before activation."));
  assert.ok(ui.includes('spinner-border'));
});
