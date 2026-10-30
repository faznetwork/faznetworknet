'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const controller = require('../controllers/resellerAuthController');
const invitationService = require('../services/resellerInvitationService');

function responseRecorder() {
  return {
    statusCode: 200,
    payload: null,
    cookies: [],
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    clearCookie(name, options) { this.cookies.push({ name, options }); return this; },
    set() { return this; },
    render(view, locals) { this.view = view; this.locals = locals; return this; }
  };
}

function strongPassword() {
  return 'Reseller-' + crypto.randomUUID() + 'A1!';
}

test('invite creates an inactive reseller and queues email inside the transaction', async t => {
  let queued = false;
  let insertedValues;
  t.mock.method(db, 'withTransaction', async callback => callback({
    async query(sql, values) {
      assert.match(sql, /INSERT INTO resellers/);
      insertedValues = values;
      return { rows: [{ id: 702, name: 'North POP Partner', email: 'partner@example.com', phone: '01700000000', status: 'inactive' }] };
    }
  }));
  t.mock.method(invitationService, 'queueInvitation', async payload => {
    queued = true;
    assert.equal(payload.reseller.status, 'inactive');
    assert.ok(payload.token);
    assert.ok(payload.client);
    return { accepted: true };
  });

  const res = responseRecorder();
  await controller.invite({
    body: { name: 'North POP Partner', email: 'PARTNER@example.com', phone: '01700000000', assigned_pop_ids: [] }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.payload.success, true);
  assert.equal(res.payload.reseller.status, 'inactive');
  assert.equal(queued, true);
  assert.equal(insertedValues[1], 'partner@example.com');
  assert.equal(insertedValues[2], '01700000000');
  assert.match(insertedValues[3], /^[a-f0-9]{64}$/);
});

test('invite rejects malformed email before opening a database transaction', async t => {
  let transactionCalled = false;
  t.mock.method(db, 'withTransaction', async () => { transactionCalled = true; });
  const res = responseRecorder();

  await controller.invite({ body: { name: 'Partner', email: 'not-an-email', phone: '01700000000' } }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload.success, false);
  assert.equal(transactionCalled, false);
});

test('accept invite activates the reseller and consumes the token atomically', async t => {
  const generated = invitationService.createInvitationToken();
  const password = strongPassword();
  const statements = [];
  t.mock.method(db, 'withTransaction', async callback => callback({
    async query(sql, values) {
      statements.push(sql);
      if (sql.startsWith('SELECT id,email,invite_expires_at')) {
        assert.equal(values[0], generated.tokenHash);
        return { rows: [{ id: 703, email: 'accepted@example.com', invite_expires_at: new Date(Date.now() + 60000) }] };
      }
      assert.match(sql, /UPDATE resellers SET password_hash/);
      assert.equal(values[1], 703);
      return { rows: [{ id: 703, name: 'Accepted Partner', email: 'accepted@example.com' }] };
    }
  }));

  const res = responseRecorder();
  await controller.acceptInvite({
    body: { token: generated.token, password, confirm_password: password }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(statements.length, 2);
  assert.match(statements[1], /invite_token_hash=NULL/);
  assert.match(statements[1], /status='active'/);
});

test('expired invitation cannot activate an account', async t => {
  t.mock.method(db, 'withTransaction', async callback => callback({
    async query() { return { rows: [] }; }
  }));
  const password = strongPassword();
  const generated = invitationService.createInvitationToken();
  const res = responseRecorder();

  await controller.acceptInvite({
    body: { token: generated.token, password, confirm_password: password }
  }, res);

  assert.equal(res.statusCode, 410);
  assert.equal(res.payload.success, false);
});

test('login establishes only the specified reseller session identity', async t => {
  const password = strongPassword();
  const passwordHash = await bcrypt.hash(password, 4);
  t.mock.method(db, 'query', async (sql, values) => {
    assert.match(sql, /FROM resellers WHERE lower\(email\)=lower\(\$1\)/);
    assert.equal(values[0], 'login@example.com');
    return { rows: [{
      id: 704, name: 'Login Partner', email: 'login@example.com',
      username: null, password_hash: passwordHash, status: 'active'
    }] };
  });

  const session = {
    regenerate(callback) { callback(null); },
    save(callback) { callback(null); }
  };
  const res = responseRecorder();
  await controller.login({ body: { email: 'login@example.com', password }, session }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(session.auth, { role: 'reseller', resellerId: 704, isReseller: true, name: 'Login Partner' });
  assert.equal(res.payload.redirect, '/reseller/dashboard');
});

test('logout rejects non-reseller sessions and destroys an authenticated reseller session', async t => {
  const rejected = responseRecorder();
  controller.logout({ session: { isAdmin: true, destroy(callback) { callback(null); } } }, rejected);
  assert.equal(rejected.statusCode, 401);

  const session = {
    auth: { role: 'reseller', resellerId: 705, isReseller: true, name: 'Logout Partner' },
    destroy(callback) { callback(null); }
  };
  const res = responseRecorder();
  controller.logout({ session }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(res.cookies[0].name, 'connect.sid');
});
