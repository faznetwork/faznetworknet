'use strict';

const crypto = require('crypto');
const db = require('../db');

const SECRET_KEYS = new Set([
  'master_webhook_token_hash',
  'android_sms_gateway_token_hash',
  'mikrotik_core_password'
]);
const EDITABLE_SETTINGS = new Set([
  'mikrotik_core_host',
  'mikrotik_core_api_port',
  'mikrotik_core_username',
  'mikrotik_core_password'
]);

function maskSetting(key, value, isSecret) {
  const secret = Boolean(isSecret) || SECRET_KEYS.has(String(key || '')) || /secret|token|password|private.?key|credential/i.test(String(key || ''));
  const raw = value == null ? '' : String(value);
  const result = { key: String(key || ''), value: secret && raw ? '••••••••••••••••' : raw, isSecret: secret };
  if (secret) result.configured = Boolean(raw);
  return result;
}

async function audit(client, req, action, settingKey, details = {}) {
  await client.query(
    'INSERT INTO server_settings_audit (actor_id, actor_label, action, setting_key, details) VALUES ($1, $2, $3, $4, $5::jsonb)',
    [req.session?.userId || null, String(req.session?.adminUser || 'super_admin'), action, settingKey || null, JSON.stringify(details)]
  );
}

async function listSettings(req, res) {
  try {
    const result = await db.query('SELECT setting_key, setting_value, is_secret, updated_at FROM public.system_server_settings ORDER BY setting_key ASC');
    const settings = (result.rows || []).map(row => ({
      ...maskSetting(row.setting_key, row.setting_value, row.is_secret),
      updatedAt: row.updated_at || null
    }));
    res.set('Cache-Control', 'no-store, private');
    return res.json({ success: true, settings });
  } catch (error) {
    console.error('[Server Settings] Failed to list settings:', error.message);
    return res.status(503).json({ success: false, message: 'Server settings are unavailable. Check the platform settings schema and database role.' });
  }
}

async function generateToken(req, res, key = 'master_webhook_token_hash') {
  const client = await db.getPool().connect().catch(error => {
    console.error('[Server Settings] Database connection failed:', error.message);
    return null;
  });
  if (!client) return res.status(503).json({ success: false, message: 'Database connection unavailable.' });
  try {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO public.system_server_settings (setting_key, setting_value, is_secret, updated_at, updated_by)
       VALUES ($1, $2, TRUE, NOW(), $3)
       ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value, is_secret = TRUE, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
      [key, tokenHash, req.session?.userId || null]
    );
    await audit(client, req, 'token_generated', key);
    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store, private');
    return res.status(201).json({ success: true, token, message: 'Token generated. Copy it now; plaintext is shown once.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[Server Settings] Token generation failed:', error.message);
    return res.status(503).json({ success: false, message: 'Token write failed. See server log for the exact PostgreSQL error.' });
  } finally {
    client.release();
  }
}

async function generateMasterToken(req, res) {
  return generateToken(req, res, 'master_webhook_token_hash');
}
async function generateAndroidToken(req, res) {
  return generateToken(req, res, 'android_sms_gateway_token_hash');
}

async function saveCoreSettings(req, res) {
  const input = req.body && typeof req.body === 'object' ? req.body : {};
  const entries = Object.entries(input).filter(([key]) => EDITABLE_SETTINGS.has(key));
  if (!entries.length) return res.status(400).json({ success: false, message: 'No supported core settings supplied.' });
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    for (const [key, raw] of entries) {
      if (key === 'mikrotik_core_api_port') {
        const port = Number(raw);
        if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('MikroTik API port must be between 1 and 65535.');
      }
      // Blank secret fields mean retain the existing password, never clear it accidentally.
      if (key === 'mikrotik_core_password' && !String(raw || '')) continue;
      await client.query(
        `INSERT INTO public.system_server_settings(setting_key, setting_value, is_secret, updated_at, updated_by)
         VALUES ($1, $2, $3, NOW(), $4)
         ON CONFLICT(setting_key) DO UPDATE SET setting_value=EXCLUDED.setting_value, is_secret=EXCLUDED.is_secret, updated_at=NOW(), updated_by=EXCLUDED.updated_by`,
        [key, String(raw ?? ''), key === 'mikrotik_core_password', req.session?.userId || null]
      );
      await audit(client, req, 'setting_updated', key);
    }
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Platform core settings saved.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[Server Settings] Core settings save failed:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Unable to save core settings.' });
  } finally { client.release(); }
}

