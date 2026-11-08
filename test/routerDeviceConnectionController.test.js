'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function mockModule(relativePath, exports) {
  const id = require.resolve(relativePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

const mockDb = {
  query: async () => ({ rows: [], rowCount: 0 }),
  withTransaction: async fn => fn({ query: async () => ({ rows: [], rowCount: 0 }) })
};
const routerService = {
  testConnection: async () => ({
    status: 'online', identity: 'edge-router', api_type: 'native_api',
    host: '192.0.2.10', api_port: 8728, use_ssl: false, latency_ms: 125
  })
};

mockModule('../db', mockDb);
mockModule('../services/deviceCredentials', { encrypt: value => value, decrypt: value => value });
mockModule('../services/routerDeviceService', routerService);
mockModule('../services/mikrotikService', {
  runtimePool: { invalidate: async () => ({ invalidated: false }), replace: async () => ({}) },
  invalidateConfigCache: () => {}
});

const controller = require('../controllers/routerDeviceController');
const validInput = { router_name: 'edge-router', host: '192.0.2.10', api_port: 8728, username: 'api', password: 'secret', timeout: 5000 };

function response() {
  return {
    statusCode: 200,
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test('unreachable RouterOS test returns structured JSON without a 503', async () => {
  const failure = Object.assign(new Error('Router did not respond within 5 seconds.'), {
    statusCode: 503,
    routerStatus: 'offline',
    errorCode: 'TIMEOUT',
    protocolDiagnostics: ['Native API: connection timed out']
  });
  routerService.testConnection = async () => { throw failure; };
  const res = response();
  await controller.testConnection({ body: validInput }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, false);
  assert.equal(res.body.status, 'unreachable');
  assert.equal(res.body.code, 'TIMEOUT');
  assert.deepEqual(res.body.protocolDiagnostics, failure.protocolDiagnostics);
});

test('invalid RouterOS test input remains a structured 400 response', async () => {
  const res = response();
  await controller.testConnection({ body: { router_name: 'edge-router' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.status, 'invalid');
});

test('custom RouterOS API ports default to native_api when the modal omits api_type', async () => {
  let received;
  routerService.testConnection = async input => {
    received = input;
    return {
      status: 'online', identity: 'edge-router', api_type: 'native_api',
      host: input.host, api_port: input.api_port, use_ssl: false
    };
  };
  const res = response();
  await controller.testConnection({ body: { ...validInput, api_port: 1039 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(received.api_type, 'native_api');
});

test('successful RouterOS test returns a short-lived save verification token', async () => {
  routerService.testConnection = async () => ({
    status: 'online', identity: 'edge-router', api_type: 'native_api',
    host: '192.0.2.10', api_port: 8728, use_ssl: false
  });
  const res = response();
  await controller.testConnection({ body: validInput }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.status, 'online');
  assert.equal(typeof res.body.verification_token, 'string');
  assert.ok(res.body.verification_token.length >= 32);
});

test('editing reuses the successful tested handshake instead of opening a second router connection', async () => {
  let handshakeCalls = 0;
  routerService.testConnection = async () => {
    handshakeCalls += 1;
    return {
      status: 'online', identity: 'edge-router', api_type: 'native_api',
      host: '192.0.2.10', api_port: 8728, use_ssl: false,
      board_model: 'RB4011iGS+', ros_version: '7.24.4', cpu_load: 1
    };
  };

  const testRes = response();
  await controller.testConnection({ body: validInput }, testRes);
  const token = testRes.body.verification_token;
  assert.ok(token);

  const existing = {
    id: 3, router_name: 'edge-router', host: '192.0.2.10', api_type: 'native_api',
    api_port: 8728, username: 'api', password_encrypted: 'secret',
    use_ssl: false, timeout_ms: 5000, is_active: false
  };
  mockDb.query = async () => ({ rows: [existing], rowCount: 1 });
  mockDb.withTransaction = async fn => fn({
    query: async sql => {
      if (sql.includes('SELECT id,router_name,host,api_type,api_port FROM router_devices')) {
        return { rows: [existing], rowCount: 1 };
      }
      if (sql.includes('SELECT id FROM router_devices WHERE id<>')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('UPDATE router_devices SET router_name=')) {
        return {
          rows: [{
            ...existing, router_name: 'edge-router', status: 'online',
            last_synced: new Date().toISOString(), board_model: 'RB4011iGS+',
            ros_version: '7.24.4', cpu_load: 1, identity: 'edge-router',
            created_at: new Date().toISOString()
          }],
          rowCount: 1
        };
      }
      if (sql.includes('SELECT id FROM network_devices')) return { rows: [], rowCount: 0 };
      throw new Error('Unexpected mocked SQL in updateDevice: ' + sql);
    }
  });

  const saveRes = response();
  await controller.updateDevice({
    params: { id: '3' },
    body: { ...validInput, verification_token: token }
  }, saveRes);

  assert.equal(saveRes.statusCode, 200);
  assert.equal(saveRes.body.success, true);
  assert.equal(saveRes.body.saved, true);
  assert.equal(handshakeCalls, 1, 'the successful test is the only RouterOS handshake for this save');
});

test('a changed setting cannot consume a connection test result for the old settings', async () => {
  routerService.testConnection = async () => ({
    status: 'online', identity: 'edge-router', api_type: 'native_api',
    host: '192.0.2.10', api_port: 8728, use_ssl: false
  });
  const testRes = response();
  await controller.testConnection({ body: validInput }, testRes);
  mockDb.query = async () => ({
    rows: [{
      id: 3, router_name: 'edge-router', host: '192.0.2.10', api_type: 'native_api',
      api_port: 8728, username: 'api', password_encrypted: 'secret',
      use_ssl: false, timeout_ms: 5000, is_active: false
    }],
    rowCount: 1
  });
  const saveRes = response();
  await controller.updateDevice({
    params: { id: '3' },
    body: { ...validInput, host: '192.0.2.11', verification_token: testRes.body.verification_token }
  }, saveRes);
  assert.equal(saveRes.statusCode, 409);
  assert.equal(saveRes.body.code, 'CONNECTION_TEST_REQUIRED');
});
