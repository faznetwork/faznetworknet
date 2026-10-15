'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const mikrotik = require('../services/mikrotikService');

test('Customer 360 live status fails closed when RouterOS queue is busy', async () => {
  const originalPending = mikrotik._operationPendingCount;
  try {
    mikrotik._operationPendingCount = 1;
    const result = await mikrotik.getCustomerLiveStatus('customer-360-test', 'AA:BB:CC:DD:EE:FF');
    assert.equal(result.online, false);
    assert.equal(result.live_sync, 'timeout');
    assert.equal(result.mac, 'AA:BB:CC:DD:EE:FF');
    assert.equal(result.stale, true);
  } finally {
    mikrotik._operationPendingCount = originalPending;
  }
});

test('Customer 360 live status uses a fresh cache without another RouterOS query', async () => {
  const username = 'customer-360-cache-test';
  const key = username.toLowerCase();
  const original = mikrotik._customerLiveCache.get(key);
  const value = {
    status: 'online',
    isLive: true,
    online: true,
    ip: '10.20.0.123',
    mac: 'AA:BB:CC:DD:EE:FF',
    uptime: '1m',
    bytesIn: '100',
    bytesOut: '200',
    traffic: { bytesIn: 100, bytesOut: 200 },
    stale: false,
    live_sync: 'ok'
  };
  try {
    mikrotik._customerLiveCache.set(key, { at: Date.now(), value });
    const result = await mikrotik.getCustomerLiveStatus(username);
    assert.equal(result.online, true);
    assert.equal(result.live_sync, 'cached');
    assert.equal(result.ip, '10.20.0.123');
  } finally {
    if (original) mikrotik._customerLiveCache.set(key, original);
    else mikrotik._customerLiveCache.delete(key);
  }
});

test('Customer 360 live status uses a timeout fallback while circuit breaker is open', async () => {
  const originalUntil = mikrotik._customerLiveCircuitOpenUntil;
  const key = 'customer-360-circuit-test';
  const originalCache = mikrotik._customerLiveCache.get(key);
  try {
    mikrotik._customerLiveCache.delete(key);
    mikrotik._customerLiveCircuitOpenUntil = Date.now() + 1000;
    const result = await mikrotik.getCustomerLiveStatus(key);
    assert.equal(result.online, false);
    assert.equal(result.live_sync, 'timeout');
  } finally {
    mikrotik._customerLiveCircuitOpenUntil = originalUntil;
    if (originalCache) mikrotik._customerLiveCache.set(key, originalCache);
    else mikrotik._customerLiveCache.delete(key);
  }
});
