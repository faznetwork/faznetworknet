'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { validateConfig, classifyError, encodeLength, decodeLength, encodeSentence, decodeSentences } = require('../services/routerDeviceService');

function valid(overrides = {}) {
  return { router_name: 'Core-RB4011', host: 'router.example.net', api_port: 19443, username: 'api-user', password: 'secret', timeout: 5000, ...overrides };
}

test('accepts custom forwarded ports and DNS hostnames without protocol selection', () => {
  const config = validateConfig(valid());
  assert.equal(config.port, 19443);
  assert.equal(config.host, 'router.example.net');
  assert.equal(config.timeout, 5000);
  assert.equal(Object.hasOwn(config, 'apiType'), false);
});

test('accepts IPv4 and any valid port from 1 through 65535', () => {
  assert.equal(validateConfig(valid({ host: '10.20.0.1', api_port: 1 })).port, 1);
  assert.equal(validateConfig(valid({ host: '203.0.113.5', api_port: 65535 })).port, 65535);
});

test('rejects malformed hosts, URLs, and ports outside the valid range', () => {
  assert.throws(() => validateConfig(valid({ host: '999.1.1.1' })), /IPv4/i);
  assert.throws(() => validateConfig(valid({ host: 'https://router.example.net' })), /IPv4|hostname/i);
  assert.throws(() => validateConfig(valid({ api_port: 0 })), /1 and 65535/i);
  assert.throws(() => validateConfig(valid({ api_port: 65536 })), /1 and 65535/i);
  assert.throws(() => validateConfig(valid({ api_port: 8728.5 })), /integer/i);
});

test('classifies authentication, unreachable port, and timeout errors with stable codes', () => {
  assert.equal(classifyError(Object.assign(new Error('Authentication failed'), { code: 'EAUTH' })).code, 'INVALID_CREDENTIALS');
  assert.equal(classifyError(Object.assign(new Error('Connection refused'), { code: 'ECONNREFUSED' })).code, 'PORT_UNREACHABLE');
  assert.equal(classifyError(Object.assign(new Error('RouterOS request timed out'), { code: 'ETIMEDOUT' })).code, 'TIMEOUT');
});

test('encodes and decodes RouterOS variable-length sentence words', () => {
  for (const length of [0, 1, 127, 128, 16383, 16384, 2097151, 2097152]) {
    const encoded = encodeLength(length);
    const decoded = decodeLength(encoded, 0);
    assert.equal(decoded.length, length);
    assert.equal(decoded.bytes, encoded.length);
  }
  const sentence = encodeSentence(['/login', '=name=api', '=password=secret']);
  const decoded = decodeSentences(sentence);
  assert.deepEqual(decoded.sentences, [['/login', '=name=api', '=password=secret']]);
  assert.equal(decoded.remaining.length, 0);
});

test('rejects missing credentials and enforces a maximum five-second timeout', () => {
  assert.throws(() => validateConfig(valid({ password: '' })), /password/i);
  assert.throws(() => validateConfig(valid({ timeout: 6000 })), /5000/i);
});
