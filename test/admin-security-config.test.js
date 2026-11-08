'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const auth = require('../middleware/adminAuth');

test('legacy shared admin authentication fails closed without a configured bcrypt hash', async () => {
  const previous = {
    username: process.env.ADMIN_USERNAME,
    legacyUsername: process.env.ADMIN_USER,
    hash: process.env.ADMIN_PASSWORD_HASH,
    plaintext: process.env.ADMIN_PASSWORD
  };
  process.env.ADMIN_USERNAME = 'security-test-admin';
  delete process.env.ADMIN_USER;
  delete process.env.ADMIN_PASSWORD_HASH;
  process.env.ADMIN_PASSWORD = 'plaintext-must-not-be-accepted';
  try {
    assert.equal(await auth.adminCredentialsValid('security-test-admin', 'plaintext-must-not-be-accepted'), false);
  } finally {
    for (const [key, value] of Object.entries({
      ADMIN_USERNAME: previous.username,
      ADMIN_USER: previous.legacyUsername,
      ADMIN_PASSWORD_HASH: previous.hash,
      ADMIN_PASSWORD: previous.plaintext
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('production sessions require a configured secret and use secure cookies', () => {
  const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
  assert.match(server, /if\(isProduction&&!configuredSessionSecret\)throw new Error/);
  assert.match(server, /secure:isProduction/);
  assert.match(server, /httpOnly:true/);
  assert.match(server, /sameSite:"lax"/);
  assert.doesNotMatch(server, /faz_network_super_secret_session_2026/);
});

test('production PostgreSQL TLS verifies certificates and the global bypass is absent', () => {
  const db = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
  const syncDb = fs.readFileSync(path.join(__dirname, '..', 'sync_db.js'), 'utf8');
  const localEnv = fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8');
  assert.match(db, /rejectUnauthorized:\s*true/);
  assert.doesNotMatch(db, /rejectUnauthorized:\s*false/);
  assert.match(syncDb, /rejectUnauthorized:\s*true/);
  assert.doesNotMatch(syncDb, /rejectUnauthorized:\s*false/);
  assert.doesNotMatch(syncDb, /connectionString:\s*['"][^'"]+@/);
  assert.match(syncDb, /SYNC_DB_ALLOW_TRUNCATE/);
  assert.doesNotMatch(localEnv, /^\s*NODE_TLS_REJECT_UNAUTHORIZED\s*=/m);
});
