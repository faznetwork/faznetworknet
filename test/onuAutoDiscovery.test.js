'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeMac, telemetryHasClientMac, selectUniqueTelemetryMatch } = require('../services/onuAutoDiscovery');
const { macFromIndex, parseVsolOnuPort, buildLearnedMacRows, buildReadings } = require('../scripts/olt-collector');

test('normalizes a router MAC without confusing it with ONU MAC', () => {
  assert.equal(normalizeMac('30:07:5C:73:39:AB'), '30:07:5c:73:39:ab');
  assert.equal(normalizeMac('30-07-5c-73-39-ab'), '30:07:5c:73:39:ab');
  assert.equal(normalizeMac('not-a-mac'), null);
});

test('selects only a unique ONU telemetry row containing the learned router MAC', () => {
  const row = { onuMac: 'aa:bb:cc:dd:ee:ff', onuId: 'EPON0/1:3', ponPort: 'EPON0/1', raw: { clientMacs: ['30:07:5c:73:39:ab'] } };
  assert.equal(telemetryHasClientMac(row, '30:07:5C:73:39:AB'), true);
  assert.deepEqual(selectUniqueTelemetryMatch([row], '30:07:5c:73:39:ab'), { status: 'matched', telemetry: row, count: 1 });
  assert.equal(selectUniqueTelemetryMatch([], '30:07:5c:73:39:ab').status, 'not_found');
  assert.equal(selectUniqueTelemetryMatch([row, { ...row, onuId: 'EPON0/2:4' }], '30:07:5c:73:39:ab').status, 'ambiguous');
});

test('decodes V-SOL MAC-index suffix and only maps recognized PON/ONU port formats', () => {
  assert.equal(macFromIndex('6.48.7.92.115.57.171'), '30:07:5c:73:39:ab');
  assert.deepEqual(parseVsolOnuPort('EPON0/1:3'), { ponPort: 'EPON0/1', onuId: 'EPON0/1:3' });
  assert.deepEqual(parseVsolOnuPort('PON 2 ONU 9'), { ponPort: 'EPON0/2', onuId: 'EPON0/2:9' });
  assert.equal(parseVsolOnuPort('opaque-port-bytes'), null);
});

test('builds clientMacs only from dynamic MAC table entries with a recognized ONU port', () => {
  const base = '1.3.6.1.4.1.37950.1.1.5.10.3.8.1.';
  const learned = buildLearnedMacRows({
    macRows: [{ oid: base + '1.6.48.7.92.115.57.171', value: Buffer.from([0x30,0x07,0x5c,0x73,0x39,0xab]) }],
    typeRows: [{ oid: base + '3.6.48.7.92.115.57.171', value: 1 }],
    portRows: [{ oid: base + '4.6.48.7.92.115.57.171', value: Buffer.from('EPON0/1:3') }]
  });
  assert.deepEqual(learned, [{ mac: '30:07:5c:73:39:ab', type: '1', port: 'EPON0/1:3' }]);
  const readings = buildReadings({
    macRows: [{ oid: '1.3.6.1.4.1.37950.1.1.5.12.1.1.2.1.3', value: Buffer.from([0x00,0x11,0x22,0x33,0x44,0x55]) }],
    rxRows: [], txRows: [], learnedMacRows: learned
  });
  assert.deepEqual(readings[0].raw.clientMacs, ['30:07:5c:73:39:ab']);
});
