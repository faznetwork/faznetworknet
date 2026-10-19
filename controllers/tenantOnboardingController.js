'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../db');

function tokenHash(token) { return crypto.createHash('sha256').update(String(token), 'utf8').digest('hex'); }
function renderError(res, status, error, tenant) { return res.status(status).set('Cache-Control', 'no-store').render('onboard', { error, tenant, token: '' }); }

async function show(req, res) {
  const token = String(req.query?.token || '');
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return renderError(res, 400, 'This invitation link is invalid or has expired.', null);
  try {
    const result = await db.query(`SELECT id, name, contact_email, slug, invitation_expires_at FROM public.tenants WHERE invitation_token_hash=$1 AND invitation_expires_at > NOW() AND status='suspended' LIMIT 1`, [tokenHash(token)]);
    if (!result.rowCount) return renderError(res, 410, 'This invitation link is invalid, expired, or already used.', null);
    const tenant = result.rows[0];
    return res.set('Cache-Control', 'no-store').render('onboard', { error: null, tenant, token });
  } catch (error) { console.error('[Tenant Onboarding] Invitation lookup failed:', error.message); return renderError(res, 503, 'Onboarding is temporarily unavailable. Please retry later.', null); }
}

async function submit(req, res) {
  const token = String(req.body?.token || '');
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');
  if (!/^[A-Za-z0-9._-]{3,60}$/.test(username)) return res.status(400).json({ success: false, message: 'Username must be 3–60 characters using letters, numbers, dots, underscores, or hyphens.' });
  if (password.length < 10 || password.length > 128) return res.status(400).json({ success: false, message: 'Password must be 10–128 characters.' });
  if (password !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  if (!/^[A-Za-z0-9_-]{40,100}$/.test(token)) return res.status(400).json({ success: false, message: 'Invitation token is invalid or expired.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const client = await db.getPool().connect();
  let tenant;
  try {
    await client.query('BEGIN');
    const found = await client.query(`SELECT id, name, contact_email FROM public.tenants WHERE invitation_token_hash=$1 AND invitation_expires_at > NOW() AND status='suspended' FOR UPDATE`, [tokenHash(token)]);
    if (!found.rowCount) { await client.query('ROLLBACK'); return res.status(410).json({ success: false, message: 'Invitation is expired or has already been used.' }); }
    tenant = found.rows[0];
    const collision = await client.query('SELECT id FROM public.admin_users WHERE lower(username)=lower($1) OR lower(email)=lower($2) LIMIT 1', [username, tenant.contact_email]);
    if (collision.rowCount) { await client.query('ROLLBACK'); return res.status(409).json({ success: false, message: 'That username or email is already registered. Choose another username.' }); }
    await client.query(`INSERT INTO public.admin_users(tenant_id, username, email, password_hash, role, is_first_login, status, created_by) VALUES($1,$2,$3,$4,'admin',FALSE,'active','tenant-onboarding')`, [tenant.id, username, tenant.contact_email, passwordHash]);
    const activated = await client.query(`UPDATE public.tenants SET status='active', invitation_token_hash=NULL, invitation_expires_at=NULL, updated_at=NOW() WHERE id=$1 AND invitation_token_hash=$2 RETURNING id`, [tenant.id, tokenHash(token)]);
    if (!activated.rowCount) throw new Error('Invitation token was already consumed.');
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'That username or email is already registered.' });
    console.error('[Tenant Onboarding] Setup failed:', error.message);
    return res.status(503).json({ success: false, message: 'Could not complete onboarding. Please retry.' });
  } finally { client.release(); }
  return req.session.regenerate(error => {
    if (error) return res.status(500).json({ success: false, message: 'Account created, but session initialization failed. Sign in normally.' });
    req.session.tenantAdmin = true; req.session.tenantId = Number(tenant.id); req.session.tenantName = tenant.name;
    req.session.isAdmin = false; req.session.adminUser = username; req.session.role = 'admin'; req.session.legacySuperAdmin = false; req.session.loginAt = Date.now();
    return req.session.save(saveError => {
      if (saveError) return res.status(500).json({ success: false, message: 'Account created, but session could not be saved. Please sign in.' });
      return res.json({ success: true, redirect: '/tenant/dashboard' });
    });
  });
}
module.exports = { show, submit };
