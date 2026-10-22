const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminView = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin.ejs'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

test('admin popstate is a thin adapter and defers history dispatch until initial boot completes', () => {
  assert.match(adminView, /function handleAdminPopState\(\)\s*\{\s*if \(state\.booting\)\s*\{\s*state\.pendingPopState = true;/);
  assert.ok(adminView.includes("window.addEventListener('popstate', handleAdminPopState)"));
  assert.match(adminView, /restoreRoute\(readRoute\(\), true\);\s*closeDrawerAfterNavigation\(\);/);
  assert.ok(adminView.includes('state.booting = false;'));
  assert.ok(adminView.includes('if (state.pendingPopState)'));
  assert.ok(adminView.includes('handleAdminPopState();'));
});

test('server view metadata and client route map cover the five critical direct URLs', () => {
  assert.ok(serverSource.includes('res.locals.adminViewKey = resolveAdminViewKey(req.path)'));
  for (const route of [
    '/admin/dashboard',
    '/admin/customers/all',
    '/admin/payments/pending',
    '/admin/hotspot/users/all',
    '/admin/settings/brand-identity'
  ]) {
    assert.ok(adminView.includes("'" + route + "':"), 'client route map missing ' + route);
    assert.ok(serverSource.includes('"' + route + '"'), 'server route-key map missing ' + route);
  }
  assert.ok(adminView.includes("const serverViewKey = String(document.body?.dataset?.adminViewKey || '').trim();"));
  assert.ok(adminView.includes('restoreRoute(initialRoute, true)'));
});
