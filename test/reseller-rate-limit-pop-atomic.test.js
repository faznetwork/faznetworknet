'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');
const { createRateLimiter } = require('../middleware/postgresRateLimiter');
const resellerAuthController = require('../controllers/resellerAuthController');
const invitationService = require('../services/resellerInvitationService');

const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('reseller login and invitation acceptance routes use independent PostgreSQL rate limits', () => {
  const routes = read('routes/resellerRoutes.js');
  assert.match(routes, /router\.post\('\/login',\s*rateLimiter\.resellerLogin,\s*resellerAuthController\.login\)/);
  assert.match(routes, /router\.post\('\/accept-invite',\s*rateLimiter\.resellerAcceptInvite,\s*resellerAuthController\.acceptInvite\)/);
  assert.match(routes, /router\.post\('\/invite',\s*requireRole\(\['super_admin', 'admin'\]\),\s*rateLimiter\.resellerAdminInvite/);
  assert.match(routes, /router\.post\('\/:id\/resend-invite',\s*requireRole\(\['super_admin', 'admin'\]\),\s*rateLimiter\.resellerAdminResend/);
});

test('PostgreSQL rate limiter allows requests through the configured limit and rejects the next request', async t => {
  let count = 0;
  t.mock.method(db, 'query', async (sql, values) => {
    if (sql.includes('DELETE FROM rate_limits')) return { rows: [] };
    assert.match(sql, /INSERT INTO rate_limits/);
    assert.equal(values[1], 60_000);
    count += 1;
    return { rows: [{ request_count: count, retry_after_seconds: 42 }] };
  });
  const limiter = createRateLimiter({ name: 'test-login', windowMs: 60_000, max: 2 });
  const req = { ip: '192.0.2.10', session: {} };
  let nextCalls = 0;
  const first = response();
  await limiter(req, first, () => { nextCalls += 1; });
  const second = response();
  await limiter(req, second, () => { nextCalls += 1; });
  const third = response();
  await limiter(req, third, () => { nextCalls += 1; });

  assert.equal(nextCalls, 2);
  assert.equal(first.statusCode, 200);
  assert.equal(second.headers['RateLimit-Remaining'], '0');
  assert.equal(third.statusCode, 429);
  assert.equal(third.headers['Retry-After'], '42');
  assert.equal(third.body.code, 'RATE_LIMITED');
});

test('rate limiter fails closed with explicit 503 when PostgreSQL counter is unavailable', async t => {
  t.mock.method(db, 'query', async () => { throw new Error('database unavailable'); });
  const originalError = console.error;
  let loggedError = null;
  t.after(() => { console.error = originalError; });
  console.error = (...args) => { loggedError = args; };
  const limiter = createRateLimiter({ name: 'test-fail-closed', windowMs: 60_000, max: 2 });
  const res = response();
  let nextCalls = 0;
  await limiter({ ip: '192.0.2.11', session: {} }, res, () => { nextCalls += 1; });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'RATE_LIMIT_UNAVAILABLE');
  assert.equal(nextCalls, 0);
  assert.equal(loggedError[0], '[RATE LIMIT] PostgreSQL counter failed:');
  assert.match(loggedError[1], /database unavailable/);
});

test('resend endpoint returns HTTP 429 and does not enqueue during the 60-second cooldown', async t => {
  let queueCalls = 0;
  t.mock.method(db, 'withTransaction', async callback => callback({
    query: async sql => {
      assert.match(sql, /FOR UPDATE/);
      return { rows: [{ id: 41, name: 'Reseller', email: 'reseller@example.invalid', phone: '01700000000', status: 'inactive', cooldown_remaining: 37 }] };
    }
  }));
  t.mock.method(invitationService, 'queueInvitation', async () => { queueCalls += 1; });
  const res = response();
  await resellerAuthController.resendInvite({ params: { id: '41' } }, res);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers['Retry-After'], '37');
  assert.equal(res.body.code, 'INVITATION_COOLDOWN');
  assert.equal(queueCalls, 0);
});

