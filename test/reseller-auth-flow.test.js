'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');
const controller = require('../controllers/resellerAuthController');
const resellerController = require('../controllers/resellerController');
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
  const transactionStatements = [];
  t.mock.method(db, 'withTransaction', async callback => callback({
    async query(sql, values) {
      transactionStatements.push(sql);
      if (sql.includes('INSERT INTO resellers')) {
        insertedValues = values;
        return { rows: [{ id: 702, name: 'North POP Partner', email: 'partner@example.com', phone: '01700000000', status: 'inactive' }] };
      }
      if (sql.includes('INSERT INTO public.reseller_billing_accounts')) {
        assert.match(sql, /billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status/);
        assert.match(sql, /ON CONFLICT \(reseller_id\) DO NOTHING/);
        assert.deepEqual(values, [702]);
        return { rows: [] };
      }
      throw new Error('Unexpected reseller invite SQL: ' + sql);
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
  assert.equal(transactionStatements.length, 2);
  assert.match(transactionStatements[0], /INSERT INTO resellers/);
  assert.match(transactionStatements[1], /INSERT INTO public\.reseller_billing_accounts/);
  assert.equal(insertedValues[1], 'partner@example.com');
  assert.equal(insertedValues[2], '01700000000');
  assert.match(insertedValues[3], /^[a-f0-9]{64}$/);
});


test('invite rolls back reseller creation and does not queue email when billing account provisioning fails', async t => {
  const statements = [];
  let invitationQueued = false;
  t.mock.method(db, 'withTransaction', async callback => {
    const client = {
      async query(sql) {
        statements.push(sql);
        if (sql.includes('INSERT INTO resellers')) {
          return { rows: [{ id: 709, name: 'Billing Failure Partner', email: 'billing-failure@example.com', phone: '01700000000', status: 'inactive' }] };
        }
        if (sql.includes('INSERT INTO public.reseller_billing_accounts')) {
          throw new Error('simulated billing account insert failure');
        }
        throw new Error('Unexpected SQL: ' + sql);
      }
    };
    return callback(client);
  });
  t.mock.method(invitationService, 'queueInvitation', async () => { invitationQueued = true; });
  const res = responseRecorder();
  await controller.invite({
    body: { name: 'Billing Failure Partner', email: 'billing-failure@example.com', phone: '01700000000', assigned_pop_ids: [] }
  }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.success, false);
  assert.equal(statements.length, 2);
  assert.equal(invitationQueued, false);
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

test('administrator status change cannot activate an invitation without a password', async t => {
  let calls = 0;
  t.mock.method(db, 'query', async (sql, values) => {
    calls += 1;
    if (calls === 1) {
      assert.match(sql, /password_hash IS NOT NULL/);
      assert.equal(values[0], 'active');
      return { rows: [] };
    }
    return { rows: [{ id: 706, password_hash: null }] };
  });
  const res = responseRecorder();

  await resellerController.updateStatus({ params: { id: '706' }, body: { status: 'active' } }, res);

  assert.equal(res.statusCode, 409);
  assert.match(res.payload.message, /accept the email invitation/i);
});

test('resend invitation replaces the token and queues the replacement in one transaction', async t => {
  const statements = [];
  t.mock.method(db, 'withTransaction', async callback => callback({
    async query(sql) {
      statements.push(sql);
      if (sql.startsWith('SELECT id,name,email,phone,status')) {
        return { rows: [{ id: 707, name: 'Resend Partner', email: 'resend@example.com', phone: '01700000000', status: 'inactive' }] };
      }
      return { rows: [{ id: 707, name: 'Resend Partner', email: 'resend@example.com', phone: '01700000000', status: 'inactive' }] };
    }
  }));
  t.mock.method(invitationService, 'queueInvitation', async payload => {
    assert.equal(payload.reseller.id, 707);
    assert.ok(payload.token);
    return { accepted: true };
  });
  const res = responseRecorder();

  await controller.resendInvite({ params: { id: '707' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
  assert.equal(statements.length, 2);
  assert.match(statements[1], /invite_token_hash=\$1/);
});

test('cancel invitation invalidates the stored token hash', async t => {
  t.mock.method(db, 'query', async (sql, values) => {
    assert.match(sql, /invite_token_hash=NULL/);
    assert.match(sql, /status='inactive'/);
    assert.equal(values[0], 708);
    return { rows: [{ id: 708 }] };
  });
  const res = responseRecorder();

  await controller.cancelInvite({ params: { id: '708' } }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.success, true);
});

test('legacy username login is used only when no email address matches', async t => {
  const password = strongPassword();
  const passwordHash = await bcrypt.hash(password, 4);
  let calls = 0;
  t.mock.method(db, 'query', async (sql, values) => {
    calls += 1;
    if (calls === 1) {
      assert.match(sql, /lower\(email\)=lower\(\$1\)/);
      return { rows: [] };
    }
    assert.match(sql, /lower\(username\)=lower\(\$1\)/);
    assert.equal(values[0], 'legacy-partner');
    return { rows: [{
      id: 709, name: 'Legacy Partner', email: null,
      username: 'legacy-partner', password_hash: passwordHash, status: 'active'
    }] };
  });
  const session = {
    regenerate(callback) { callback(null); },
    save(callback) { callback(null); }
  };
  const res = responseRecorder();

  await controller.login({ body: { username: 'legacy-partner', password }, session }, res);

  assert.equal(calls, 2);
  assert.equal(res.statusCode, 200);
  assert.equal(session.auth.resellerId, 709);
});

test('POP assignment locks customer writes and accepts only an empty active unassigned POP', async t => {
  const statements = [];
  t.mock.method(db, 'withTransaction', async callback => callback({
    async query(sql) {
      statements.push(sql);
      if (sql.startsWith('SELECT p.id,p.name,p.reseller_id,p.status')) {
        return { rows: [{ id: 811, name: 'North POP', reseller_id: null, status: 'active', has_customers: false }] };
      }
      if (sql.startsWith('INSERT INTO resellers')) {
        return { rows: [{ id: 810, name: 'North Partner', email: 'north@example.com', phone: '01700000000', status: 'inactive' }] };
      }
      if (sql.startsWith('UPDATE pops')) return { rows: [{ id: 811 }] };
      return { rows: [] };
    }
  }));
  t.mock.method(invitationService, 'queueInvitation', async () => ({ accepted: true }));
  const res = responseRecorder();

  await controller.invite({
    body: { name: 'North Partner', email: 'north@example.com', phone: '01700000000', assigned_pop_ids: [811] }
  }, res);

  assert.equal(res.statusCode, 201);
  assert.match(statements[0], /LOCK TABLE customers IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(statements[1], /FROM pops p WHERE p.id=ANY/);
  assert.match(statements[2], /INSERT INTO resellers/);
  assert.match(statements[3], /UPDATE pops SET reseller_id/);
});
