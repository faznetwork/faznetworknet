'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const mikrotik=require('../services/mikrotikService');

test('pool matcher supports RouterOS ranges, CIDR and single IP',()=>{
  assert.equal(mikrotik.ipMatchesPoolRange('10.0.0.20','10.0.0.10-10.0.0.30'),true);
  assert.equal(mikrotik.ipMatchesPoolRange('10.0.0.31','10.0.0.10-10.0.0.30'),false);
  assert.equal(mikrotik.ipMatchesPoolRange('192.168.10.9','192.168.10.0/24'),true);
  assert.equal(mikrotik.ipMatchesPoolRange('192.168.11.9','192.168.10.0/24'),false);
  assert.equal(mikrotik.ipMatchesPoolRange('192.168.1.1','192.168.1.1'),true);
  assert.equal(mikrotik.ipMatchesPoolRange('999.1.1.1','0.0.0.0/0'),false);
});

test('pool resolver handles comma-separated ranges and no match',()=>{
  assert.equal(mikrotik.resolvePoolFromRanges('10.10.0.42',[{name:'customers-a',ranges:'10.10.0.1-10.10.0.20, 10.10.0.40-10.10.0.60'}]),'customers-a');
  assert.equal(mikrotik.resolvePoolFromRanges('10.11.0.42',[{name:'customers-a',ranges:'10.10.0.1-10.10.0.20'}]),null);
});
