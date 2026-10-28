'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
// Keep test credentials out of CI output; logger capture is still exercised via the wrapper.
console.log = () => {};
const logger = require('../services/liveLogger');

test('live logger bounds history to the latest 100 entries', () => {
  const marker = 'live-logger-buffer-test-' + Date.now();
  for (let index = 0; index < 105; index += 1) console.log(marker, index);
  const recent = logger.getRecentLogs();
  assert.equal(recent.length, logger.getBufferLimit());
  assert.match(recent[recent.length - 1].message, /104$/);
  assert.doesNotMatch(recent[0].message, /0$/);
});

test('live logger redacts common credentials before storing entries', () => {
  const marker = 'live-logger-redaction-test-' + Date.now();
  console.log(marker, 'password=very-secret session=abc123 Authorization: Bearer abc.def', JSON.stringify({ password: 'json-password', token: 'json-token' }));
  const entry = logger.getRecentLogs().at(-1);
  assert.match(entry.message, /password=\[REDACTED\]/i);
  assert.match(entry.message, /session=\[REDACTED\]/i);
  assert.match(entry.message, /Authorization:\s*\[REDACTED\]/i);
  assert.doesNotMatch(entry.message, /very-secret|abc123|abc\.def|json-password|json-token/);
});

test('live logger subscriptions receive entries and can be removed', () => {
  const marker = 'live-logger-subscription-test-' + Date.now();
  const received = [];
  const unsubscribe = logger.subscribe(entry => received.push(entry));
  console.log(marker);
  unsubscribe();
  console.log('after-unsubscribe-' + marker);
  assert.equal(received.length, 1);
  assert.match(received[0].message, new RegExp(marker));
});
