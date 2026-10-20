'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');
const requireTenantAdmin = require('../middleware/requireTenantAdmin');

test('tenant middleware publishes the freshly queried canonical modules to EJS locals', async () => {
  const originalQuery = db.query;
  const tenant = {
    id: 7,
    name: 'Tenant Seven',
    slug: 'tenant-seven',
    status: 'active',
    modules: { customers: true, hotspot: true, billing: true, pppoe: true, mikrotik: true, olt: true, reports: true },
    ends_at: new Date(Date.now() + 86400000)
  };
  let queriedSql = '';
  let queriedParams;
  db.query = async (sql, params) => {
    queriedSql = sql;
    queriedParams = params;
    return { rows: [tenant] };
  };
  const req = {
    session: { tenantAdmin: true, tenantId: 7 },
    originalUrl: '/dashboard'
  };
  const res = {
    locals: {},
    headers: {},
    set(name, value) { this.headers[name] = value; return this; }
  };

  try {
    await new Promise((resolve, reject) => {
      requireTenantAdmin(req, res, error => error ? reject(error) : resolve());
    });
    assert.match(queriedSql, /t\.modules/);
    assert.deepEqual(queriedParams, [7]);
    assert.strictEqual(req.tenant, tenant);
    assert.strictEqual(res.locals.tenant, tenant);
    assert.equal(res.locals.tenantContext, true);
    assert.strictEqual(res.locals.tenant.modules, tenant.modules);
    assert.equal(res.headers['Cache-Control'], 'no-store, private');
  } finally {
    db.query = originalQuery;
  }
});
