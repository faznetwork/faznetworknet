'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const deploymentInfo = require('../services/deploymentInfo');

test('deployment metadata includes the expected fields and Dhaka timestamp', () => {
  const info = deploymentInfo.createDeploymentInfo({
    commitHash: 'a'.repeat(40),
    commitMessage: 'Render live console',
    date: new Date('2026-10-28T12:00:00.000Z')
  });
  assert.deepEqual(Object.keys(info), ['commitHash', 'commitMessage', 'deployedAt', 'status']);
  assert.equal(info.status, 'Live');
  assert.equal(info.deployedAt, '2026-10-28 18:00:00 +06:00');
});

test('deployment metadata is atomically written and read back', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'faz-deployment-info-'));
  const filePath = path.join(directory, 'deployment-info.json');
  try {
    const expected = deploymentInfo.createDeploymentInfo({
      commitHash: 'b'.repeat(40),
      commitMessage: 'Persist deployment status',
      date: new Date('2026-10-28T12:00:00.000Z')
    });
    deploymentInfo.writeDeploymentInfo(expected, filePath);
    assert.deepEqual(deploymentInfo.readDeploymentInfo(filePath), expected);
    assert.equal(fs.existsSync(filePath + '.tmp'), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('missing deployment metadata returns null without fabricating a Live status', () => {
  const filePath = path.join(os.tmpdir(), 'faz-deployment-info-missing-' + process.pid + '.json');
  assert.equal(deploymentInfo.readDeploymentInfo(filePath), null);
});

test('invalid deployment metadata fails explicitly', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'faz-deployment-info-invalid-'));
  const filePath = path.join(directory, 'deployment-info.json');
  try {
    fs.writeFileSync(filePath, JSON.stringify({ commitHash: 'bad', status: 'Live' }));
    assert.throws(() => deploymentInfo.readDeploymentInfo(filePath), /invalid commitHash/);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
