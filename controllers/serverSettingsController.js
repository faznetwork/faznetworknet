'use strict';

const crypto = require('crypto');
const db = require('../db');

const SECRET_KEYS = new Set([
  'master_webhook_token_hash',
  'android_sms_gateway_token_hash',
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

async function listTenants(req, res) {
  try {
    const result = await db.query(`
      SELECT t.id, t.tenant_number, t.name, t.slug, t.contact_email, t.contact_phone, t.status,
             t.modules, t.created_at, s.starts_at, s.ends_at, t.invitation_expires_at,
             CASE WHEN EXISTS (SELECT 1 FROM public.admin_users au WHERE au.tenant_id=t.id) THEN 'onboarded' ELSE 'pending_invite' END AS onboarding_status,
             GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.ends_at - NOW())) / 86400))::int AS days_remaining,
             CASE WHEN t.status <> 'active' THEN 'suspended'
                  WHEN s.ends_at <= NOW() THEN 'expired' ELSE 'active' END AS subscription_status
      FROM public.tenants t
      LEFT JOIN LATERAL (SELECT starts_at, ends_at FROM public.tenant_subscriptions WHERE tenant_id=t.id ORDER BY ends_at DESC LIMIT 1) s ON TRUE
      ORDER BY t.tenant_number ASC, t.id ASC
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
  // The Platform Owner form uses contactEmail; accept legacy contact_email/email too.
  // Never derive the recipient from the authenticated admin/session.
  const recipientEmail = String(req.body?.contactEmail || req.body?.contact_email || req.body?.email || '').trim().toLowerCase();
  const phone = String(req.body?.contact_phone || req.body?.contactPhone || '').trim();
  if (!name || !slug) return res.status(400).json({ success: false, message: 'Tenant name and URL slug are required.' });
  if (!recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail) || recipientEmail.length > 254) {
    return res.status(400).json({ success: false, message: 'A valid client contact email is required. No invitation was sent.' });
  }
  const requestedModules = req.body?.modules && typeof req.body.modules === 'object' ? req.body.modules : {};
  const modules = { hotspot: requestedModules.hotspot !== false, sms_gateway: requestedModules.sms_gateway !== false, whatsapp: requestedModules.whatsapp !== false };
  const invitationToken = crypto.randomBytes(32).toString('base64url');
  const invitationHash = crypto.createHash('sha256').update(invitationToken, 'utf8').digest('hex');
  const invitationUrl = 'https://isp.faznetwork.com/onboard?token=' + invitationToken;
  const client = await db.getPool().connect();
  let tenantId;
  let tenantNumber;
  try {
    await client.query('BEGIN');
    // Serialize tenant-number allocation across concurrent onboarding transactions.
    await client.query("SELECT pg_advisory_xact_lock(hashtext('public.tenants.tenant_number'))");
    const slot = await client.query(`
      SELECT candidate AS tenant_number
      FROM generate_series(1, (SELECT COALESCE(MAX(tenant_number), 0) + 1 FROM public.tenants)) AS candidate
      WHERE NOT EXISTS (SELECT 1 FROM public.tenants t WHERE t.tenant_number = candidate)
      ORDER BY candidate ASC LIMIT 1
    `);
    tenantNumber = Number(slot.rows[0]?.tenant_number || 1);
    const inserted = await client.query(
      "INSERT INTO public.tenants(tenant_number, name, slug, contact_email, contact_phone, status, modules, invitation_token_hash, invitation_expires_at) VALUES($1,$2,$3,$4,$5,'suspended',$6::jsonb,$7,NOW()+INTERVAL '48 hours') RETURNING id",
      [tenantNumber, name, slug, recipientEmail, phone || null, JSON.stringify(modules), invitationHash]
    );
    tenantId = Number(inserted.rows[0].id);
    await client.query("INSERT INTO public.tenant_subscriptions(tenant_id, starts_at, ends_at, status, updated_by) VALUES($1, NOW(), NOW() + INTERVAL '30 days', 'active', $2)", [tenantId, req.session?.userId || null]);
    await audit(client, req, 'tenant_invitation_created', null, { tenantId, slug, termDays: 30, invitationExpiresHours: 48, initialAdminEmail: recipientEmail });
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[Server Settings] Tenant provisioning failed:', error.message);
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'That tenant slug or admin email is already registered.' });
    return res.status(400).json({ success: false, message: 'Unable to provision tenant invitation. Check the server log.' });
  } finally { client.release(); }

  let emailSent = false;
  let emailWarning = '';
  try {
    console.log('Sending tenant invite to:', recipientEmail);
    await require('../services/appsScriptMailer').sendTenantInvitation({ recipientEmail, email: recipientEmail, tenantName: name, link: invitationUrl });
    emailSent = true;
  } catch (error) {
    emailWarning = 'Invitation email could not be sent: ' + String(error.message || error).slice(0, 180) + '. Copy the link and share it securely.';
    console.warn('[Tenant Invitation] Email delivery failed for tenant #' + tenantId + ':', error.message);
  }
  res.set('Cache-Control', 'no-store, private');
  return res.status(201).json({ success: true, tenantId, tenantNumber, loginUrl: 'https://isp.faznetwork.com/login', invitationUrl, emailSent, emailWarning, message: emailSent ? 'Tenant invitation sent. The tenant remains inactive until onboarding is completed; the invitation expires in 48 hours.' : 'Tenant invitation created. The tenant remains inactive until onboarding is completed; the invitation expires in 48 hours.' });
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


async function resendTenantInvitation(req, res) {
  const tenantId = Number(req.params.id);
  if (!Number.isSafeInteger(tenantId) || tenantId < 1) return res.status(400).json({ success: false, message: 'Invalid tenant ID.' });
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  const invitationUrl = 'https://isp.faznetwork.com/onboard?token=' + token;
  const client = await db.getPool().connect();
  let tenant;
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT t.id, t.name, t.contact_email,
      EXISTS (SELECT 1 FROM public.admin_users au WHERE au.tenant_id=t.id) AS onboarded
      FROM public.tenants t WHERE t.id=$1 FOR UPDATE`, [tenantId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Tenant not found.' }); }
    tenant = found.rows[0];
    if (tenant.onboarded) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'This tenant is already onboarded; invitation links cannot be reissued.' }); }
    await client.query("UPDATE public.tenants SET invitation_token_hash=$2, invitation_expires_at=NOW()+INTERVAL '48 hours', status='suspended', updated_at=NOW() WHERE id=$1", [tenantId, tokenHash]);
    await audit(client, req, 'tenant_invitation_resent', null, { tenantId, invitationExpiresHours: 48 });
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[Server Settings] Invitation refresh failed:', error.message);
    return res.status(503).json({ success: false, message: 'Unable to generate a fresh tenant invitation.' });
  } finally { client.release(); }
  let emailSent = false, emailWarning = '';
  try { await require('../services/appsScriptMailer').sendTenantInvitation({ email: tenant.contact_email, tenantName: tenant.name, link: invitationUrl }); emailSent = true; }
  catch (error) { emailWarning = 'Email delivery failed; copy the link and share it securely.'; console.warn('[Tenant Invitation] Resend failed for tenant #' + tenantId + ':', error.message); }
  res.set('Cache-Control', 'no-store, private');
  return res.json({ success: true, invitationUrl, emailSent, emailWarning, expiresInHours: 48, message: emailSent ? 'Fresh invitation emailed; link expires in 48 hours.' : 'Fresh invitation generated; link expires in 48 hours.' });
}

async function deleteTenant(req, res) {
  const tenantId = Number(req.params.id);
  if (!Number.isSafeInteger(tenantId) || tenantId < 1) return res.status(400).json({ success: false, message: 'Invalid tenant ID.' });
  const client = await db.getPool().connect();
  try {
    await client.query('BEGIN');
    const found = await client.query('SELECT id, name, slug FROM public.tenants WHERE id=$1 FOR UPDATE', [tenantId]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ success: false, message: 'Tenant not found.' }); }
    const tenant = found.rows[0];
    await audit(client, req, 'tenant_deleted', null, { tenantId, slug: tenant.slug, name: tenant.name });
    // Remove tenant-owned users only when this installation has a tenant-scoped public.users table.
    const usersTable = await client.query(`SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='users'`);
    const usersColumn = usersTable.rowCount ? await client.query(`SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name='tenant_id'`) : { rowCount: 0 };
    if (usersColumn.rowCount) await client.query('DELETE FROM public.users WHERE tenant_id=$1', [tenantId]);
    // Explicit deletes document cleanup requirements; foreign keys also cascade to tenant-owned admin_users.
    await client.query('DELETE FROM public.tenant_subscriptions WHERE tenant_id=$1', [tenantId]);
    await client.query('DELETE FROM public.tenant_routers WHERE tenant_id=$1', [tenantId]);
    await client.query('DELETE FROM public.tenant_olts WHERE tenant_id=$1', [tenantId]);
    await client.query('DELETE FROM public.admin_users WHERE tenant_id=$1', [tenantId]);
    await client.query('DELETE FROM public.tenants WHERE id=$1', [tenantId]);
    // Compact human-facing numbers while leaving primary keys and all foreign keys untouched.
    await client.query(`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY tenant_number ASC, created_at ASC NULLS FIRST, id ASC)::INTEGER AS next_number
        FROM public.tenants
      )
      UPDATE public.tenants t SET tenant_number = -ordered.next_number
      FROM ordered WHERE ordered.id = t.id
    `);
    await client.query('UPDATE public.tenants SET tenant_number = -tenant_number WHERE tenant_number < 0');
    await client.query('COMMIT');
    res.set('Cache-Control', 'no-store, private');
    return res.json({ success: true, deletedTenantId: tenantId, message: 'Tenant and associated records deleted.' });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    console.error('[Server Settings] Tenant deletion failed:', error.message);
    return res.status(503).json({ success: false, message: 'Tenant deletion failed; no changes were committed.' });
  } finally { client.release(); }
}

module.exports = { listSettings, generateToken: generateMasterToken, generateAndroidToken, listTenants, createTenant, updateTenant, deleteTenant, resendTenantInvitation };