async function listTenants(req, res) {
  try {
    const result = await db.query(`
      SELECT t.id, t.name, t.slug, t.contact_email, t.contact_phone, t.status,
             t.modules, t.created_at, s.starts_at, s.ends_at,
             GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.ends_at - NOW())) / 86400))::int AS days_remaining,
             CASE WHEN t.status <> 'active' THEN 'suspended'
                  WHEN s.ends_at <= NOW() THEN 'expired' ELSE 'active' END AS subscription_status
      FROM public.tenants t
      LEFT JOIN LATERAL (SELECT starts_at, ends_at FROM public.tenant_subscriptions WHERE tenant_id=t.id ORDER BY ends_at DESC LIMIT 1) s ON TRUE
      ORDER BY t.created_at DESC, t.id DESC
    `);
    return res.set('Cache-Control', 'no-store, private').json({ success: true, tenants: result.rows || [] });
  } catch (error) {
    console.error('[Server Settings] Tenant list failed:', error.message);
    return res.status(503).json({ success: false, message: 'Tenant schema unavailable. Apply the platform SaaS schema before managing clients.' });
  }
}

async function createTenant(req, res) {
  const name = String(req.body?.name || '').trim();
  const slug = String(req.body?.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!name || !slug) return res.status(400).json({ success: false, message: 'Tenant name and URL slug are required.' });
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const inserted = await client.query(
      'INSERT INTO public.tenants(name, slug, contact_email, contact_phone, status, modules) VALUES($1,$2,$3,$4,\'active\',$5::jsonb) RETURNING id',
      [name, slug, String(req.body?.contact_email || '').trim() || null, String(req.body?.contact_phone || '').trim() || null, JSON.stringify({ hotspot: true, sms_gateway: true, whatsapp: true })]
    );
    const tenantId = inserted.rows[0].id;
    await client.query(
      'INSERT INTO public.tenant_subscriptions(tenant_id, starts_at, ends_at, status, updated_by) VALUES($1, NOW(), NOW() + INTERVAL \'30 days\', \'active\', $2)',
      [tenantId, req.session?.userId || null]
    );
    await audit(client, req, 'tenant_created', null, { tenantId, slug, termDays: 30 });
    await client.query('COMMIT');
    return res.status(201).json({ success: true, tenantId, message: 'Tenant created with a 30-day subscription.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[Server Settings] Tenant create failed:', error.message);
    return res.status(400).json({ success: false, message: error.code === '23505' ? 'That tenant slug already exists.' : 'Unable to create tenant. Check the server log.' });
  } finally { client.release(); }
}

async function updateTenant(req, res) {
  const tenantId = Number(req.params.id);
  if (!Number.isSafeInteger(tenantId) || tenantId < 1) return res.status(400).json({ success: false, message: 'Invalid tenant ID.' });
  const { action } = req.body || {};
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const tenant = await client.query('SELECT id, status, modules FROM public.tenants WHERE id=$1 FOR UPDATE', [tenantId]);
    if (!tenant.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Tenant not found.' }); }
    if (action === 'suspend') {
      await client.query("UPDATE public.tenants SET status='suspended', updated_at=NOW() WHERE id=$1", [tenantId]);
    } else if (action === 'activate' || action === 'extend') {
      await client.query("UPDATE public.tenants SET status='active', updated_at=NOW() WHERE id=$1", [tenantId]);
      const days = action === 'extend' ? Math.min(3650, Math.max(1, Number(req.body.days) || 30)) : 30;
      if (action === 'extend') {
        await client.query("INSERT INTO public.tenant_subscriptions(tenant_id, starts_at, ends_at, status, updated_by) VALUES($1, NOW(), GREATEST(NOW(), COALESCE((SELECT MAX(ends_at) FROM public.tenant_subscriptions WHERE tenant_id=$1), NOW())) + ($2::text || ' days')::interval, 'active', $3)", [tenantId, days, req.session?.userId || null]);
      } else {
        // Activate starts a fresh 30-day term if the previous term has expired.
        await client.query("INSERT INTO public.tenant_subscriptions(tenant_id, starts_at, ends_at, status, updated_by) VALUES($1, NOW(), NOW() + INTERVAL '30 days', 'active', $2)", [tenantId, req.session?.userId || null]);
      }
    } else if (action === 'modules') {
      const modules = req.body.modules || {};
      const normalized = { hotspot: modules.hotspot === true, sms_gateway: modules.sms_gateway === true, whatsapp: modules.whatsapp === true };
      await client.query('UPDATE public.tenants SET modules=$2::jsonb, updated_at=NOW() WHERE id=$1', [tenantId, JSON.stringify(normalized)]);
    } else {
      throw new Error('Unsupported tenant action.');
    }
    await audit(client, req, 'tenant_' + action, null, { tenantId, action });
    await client.query('COMMIT');
    return res.json({ success: true, message: 'Tenant updated.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[Server Settings] Tenant update failed:', error.message);
    return res.status(400).json({ success: false, message: error.message || 'Unable to update tenant.' });
  } finally { client.release(); }
}

module.exports = { listSettings, generateToken: generateMasterToken, generateAndroidToken, saveCoreSettings, listTenants, createTenant, updateTenant };
