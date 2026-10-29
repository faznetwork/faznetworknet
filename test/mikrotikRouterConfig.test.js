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

test('MikroTik config reads only the active canonical router record and decrypts its credential', async () => {
  const originalQuery = db.query;
  const oldKey = process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY;
  const oldCache = mikrotikService._configCache;
  const oldCacheUntil = mikrotikService._configCacheUntil;
  const key = crypto.randomBytes(32).toString('hex');
  process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY = key;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM router_devices WHERE host=') && sql.includes("host='10.10.10.1'")) {
      return { rows: [{ id: 7, host: '10.10.10.1', api_type: 'native_api', api_port: 8728, username: 'smsbot', password_encrypted: credentials.encrypt('router-secret'), status: 'online', is_active: true }] };
    }
    if (sql.includes('app_settings')) throw new Error('Router configuration must not read or mirror legacy plaintext settings.');
    throw new Error('Unexpected SQL in router config test: ' + sql);
  };
  mikrotikService.invalidateConfigCache();
  try {
    assert.deepEqual(await mikrotikService._getConfig(), {
      host: '10.10.10.1', port: 8728, user: 'smsbot', password: 'router-secret'
    });
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /FROM router_devices/);
    assert.match(calls[0].sql, /password_encrypted/);
    assert.match(calls[0].sql, /LIMIT 2/);
    assert.equal(calls.some(call => call.sql.includes('app_settings')), false);
    assert.equal(calls[0].params, undefined);
  } finally {
    db.query = originalQuery;
    restoreEnv('DEVICE_CREDENTIALS_ENCRYPTION_KEY', oldKey);
    mikrotikService._configCache = oldCache;
    mikrotikService._configCacheUntil = oldCacheUntil;
  }
});

test('MikroTik remains unavailable when no canonical router is active; legacy settings cannot activate one', async () => {
  const originalQuery = db.query;
  const oldCache = mikrotikService._configCache;
  const oldCacheUntil = mikrotikService._configCacheUntil;
  const calls = [];
  db.query = async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('FROM router_devices WHERE host=') && sql.includes("host='10.10.10.1'")) return { rows: [] };
    if (sql.includes('app_settings')) throw new Error('Legacy settings must not activate an unregistered router.');
    throw new Error('Unexpected SQL in router config test: ' + sql);
  };
  mikrotikService.invalidateConfigCache();
  try {
    await assert.rejects(mikrotikService._getConfig(), /Expected exactly one active canonical router at 10\.10\.10\.1:8728/);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].sql.includes('FROM router_devices'), true);
    assert.equal(calls.some(call => call.sql.includes('app_settings')), false);
  } finally {
    db.query = originalQuery;
    mikrotikService._configCache = oldCache;
    mikrotikService._configCacheUntil = oldCacheUntil;
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
    if (mikrotikService._connection) mikrotikService._resetPersistentConnection(mikrotikService._connection, 'test complete');
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
