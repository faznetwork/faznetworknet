'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const express = require('express');
const db = require('../db');
const { requireRole } = require('../middleware/rbac');
const { loadTenantScope, requireCustomerOwnership } = require('../middleware/tenantScope');
const resellerPortalRoutes = require('../routes/resellerPortalRoutes');
const customerController = require('../controllers/customerController');

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
    if (sql.includes('FROM packages') && sql.includes('profile_name')) {
      return { rows: [{ id: 7, name: 'Home 30 Mbps', profile_name: 'HOME_30', price: '525.00', duration_months: 1 }] };
    }
    if (sql.includes('c.password AS pppoe_password')) {
      if (String(values[0]) !== 'own-customer') return { rows: [] };
      assert.deepEqual(values, ['own-customer', [101], 41]);
      return { rows: [{ id: 11, full_name: 'Owned Customer', username: 'own-customer',
        pppoe_password: 'secret-pass', pop_id: 101, pop_name: 'Owned POP' }] };
    }
    if (sql.includes('SELECT c.id, c.full_name, c.username')) return { rows: [] };
    throw new Error('Unexpected database query in reseller ownership integration test: ' + sql);
  });
}

async function createHttpApp(t) {
  const app = express();
  app.use(express.json());
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

test('production page route orders role, tenant scope, and ownership guards before EJS rendering', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(
    server,
    /app\.get\("\/reseller\/customers\/:id",requireRole\(\["reseller"\]\),loadTenantScope,requireCustomerOwnership\(\{notFoundStatus:403\}\),\(req,res\)=>res\.set/
  );
});

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

test('reseller package catalog is read-only and returns the customer form contract', async t => {
  mockTenantDatabase(t);
  const baseUrl = await createHttpApp(t);
  const response = await fetch(baseUrl + '/api/reseller-portal/packages');
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.packages, [{ id: '7', name: 'Home 30 Mbps', profileName: 'HOME_30', price: 525, durationMonths: 1 }]);
});

test('reseller package catalog rejects unauthenticated requests', async t => {
  mockTenantDatabase(t);
  const app = express(); app.use(express.json()); app.use('/api/reseller-portal', resellerPortalRoutes);
  const server = await new Promise((resolve, reject) => { const listener = app.listen(0, '127.0.0.1', () => resolve(listener)); listener.once('error', reject); });
  t.after(() => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const response = await fetch('http://127.0.0.1:' + server.address().port + '/api/reseller-portal/packages');
  assert.equal(response.status, 401);
});
test('reseller customer creation delegates only after verified identity and assigned POP scope', async t => {
  mockTenantDatabase(t);
  let receivedBody = null;
  t.mock.method(customerController, 'createCustomer', async (req, res) => {
    receivedBody = req.body;
    return res.status(201).json({ success: true, customer: { username: req.body.username } });
  });
  const baseUrl = await createHttpApp(t);

  const response = await fetch(baseUrl + '/api/reseller-portal/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Owned Customer',
      username: 'owned-customer',
      pop_id: 101,
      reseller_id: 999,
      vlan_id: 4090,
      mikrotik_ip_pool: 'AttackerPool'
    })
  });

  assert.equal(response.status, 201);
  assert.equal(receivedBody.pop_id, 101);
  assert.equal(Object.prototype.hasOwnProperty.call(receivedBody, 'reseller_id'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(receivedBody, 'vlan_id'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(receivedBody, 'mikrotik_ip_pool'), false);
});

test('reseller customer creation rejects a POP outside the authenticated reseller scope', async t => {
  mockTenantDatabase(t);
  let delegated = false;
  t.mock.method(customerController, 'createCustomer', async (_req, res) => {
    delegated = true;
    return res.status(201).json({ success: true });
  });
  const baseUrl = await createHttpApp(t);

  const response = await fetch(baseUrl + '/api/reseller-portal/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fullName: 'Foreign Customer', username: 'foreign-customer', pop_id: 201 })
  });

  assert.equal(response.status, 403);
  assert.equal(delegated, false);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.match(payload.message, /not assigned to your reseller/i);
});


test('reseller customer profile API returns PPPoE password only in the tenant-scoped no-store profile response', async t => {
  mockTenantDatabase(t);
  const baseUrl = await createHttpApp(t);
  const response = await fetch(baseUrl + '/api/reseller-portal/customers/own-customer');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  assert.match(response.headers.get('pragma') || '', /no-cache/i);
  const payload = await response.json();
  assert.equal(payload.customer.username, 'own-customer');
  assert.equal(payload.customer.pppoe_password, 'secret-pass');
});
