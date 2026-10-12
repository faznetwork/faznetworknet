'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMac, telemetryLastSeen, isTelemetryStale, matchTelemetryIdentity } = require('../lib/network/oltTelemetryFreshness');

test('normalizes MAC addresses case-insensitively and accepts hyphen separators', () => {
  assert.equal(normalizeMac('AA-BB-CC-DD-EE-FF'), 'aa:bb:cc:dd:ee:ff');
  assert.equal(normalizeMac('aa:bb:cc:dd:ee:ff'), 'aa:bb:cc:dd:ee:ff');
  assert.equal(normalizeMac('not-a-mac'), null);
});

test('matches ONU telemetry to saved ONU MAC or PPPoE caller-id when username is null', () => {
  const telemetry = { pppoeUsername: null, onuMac: 'AA:BB:CC:DD:EE:FF' };
  assert.equal(matchTelemetryIdentity({ username: 'subscriber1', onuMac: 'aa-bb-cc-dd-ee-ff', callerId: '00:00:00:00:00:01' }, telemetry), 'customer_onu_mac');
  assert.equal(matchTelemetryIdentity({ username: 'subscriber1', onuMac: null, callerId: 'aa-bb-cc-dd-ee-ff' }, telemetry), 'pppoe_caller_id');
  assert.equal(matchTelemetryIdentity({ username: 'subscriber1', onuMac: null, callerId: null }, telemetry), null);
});

test('does not match unrelated telemetry by PPPoE username alone', () => {
  assert.equal(matchTelemetryIdentity({ onuMac: null, callerId: null }, { pppoeUsername: 'subscriber1', onuMac: '22:22:22:22:22:22' }), null);
});

test('marks telemetry stale from observedAt after 15 minutes even if recently received', () => {
  const now = Date.parse('2026-10-12T12:00:00Z');
  const item = { observedAt: '2026-10-12T11:40:00Z', receivedAt: '2026-10-12T11:59:30Z' };
  assert.equal(telemetryLastSeen(item), item.observedAt);
  assert.equal(isTelemetryStale(item, now), true);
  assert.equal(isTelemetryStale({ observedAt: '2026-10-12T11:55:00Z' }, now), false);
  assert.equal(isTelemetryStale({}, now), true);
});