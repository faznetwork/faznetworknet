'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');
const { requireRole } = require('../middleware/rbac');

function createResponse() {
  return {
    statusCode: null,
    body: null,
    redirectTo: null,
    clearedCookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send(body) { this.body = body; return this; },
    redirect(path) { this.redirectTo = path; this.statusCode = 302; return this; },
    clearCookie(name, options) { this.clearedCookies.push({ name, options }); return this; }
  };
}

function resellerRequest(url = '/api/reseller-portal/overview') {
  let destroyCalls = 0;
  const req = {
    originalUrl: url,
    method: 'GET',
    session: {
      auth: { role: 'reseller', resellerId: 41, isReseller: true },
      destroy(callback) {
        destroyCalls += 1;
        callback(null);
      }
    }
  };
  return { req, destroyCalls: () => destroyCalls };
}

test('inactive reseller API request destroys session, clears cookie, and returns 401', async t => {
  t.mock.method(db, 'query', async () => ({ rows: [{ id: 41, status: 'inactive' }] }));
  const { req, destroyCalls } = resellerRequest();
  const res = createResponse();
  let nextCalls = 0;

  await requireRole(['reseller'])(req, res, () => { nextCalls += 1; });

  assert.equal(destroyCalls(), 1);
  assert.deepEqual(res.clearedCookies, [{ name: 'connect.sid', options: { path: '/' } }]);
  assert.equal(res.statusCode, 401);
  assert.match(res.body.message, /inactive|unavailable/i);
  assert.equal(nextCalls, 0);
});

test('missing reseller record destroys session, clears cookie, and redirects page request to reseller login', async t => {
  t.mock.method(db, 'query', async () => ({ rows: [] }));
  const { req, destroyCalls } = resellerRequest('/reseller/dashboard');
  const res = createResponse();
  let nextCalls = 0;

  await requireRole(['reseller'])(req, res, () => { nextCalls += 1; });

  assert.equal(destroyCalls(), 1);
  assert.deepEqual(res.clearedCookies, [{ name: 'connect.sid', options: { path: '/' } }]);
  assert.equal(res.redirectTo, '/reseller/login');
  assert.equal(nextCalls, 0);
});

test('active reseller request retains its session and proceeds', async t => {
  t.mock.method(db, 'query', async () => ({ rows: [{ id: 41, status: 'active' }] }));
  const { req, destroyCalls } = resellerRequest();
  const res = createResponse();
  let nextCalls = 0;

  await requireRole(['reseller'])(req, res, () => { nextCalls += 1; });

  assert.equal(destroyCalls(), 0);
  assert.equal(nextCalls, 1);
  assert.equal(req.auth.role, 'reseller');
  assert.equal(req.auth.resellerId, 41);
  assert.deepEqual(res.clearedCookies, []);
});

test('session-store destroy failure is logged, clears cookie, and fails closed with 503', async t => {
  t.mock.method(db, 'query', async () => ({ rows: [{ id: 41, status: 'inactive' }] }));
  const originalError = console.error;
  let logged = false;
  t.after(() => { console.error = originalError; });
  console.error = (...args) => { logged = args[0] === '[RBAC] Failed to destroy inactive reseller session:'; };

  const { req } = resellerRequest();
  req.session.destroy = callback => callback(new Error('session store unavailable'));
  const res = createResponse();
  let nextCalls = 0;

  await requireRole(['reseller'])(req, res, () => { nextCalls += 1; });

  assert.equal(logged, true);
  assert.deepEqual(res.clearedCookies, [{ name: 'connect.sid', options: { path: '/' } }]);
  assert.equal(res.statusCode, 503);
  assert.equal(nextCalls, 0);
});
