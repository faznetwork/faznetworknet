'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

function mockModule(relativePath, exports) {
  const id = require.resolve(relativePath);
  require.cache[id] = { id, filename: id, loaded: true, exports };
}

mockModule('../db', { query: async () => ({ rows: [] }), withTransaction: async fn => fn({ query: async () => ({ rows: [] }) }) });
mockModule('../services/deviceCredentials', { encrypt: value => value, decrypt: value => value });
mockModule('../services/routerDeviceService', { testConnection: async () => ({ status: 'online', identity: 'edge-router' }) });
mockModule('../services/mikrotikService', {
  runtimePool: { invalidate: async () => ({ invalidated: false }), replace: async () => ({}) },
  invalidateConfigCache: () => {}
});

const controller = require('../controllers/routerDeviceController');
const validInput = { router_name: 'edge-router', host: '192.0.2.10', api_port: 8728, username: 'api', password: 'secret' };

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
  require('../services/routerDeviceService').testConnection = async () => { throw failure; };
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

test('successful RouterOS test remains an online success response', async () => {
  require('../services/routerDeviceService').testConnection = async () => ({
    status: 'online', identity: 'edge-router', api_type: 'native_api'
  });
  const res = response();
  await controller.testConnection({ body: validInput }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.status, 'online');
});
