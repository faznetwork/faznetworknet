'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeModules, moduleEnabled, tenantLegacyApiGuard } = require('../middleware/tenantAccess');

function response() {
  return { statusCode: 200, body: null, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; return this; } };
}

test('module policy accepts only explicitly enabled boolean flags', () => {
  assert.equal(moduleEnabled({ modules: { hotspot: true } }, 'hotspot'), true);
  assert.equal(moduleEnabled({ enabled_modules: { hotspot: false }, modules: { hotspot: true } }, 'hotspot'), false);
  assert.equal(moduleEnabled({ modules: { hotspot: 'true' } }, 'hotspot'), false);
  assert.equal(moduleEnabled({ modules: {} }, 'hotspot'), false);
  assert.deepEqual(normalizeModules('{"billing":true,"hotspot":1}'), { billing: true, hotspot: false });
});

test('tenant legacy API guard denies global customer APIs without elevating privileges', () => {
  const req = { session: { tenantAdmin: true, tenantId: 7, isAdmin: false }, path: '/api/customers/42' };
  const res = response();
  let nextCalled = false;
  tenantLegacyApiGuard(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'TENANT_API_NOT_SCOPED');
  assert.equal(req.session.isAdmin, false);
});

test('tenant legacy API guard allows non-tenant and tenant-hardware paths', () => {
  let nextCalled = false;
  tenantLegacyApiGuard({ session: { isAdmin: true }, path: '/api/customers' }, response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  nextCalled = false;
  tenantLegacyApiGuard({ session: { tenantAdmin: true }, path: '/api/tenant/hardware' }, response(), () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

test('disabled tenant module returns 403 at route middleware level', () => {
  const { requireTenantModule } = require('../middleware/tenantAccess');
  const req = { session: { tenantAdmin: true, tenantId: 7, isAdmin: false }, tenant: { id: 7, enabled_modules: { billing: false } } };
  const res = response();
  let nextCalled = false;
  requireTenantModule('billing')(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, 'MODULE_DISABLED');
  assert.equal(req.session.isAdmin, false);
});

test('tenant-scoped API prefixes are not treated as legacy global APIs', () => {
  const req = { session: { tenantAdmin: true, tenantId: 7, isAdmin: false }, originalUrl: '/api/tenant/data/customers' };
  const res = response();
  let nextCalled = false;
  tenantLegacyApiGuard(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});
