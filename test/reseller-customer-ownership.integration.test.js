'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/rbac');
const { loadTenantScope, requireCustomerOwnership } = require('../middleware/tenantScope');
const resellerPortalRoutes = require('../routes/resellerPortalRoutes');

function mockTenantDatabase(t) {
  t.mock.method(db, 'query', async (sql, values = []) => {
    if (sql.includes('SELECT id,status FROM resellers')) {
      return { rows: [{ id: 41, status: 'active' }] };
    }
    if (sql === 'SELECT id FROM pops WHERE reseller_id=$1') {
      assert.equal(values[0], 41);
      return { rows: [{ id: 101 }] };
    }
    if (sql.includes('SELECT id,username,pop_id FROM customers')) {
      const key = String(values[0]);
      if (key === 'own-customer') {
        return { rows: [{ id: 11, username: 'own-customer', pop_id: 101 }] };
      }
      return { rows: [] };
    }
    if (sql.startsWith('SELECT 1 FROM customers')) {
      const key = String(values[0]);
      return { rows: key === 'other-customer' ? [{ '?column?': 1 }] : [] };
    }
    if (sql.includes('SELECT c.id, c.full_name, c.username')) {
      return { rows: [] };
    }
    throw new Error('Unexpected database query in reseller ownership integration test: ' + sql);
  });
}

async function createHttpApp(t) {
  const app = express();
  app.set('views', path.join(__dirname, '..', 'views'));
  app.set('view engine', 'ejs');
  app.use((req, res, next) => {
    req.session = {
      auth: {
        role: 'reseller',
        resellerId: 41,
        isReseller: true,
        name: 'Test Reseller'
      }
    };
    next();
  });

  // Keep this chain aligned with the production GET /reseller/customers/:id route.
  app.get(
    '/reseller/customers/:id',
    requireRole(['reseller']),
    loadTenantScope,
    requireCustomerOwnership({ notFoundStatus: 403 }),
    (req, res) => res
      .set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
      .render('reseller-customer-profile', {
        title: 'FAZ NETWORK Reseller Customer Profile',
        customerId: String(req.params.id || '')
      })
  );
  app.use('/api/reseller-portal', resellerPortalRoutes);

  const server = await new Promise((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  return 'http://127.0.0.1:' + server.address().port;
}

test('reseller customer page renders HTTP 200 for a customer in the reseller POP scope', async t => {
  mockTenantDatabase(t);
  const baseUrl = await createHttpApp(t);

  const response = await fetch(baseUrl + '/reseller/customers/own-customer');

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') || '', /text\/html/);
  assert.match(await response.text(), /Reseller Customer Profile/);
});

test('reseller customer page returns HTTP 403 for a customer owned by another reseller POP', async t => {
  mockTenantDatabase(t);
  const baseUrl = await createHttpApp(t);

  const response = await fetch(baseUrl + '/reseller/customers/other-customer');

  assert.equal(response.status, 403);
  assert.doesNotMatch(await response.text(), /<!doctype html>/i);
});

test('reseller customer page returns HTTP 403 for a non-existent customer identifier', async t => {
  mockTenantDatabase(t);
  const baseUrl = await createHttpApp(t);

  const response = await fetch(baseUrl + '/reseller/customers/does-not-exist');

  assert.equal(response.status, 403);
  assert.doesNotMatch(await response.text(), /<!doctype html>/i);
});

test('reseller customer API returns HTTP 403 for a customer owned by another reseller POP', async t => {
  mockTenantDatabase(t);
  const baseUrl = await createHttpApp(t);

  const response = await fetch(baseUrl + '/api/reseller-portal/customers/other-customer');

  assert.equal(response.status, 403);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.match(payload.message, /another reseller or POP/i);
});
