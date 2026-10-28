'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_METADATA_PATH = path.resolve(__dirname, '..', 'deployment-info.json');

function formatDhakaTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).reduce((result, part) => {
    if (part.type !== 'literal') result[part.type] = part.value;
    return result;
  }, {});
  return parts.year + '-' + parts.month + '-' + parts.day + ' ' +
    parts.hour + ':' + parts.minute + ':' + parts.second + ' +06:00';
}

function validateDeploymentInfo(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Deployment metadata must be a JSON object.');
  }
  if (typeof value.commitHash !== 'string' || !/^[a-f0-9]{7,40}$/i.test(value.commitHash)) {
    throw new TypeError('Deployment metadata has an invalid commitHash.');
  }
  if (typeof value.commitMessage !== 'string' || !value.commitMessage.trim()) {
    throw new TypeError('Deployment metadata has an invalid commitMessage.');
  }
  if (typeof value.deployedAt !== 'string' || !value.deployedAt.trim()) {
    throw new TypeError('Deployment metadata has an invalid deployedAt timestamp.');
  }
  if (value.status !== 'Live') {
    throw new TypeError('Deployment metadata status must be "Live".');
  }
  return Object.freeze({
    commitHash: value.commitHash,
    commitMessage: value.commitMessage,
    deployedAt: value.deployedAt,
    status: value.status
  });
}

function createDeploymentInfo({ commitHash, commitMessage, date = new Date() }) {
  return validateDeploymentInfo({
    commitHash: String(commitHash || '').trim(),
    commitMessage: String(commitMessage || '').trim(),
    deployedAt: formatDhakaTimestamp(date),
    status: 'Live'
  });
}

function readDeploymentInfo(filePath = DEFAULT_METADATA_PATH) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw new Error('Unable to read deployment metadata at ' + filePath + ': ' + error.message, { cause: error });
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error('Deployment metadata contains invalid JSON at ' + filePath + ': ' + error.message, { cause: error });
  }
  return validateDeploymentInfo(parsed);
}

function writeDeploymentInfo(info, filePath = DEFAULT_METADATA_PATH) {
  const validInfo = validateDeploymentInfo(info);
  const target = path.resolve(filePath);
  const temporary = target + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(validInfo, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  try {
    fs.renameSync(temporary, target);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') error.cleanupError = cleanupError;
    }
    throw new Error('Unable to persist deployment metadata at ' + target + ': ' + error.message, { cause: error });
  }
  return validInfo;
}

module.exports = Object.freeze({
  formatDhakaTimestamp,
  createDeploymentInfo,
  readDeploymentInfo,
  writeDeploymentInfo,
  validateDeploymentInfo
});
