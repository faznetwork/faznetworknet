'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig, classifyError } = require('../services/routerDeviceService');

test('accepts IPv4 native API defaults', () => {
  const config = validateConfig({ host: '10.20.0.1', username: 'admin', password: 'secret', api_type: 'native_api' });
  assert.equal(config.port, 8728);
  assert.equal(config.apiType, 'native_api');
  assert.equal(config.host, '10.20.0.1');
});

test('accepts DNS host and REST HTTPS default port', () => {
  const config = validateConfig({ host: 'router.example.net', username: 'api', password: 'secret', api_type: 'rest_api' });
  assert.equal(config.port, 443);
  assert.equal(config.useSsl, true);
});

test('rejects malformed IPv4, URL and invalid API port', () => {
  assert.throws(() => validateConfig({ host: '999.1.1.1', username: 'a', password: 'b' }));
  assert.throws(() => validateConfig({ host: 'https://router.example.net', username: 'a', password: 'b' }));
  assert.throws(() => validateConfig({ host: '10.0.0.1', username: 'a', password: 'b', api_type: 'native_api', api_port: 443 }));
});

test('classifies auth failures and connection refused distinctly', () => {
  assert.equal(classifyError(Object.assign(new Error('Authentication failed'), { code: 'EAUTH' })).status, 'auth_failed');
  assert.equal(classifyError(Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' })).code, 'CONNECTION_REFUSED');
});