test('resend endpoint queues exactly one invitation after the cooldown expires', async t => {
  let queueCalls = 0;
  t.mock.method(db, 'withTransaction', async callback => callback({
    query: async sql => {
      if (sql.includes('SELECT id,name,email,phone,status,invited_at')) {
        return { rows: [{ id: 41, name: 'Reseller', email: 'reseller@example.invalid', phone: '01700000000', status: 'inactive', cooldown_remaining: 0 }] };
      }
      if (sql.startsWith('UPDATE resellers SET invite_token_hash')) {
        return { rows: [{ id: 41, name: 'Reseller', email: 'reseller@example.invalid', phone: '01700000000', status: 'inactive' }] };
      }
      throw new Error('Unexpected resend query: ' + sql);
    }
  }));
  t.mock.method(invitationService, 'queueInvitation', async () => { queueCalls += 1; return { accepted: true }; });
  const res = response();
  await resellerAuthController.resendInvite({ params: { id: '41' } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(queueCalls, 1);
});

test('resend cooldown is checked under the reseller row lock before outbox enqueue', () => {
  const controller = read('controllers/resellerAuthController.js');
  const select = controller.indexOf('FROM resellers WHERE id=$1 FOR UPDATE');
  const cooldown = controller.indexOf("INTERVAL '60 seconds'");
  const queue = controller.indexOf('await invitationService.queueInvitation({ reseller: updated.rows[0]');
  assert.ok(select >= 0, 'resend must lock the reseller row');
  assert.ok(cooldown >= 0, 'resend must calculate the 60-second cooldown in PostgreSQL');
  assert.ok(queue > cooldown, 'outbox enqueue must occur only after cooldown validation');
  assert.match(controller, /status\(429\).*INVITATION_COOLDOWN/s);
  assert.match(controller, /Retry-After/);
});

test('customer creation locks and validates the POP in the same transaction as INSERT; MikroTik runs after commit', () => {
  const controller = read('controllers/customerController.js');
  const transaction = controller.indexOf('const creation = await db.withTransaction');
  const lock = controller.indexOf("status='active' FOR UPDATE", transaction);
  const insert = controller.indexOf('INSERT INTO customers', transaction);
  const routerProvision = controller.indexOf('getCustomerRouterService()', insert);
  assert.ok(transaction >= 0);
  assert.ok(lock > transaction);
  assert.ok(insert > lock);
  assert.ok(routerProvision > insert);
  assert.match(controller, /if \(creation\.kind === "inactive_pop"\)/);
});

test('POP deactivation remains a status-only update and preserves customer rows', () => {
  const pop = read('controllers/popController.js');
  assert.match(pop, /UPDATE pops SET status=\$1,updated_at=NOW\(\) WHERE id=\$2/);
  assert.doesNotMatch(pop, /DELETE FROM customers|UPDATE customers SET status/i);
});

test('real PostgreSQL integration: shared counters, cooldown, and POP row locks are atomic', {
  skip: !process.env.TEST_DATABASE_URL && 'Set TEST_DATABASE_URL to run PostgreSQL concurrency integration tests'
}, async () => {
  const { Client } = require('pg');
  const migration = read('db/migrations/20261030_rate_limits.sql');
  const schema = 'fzn_rate_pop_' + process.pid + '_' + Date.now();
  const quoted = '"' + schema.replace(/"/g, '""') + '"';
  const first = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  const second = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await Promise.all([first.connect(), second.connect()]);
  try {
    await first.query('CREATE SCHEMA ' + quoted);
    await Promise.all([first.query('SET search_path TO ' + quoted), second.query('SET search_path TO ' + quoted)]);
    await first.query(migration);
    await first.query("CREATE TABLE pops (id BIGINT PRIMARY KEY, status TEXT NOT NULL)");
    await first.query("CREATE TABLE customers (id BIGSERIAL PRIMARY KEY, pop_id BIGINT NOT NULL REFERENCES pops(id))");
    await first.query("CREATE TABLE resellers (id BIGINT PRIMARY KEY, invited_at TIMESTAMPTZ NOT NULL)");
    await first.query("INSERT INTO pops(id,status) VALUES (1,'active')");
    await first.query('INSERT INTO resellers(id,invited_at) VALUES (1,NOW())');

    const counterSql = `INSERT INTO rate_limits (key,window_started_at,request_count,expires_at)
      VALUES ($1,NOW(),1,NOW()+INTERVAL '60 seconds')
      ON CONFLICT (key) DO UPDATE SET request_count=rate_limits.request_count+1
      RETURNING request_count`;
    const counts = await Promise.all(Array.from({ length: 12 }, (_, index) =>
      (index % 2 ? first : second).query(counterSql, ['shared-key'])
    ));
    assert.deepEqual(counts.map(result => Number(result.rows[0].request_count)).sort((a,b)=>a-b),
      Array.from({ length: 12 }, (_, index) => index + 1));

    // The first resend after an expired cooldown claims the reseller row;
    // a concurrent resend waits and then observes the refreshed invited_at.
    await first.query("UPDATE resellers SET invited_at=NOW()-INTERVAL '61 seconds' WHERE id=1");
    await first.query('BEGIN');
    const firstCooldown = await first.query(
      "SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (invited_at + INTERVAL '60 seconds' - NOW()))))::int AS remaining FROM resellers WHERE id=1 FOR UPDATE"
    );
    assert.equal(Number(firstCooldown.rows[0].remaining), 0);
    await second.query('BEGIN');
    const secondCooldownPromise = second.query(
      "SELECT GREATEST(0, CEIL(EXTRACT(EPOCH FROM (invited_at + INTERVAL '60 seconds' - NOW()))))::int AS remaining FROM resellers WHERE id=1 FOR UPDATE"
    );
    await new Promise(resolve => setTimeout(resolve, 50));
    await first.query("UPDATE resellers SET invited_at=NOW() WHERE id=1");
    await first.query('COMMIT');
    const secondCooldown = await secondCooldownPromise;
    assert.ok(Number(secondCooldown.rows[0].remaining) > 0);
    await second.query('COMMIT');

    await first.query('BEGIN');
    await first.query("SELECT id FROM pops WHERE id=1 AND status='active' FOR UPDATE");
    await second.query('BEGIN');
    const deactivation = second.query("UPDATE pops SET status='inactive' WHERE id=1");
    await new Promise(resolve => setTimeout(resolve, 50));
    await first.query('INSERT INTO customers(pop_id) VALUES (1)');
    await first.query('COMMIT');
    await deactivation;
    await second.query('COMMIT');
    const preserved = await first.query('SELECT COUNT(*)::int AS count FROM customers WHERE pop_id=1');
    const inactive = await first.query("SELECT status FROM pops WHERE id=1");
    assert.equal(preserved.rows[0].count, 1);
    assert.equal(inactive.rows[0].status, 'inactive');

    await first.query("UPDATE pops SET status='inactive' WHERE id=1");
    await first.query('BEGIN');
    const rejected = await first.query("SELECT id FROM pops WHERE id=1 AND status='active' FOR UPDATE");
    assert.equal(rejected.rows.length, 0);
    await first.query('ROLLBACK');
  } finally {
    try {
      await Promise.all([first.query('SET search_path TO public'), second.query('SET search_path TO public')]);
      await first.query('DROP SCHEMA IF EXISTS ' + quoted + ' CASCADE');
    } finally {
      await Promise.all([first.end(), second.end()]);
    }
  }
});
