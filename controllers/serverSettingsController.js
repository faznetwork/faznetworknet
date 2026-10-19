'use strict';

const crypto = require('crypto');
const db = require('../db');

const TOKEN_HASH_KEY = 'master_webhook_token_hash';

function maskSetting(key, value, isSecret) {
  const secret = Boolean(isSecret) || /secret|token|password|private.?key|credential/i.test(String(key || ''));
  const raw = value == null ? '' : String(value);
  const result = { key: String(key || ''), value: secret && raw ? '••••••••••••••••' : raw, isSecret: secret };
  if (secret) result.configured = Boolean(raw);
  return result;
}

async function listSettings(req, res) {
  try {
    const result = await db.query('SELECT key, value, is_secret, updated_at FROM system_server_settings ORDER BY key ASC');
    const settings = (result.rows || []).map(row => ({
      ...maskSetting(row.key, row.value, row.is_secret),
      updatedAt: row.updated_at || null
    }));
    res.set('Cache-Control', 'no-store, private');
    return res.json({ success: true, settings });
  } catch (error) {
    console.error('[Server Settings] Failed to list settings:', error.message);
    return res.status(503).json({ success: false, message: 'Server settings are unavailable. Confirm the server-settings database migration has been applied.' });
  }
}

async function generateToken(req, res) {
  try {
    // 32 random bytes (256 bits); plaintext is returned once and never persisted.
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    await db.query(
      `INSERT INTO system_server_settings (key, value, is_secret, updated_at)
       VALUES ($1, $2, TRUE, NOW())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, is_secret = TRUE, updated_at = NOW()`,
      [TOKEN_HASH_KEY, tokenHash]
    );
    res.set('Cache-Control', 'no-store, private');
    return res.status(201).json({ success: true, token, message: 'Token generated. Copy it now; the plaintext will not be shown again.' });
  } catch (error) {
    console.error('[Server Settings] Token generation failed:', error.message);
    return res.status(503).json({ success: false, message: 'Could not generate the token. Confirm the server-settings database migration has been applied.' });
  }
}

module.exports = { listSettings, generateToken };
