'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const db = require('../db');
const mikrotikService = require('../services/mikrotikService');
const credentials = require('../services/deviceCredentials');

function restoreEnv(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

test('MikroTik config resolves the sole active native API router dynamically', async () => {
  const originalQuery = db.query;
  const oldKey = process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY;
  const oldCache = mikrotikService._configCache;
  const oldCacheUntil = mikrotikService._configCacheUntil;
  process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM router_devices')) {
      return { rows: [{
        id: 7, host: '103.54.37.182', api_type: 'native_api', api_port: 1039,
        username: 'smsbot', password_encrypted: credentials.encrypt('router-secret'),
        status: 'online', is_active: true
      }] };
    }
    throw new Error('Unexpected SQL in router config test: ' + sql);
  };
  mikrotikService.invalidateConfigCache();
  try {
    assert.deepEqual(await mikrotikService._getConfig(), {
      host: '103.54.37.182', port: 1039, user: 'smsbot', password: 'router-secret'
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /api_type='native_api'/);
    assert.match(calls[0].sql, /is_active=TRUE/);
    assert.match(calls[0].sql, /ORDER BY id ASC LIMIT 2/);
    assert.equal(calls[0].sql.includes('10.10.10.1'), false);
    assert.equal(calls.some(call => call.sql.includes('app_settings')), false);
  } finally {
    db.query = originalQuery;
    restoreEnv('DEVICE_CREDENTIALS_ENCRYPTION_KEY', oldKey);
    mikrotikService._configCache = oldCache;
    mikrotikService._configCacheUntil = oldCacheUntil;
  }
});

test('MikroTik config fails closed when no active native API router exists', async () => {
  const originalQuery = db.query;
  const oldCache = mikrotikService._configCache;
  const oldCacheUntil = mikrotikService._configCacheUntil;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [] };
  };
  mikrotikService.invalidateConfigCache();
  try {
    await assert.rejects(mikrotikService._getConfig(), /No active native API router is configured/);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /FROM router_devices/);
    assert.equal(calls[0].sql.includes('10.10.10.1'), false);
    assert.equal(calls[0].sql.includes('app_settings'), false);
  } finally {
    db.query = originalQuery;
    mikrotikService._configCache = oldCache;
    mikrotikService._configCacheUntil = oldCacheUntil;
  }
});

test('MikroTik config fails closed when multiple active native API routers exist', async () => {
  const originalQuery = db.query;
  const oldCache = mikrotikService._configCache;
  const oldCacheUntil = mikrotikService._configCacheUntil;
  db.query = async () => ({
    rows: [
      { id: 7, host: '103.54.37.182', api_port: 1039 },
      { id: 8, host: '192.0.2.8', api_port: 8728 }
    ]
  });
  mikrotikService.invalidateConfigCache();
  try {
    await assert.rejects(mikrotikService._getConfig(), error => {
      assert.equal(error.code, 'MULTIPLE_ACTIVE_ROUTERS');
      assert.equal(error.statusCode, 409);
      return true;
    });
  } finally {
    db.query = originalQuery;
    mikrotikService._configCache = oldCache;
    mikrotikService._configCacheUntil = oldCacheUntil;
  }
});

test('explicit unsaved connection config is validated without database fallback', async () => {
  const originalQuery = db.query;
  db.query = async () => { throw new Error('Explicit test config must not query PostgreSQL.'); };
  try {
    assert.deepEqual(await mikrotikService._getConfig({
      host: '103.54.37.182', port: 1039, user: 'test', password: 'secret'
    }), {
      host: '103.54.37.182', port: 1039, user: 'test', password: 'secret'
    });
    await assert.rejects(mikrotikService._getConfig({
      host: '103.54.37.182', port: 0, user: 'test', password: 'secret'
    }), /valid API port/);
  } finally {
    db.query = originalQuery;
  }
});

test('resolveActiveRouter uses an explicit persisted ID and never supplies a default router ID', async () => {
  const originalQuery = db.query;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    return { rows: [{
      id: 22, router_name: 'VPN POP', host: '103.54.37.182',
      api_type: 'native_api', api_port: 1039, is_active: true
    }] };
  };
  try {
    const router = await mikrotikService.resolveActiveRouter(22);
    assert.equal(String(router.id), '22');
    assert.deepEqual(calls[0].params, ['22']);
    assert.match(calls[0].sql, /WHERE id=\$1/);
    await assert.rejects(mikrotikService.resolveActiveRouter('0'), /positive integer router ID/);
    assert.equal(calls.length, 1);
  } finally {
    db.query = originalQuery;
  }
});

test('concurrent persistent connection requests share one RouterOS login handshake', async () => {
  const original = {
    connection: mikrotikService._connection,
    connectionKey: mikrotikService._connectionKey,
    connectionPromise: mikrotikService._connectionPromise,
    connectionPromiseKey: mikrotikService._connectionPromiseKey,
    createConnection: mikrotikService._createConnection,
    disableTimeout: mikrotikService._disableSocketInactivityTimeout,
    executeWithTimeout: mikrotikService._executeWithTimeout,
    startHeartbeat: mikrotikService._startHeartbeat
  };
  let handshakes = 0;
  const connection = {
    connected: true,
    connector: { socket: { setTimeout() {}, setKeepAlive() {} } },
    connect: () => new Promise(resolve => setTimeout(() => { handshakes++; resolve(); }, 20)),
    on() {},
    close() {}
  };
  mikrotikService._connection = null;
  mikrotikService._connectionKey = null;
  mikrotikService._connectionPromise = null;
  mikrotikService._connectionPromiseKey = null;
  mikrotikService._createConnection = () => connection;
  mikrotikService._disableSocketInactivityTimeout = () => true;
  mikrotikService._executeWithTimeout = promise => Promise.resolve(promise);
  mikrotikService._startHeartbeat = () => {};
  try {
    const config = { host: '192.0.2.10', port: 8728, user: 'test', password: 'test' };
    const connections = await Promise.all(Array.from({ length: 8 }, () => mikrotikService._getPersistentConnection(config)));
    assert.equal(handshakes, 1);
    assert.ok(connections.every(item => item === connection));
  } finally {
    if (mikrotikService._connection) {
      await mikrotikService._resetPersistentConnection(mikrotikService._connection, 'test complete');
    }
    mikrotikService._connection = original.connection;
    mikrotikService._connectionKey = original.connectionKey;
    mikrotikService._connectionPromise = original.connectionPromise;
    mikrotikService._connectionPromiseKey = original.connectionPromiseKey;
    mikrotikService._createConnection = original.createConnection;
    mikrotikService._disableSocketInactivityTimeout = original.disableTimeout;
    mikrotikService._executeWithTimeout = original.executeWithTimeout;
    mikrotikService._startHeartbeat = original.startHeartbeat;
  }
});
