'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

test('device credential encryption uses authenticated AES-256-GCM and never stores plaintext', () => {
  const previous = process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY;
  process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
  try {
    const { encrypt, decrypt } = require('../services/deviceCredentials');
    const password = 'olt-test-password-1101';
    const stored = encrypt(password);
    assert.equal(typeof stored, 'string');
    assert.notEqual(stored, password);
    const parts = stored.split('.');
    assert.equal(parts.length, 3);
    assert.equal(Buffer.from(parts[0], 'base64').length, 12);
    assert.equal(Buffer.from(parts[1], 'base64').length, 16);
    assert.ok(Buffer.from(parts[2], 'base64').length > 0);
    assert.equal(decrypt(stored), password);
    const tampered = parts.slice();
    tampered[2] = Buffer.from('tampered').toString('base64');
    assert.throws(() => decrypt(tampered.join('.')));
  } finally {
    if (previous === undefined) delete process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY = previous;
  }
});

test('device credential encryption refuses to store passwords without a configured key', () => {
  const previous = process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY;
  const previousOlt = process.env.OLT_CREDENTIALS_ENCRYPTION_KEY;
  delete process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY;
  delete process.env.OLT_CREDENTIALS_ENCRYPTION_KEY;
  try {
    const { encrypt } = require('../services/deviceCredentials');
    assert.throws(() => encrypt('secret'), /DEVICE_CREDENTIALS_ENCRYPTION_KEY/);
  } finally {
    if (previous === undefined) delete process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY = previous;
    if (previousOlt === undefined) delete process.env.OLT_CREDENTIALS_ENCRYPTION_KEY;
    else process.env.OLT_CREDENTIALS_ENCRYPTION_KEY = previousOlt;
  }
});
