'use strict';
const crypto = require('node:crypto');
function getKey() {
  const raw = String(process.env.DEVICE_CREDENTIALS_ENCRYPTION_KEY || process.env.OLT_CREDENTIALS_ENCRYPTION_KEY || '').trim();
  if (!raw) throw Object.assign(new Error('Configure DEVICE_CREDENTIALS_ENCRYPTION_KEY in the service environment before saving OLT passwords.'), { statusCode: 503 });
  if (/^[a-f0-9]{64}$/i.test(raw)) return Buffer.from(raw, 'hex');
  const decoded = Buffer.from(raw, 'base64');
  if (decoded.length === 32) return decoded;
  throw Object.assign(new Error('Device credential encryption key must be 32 bytes, encoded as 64 hex characters or base64.'), { statusCode: 503 });
}
function encrypt(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const data = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join('.');
}
function decrypt(value) {
  if (value === null || value === undefined || value === '') return '';
  const parts = String(value).split('.');
  if (parts.length !== 3) throw new Error('Stored device credential has an invalid format.');
  const [ivText, tagText, encryptedText] = parts;
  const iv = Buffer.from(ivText, 'base64');
  const tag = Buffer.from(tagText, 'base64');
  const encrypted = Buffer.from(encryptedText, 'base64');
  if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) {
    throw new Error('Stored device credential has an invalid format.');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
module.exports = { encrypt, decrypt };
