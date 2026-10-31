'use strict';

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../db');
const invitationService = require('../services/resellerInvitationService');
const { isResellerSession } = require('../middleware/rbac');
const { ensureBillingAccount } = require('../services/resellerBillingAccountService');

const PASSWORD_MIN = 12;
const PASSWORD_MAX = 128;

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function normalizeEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function validPassword(password) {
  return password.length >= PASSWORD_MIN &&
    password.length <= PASSWORD_MAX &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);
}

function sendFailure(res, error, operation) {
  console.error('[RESELLER AUTH] ' + operation + ' failed:', error.message);
  return res.status(503).json({ success: false, message: 'Reseller authentication service is temporarily unavailable.' });
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function invite(req, res) {
  const name = String(req.body?.name || '').trim();
  const email = normalizeEmail(req.body?.email);
  const phone = String(req.body?.phone || '').trim();
  const rawAssignedPopIds = req.body?.assigned_pop_ids;
  if (rawAssignedPopIds !== undefined && rawAssignedPopIds !== null && !Array.isArray(rawAssignedPopIds)) {
    return res.status(400).json({ success: false, message: 'assigned_pop_ids must be an array of POP IDs.' });
  }
  const assignedPopIds = Array.isArray(rawAssignedPopIds)
    ? [...new Set(rawAssignedPopIds.map(validId))]
    : [];
  if (!name || name.length > 100 || !email || !phone || phone.length > 40 || assignedPopIds.some(id => id === null)) {
    return res.status(400).json({ success: false, message: 'Provide a valid name, email, phone, and POP ID list.' });
  }

  const { token, tokenHash: hash } = invitationService.createInvitationToken();
  const expiresAt = new Date(Date.now() + invitationService.INVITATION_TTL_MS);
  try {
    const reseller = await db.withTransaction(async client => {
      if (assignedPopIds.length) {
        // Prevent a concurrent customer insert from racing the empty-POP check.
        // The lock is held only for this short assignment transaction.
        await client.query('LOCK TABLE customers IN SHARE ROW EXCLUSIVE MODE');
        const pops = await client.query(
          'SELECT p.id,p.name,p.reseller_id,p.status,EXISTS(SELECT 1 FROM customers c WHERE c.pop_id=p.id) AS has_customers FROM pops p WHERE p.id=ANY($1::bigint[]) FOR UPDATE',
          [assignedPopIds]
        );
        if (pops.rows.length !== assignedPopIds.length ||
            pops.rows.some(pop => pop.reseller_id !== null || pop.status !== 'active' || pop.name === 'FAZ Main (Direct)' || pop.has_customers)) {
          const error = new Error('Selected POPs are not eligible for safe reseller assignment.');
          error.statusCode = 409;
          throw error;
        }
      }
      const inserted = await client.query(
        'INSERT INTO resellers (name,email,username,password_hash,phone,status,invite_token_hash,invite_expires_at,invited_at,created_at,updated_at) VALUES ($1,$2,NULL,NULL,$3,\'inactive\',$4,$5,NOW(),NOW(),NOW()) RETURNING id,name,email,phone,status',
        [name, email, phone, hash, expiresAt]
      );
      if (!inserted.rows.length) throw new Error('Reseller invitation record was not created.');
      await client.query(
        `INSERT INTO public.reseller_billing_accounts
           (reseller_id,billing_mode,wallet_balance,receivable_balance,credit_limit,currency,account_status,created_at,updated_at)
         VALUES ($1,'prepaid',0.00,0.00,0.00,'BDT','active',NOW(),NOW())
         ON CONFLICT (reseller_id) DO NOTHING`,
        [inserted.rows[0].id]
      );
      if (assignedPopIds.length) {
        const assigned = await client.query(
          'UPDATE pops SET reseller_id=$1,updated_at=NOW() WHERE id=ANY($2::bigint[]) AND reseller_id IS NULL RETURNING id',
          [inserted.rows[0].id, assignedPopIds]
        );
        if (assigned.rows.length !== assignedPopIds.length) throw new Error('POP assignment changed during invitation creation; transaction rolled back.');
      }
      await invitationService.queueInvitation({ reseller: inserted.rows[0], token, client, expiresAt });
      return inserted.rows[0];
    });
    return res.status(201).json({ success: true, reseller: { id: reseller.id, name: reseller.name, email: reseller.email, phone: reseller.phone, status: reseller.status }, message: 'Invitation email queued. The reseller account remains inactive until acceptance.' });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message });
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'A reseller account already uses this email address.' });
    return sendFailure(res, error, 'Invitation creation');
  }
}

async function resendInvite(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid reseller ID.' });
  const { token, tokenHash: hash } = invitationService.createInvitationToken();
  const expiresAt = new Date(Date.now() + invitationService.INVITATION_TTL_MS);
  try {
    const outcome = await db.withTransaction(async client => {
      const found = await client.query(`SELECT id,name,email,phone,status,invited_at,
        GREATEST(0, CEIL(EXTRACT(EPOCH FROM (invited_at + INTERVAL '60 seconds' - NOW()))))::int AS cooldown_remaining
        FROM resellers WHERE id=$1 FOR UPDATE`, [id]);
      const reseller = found.rows[0];
      if (!reseller) return { kind: 'missing' };
      if (reseller.status !== 'inactive' || !reseller.email) return { kind: 'not_pending' };
      if (Number(reseller.cooldown_remaining) > 0) {
        return { kind: 'cooldown', retryAfter: Number(reseller.cooldown_remaining) };
      }
      const updated = await client.query(
        'UPDATE resellers SET invite_token_hash=$1,invite_expires_at=$2,invited_at=NOW(),updated_at=NOW() WHERE id=$3 AND status=\'inactive\' RETURNING id,name,email,phone,status',
        [hash, expiresAt, id]
      );
      await invitationService.queueInvitation({ reseller: updated.rows[0], token, client, expiresAt });
      return { kind: 'queued' };
    });
    if (outcome.kind === 'missing') return res.status(404).json({ success: false, message: 'Reseller not found.' });
    if (outcome.kind === 'not_pending') return res.status(409).json({ success: false, message: 'Only inactive email-based reseller accounts can receive a replacement invitation.' });
    if (outcome.kind === 'cooldown') {
      res.set('Retry-After', String(outcome.retryAfter));
      return res.status(429).json({ success: false, code: 'INVITATION_COOLDOWN', retryAfter: outcome.retryAfter, message: 'Please wait before sending another invitation.' });
    }
    return res.json({ success: true, message: 'Replacement invitation queued; the previous link is invalidated.' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'A conflicting reseller invitation exists. Refresh and retry.' });
    return sendFailure(res, error, 'Invitation resend');
  }
}

async function cancelInvite(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid reseller ID.' });
  try {
    const result = await db.query(
      'UPDATE resellers SET invite_token_hash=NULL,invite_expires_at=NULL,updated_at=NOW() WHERE id=$1 AND status=\'inactive\' AND invite_token_hash IS NOT NULL RETURNING id',
      [id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Pending reseller invitation not found.' });
    return res.json({ success: true, message: 'Invitation cancelled. Its link can no longer be used.' });
  } catch (error) {
    return sendFailure(res, error, 'Invitation cancellation');
  }
}

async function showAcceptInvite(req, res) {
  const token = String(req.query?.token || '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
    return res.status(400).set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer')
      .render('reseller-accept-invite', { token: '', email: '', error: 'This invitation link is invalid.' });
  }
  try {
    const result = await db.query(
      'SELECT email,invite_expires_at FROM resellers WHERE invite_token_hash=$1 AND status=\'inactive\' LIMIT 1',
      [tokenHash(token)]
    );
    const invite = result.rows[0];
    if (!invite || new Date(invite.invite_expires_at).getTime() <= Date.now()) {
      return res.status(410).set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer')
        .render('reseller-accept-invite', { token: '', email: '', error: 'This invitation has expired or was cancelled.' });
    }
    return res.set('Cache-Control', 'no-store').set('Referrer-Policy', 'no-referrer')
      .set('X-Robots-Tag', 'noindex, nofollow')
      .render('reseller-accept-invite', { token, email: invite.email, error: null });
  } catch (error) {
    return sendFailure(res, error, 'Invitation lookup');
  }
}

async function acceptInvite(req, res) {
  const token = String(req.body?.token || '');
  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirm_password || '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(400).json({ success: false, message: 'Invalid invitation link.' });
  if (!validPassword(password)) return res.status(400).json({ success: false, message: 'Password must be 12–128 characters and include uppercase, lowercase, number, and symbol.' });
  if (password !== confirmPassword) return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  try {
    const outcome = await db.withTransaction(async client => {
      const found = await client.query(
        'SELECT id,email,invite_expires_at FROM resellers WHERE invite_token_hash=$1 AND status=\'inactive\' FOR UPDATE',
        [tokenHash(token)]
      );
      const reseller = found.rows[0];
      if (!reseller || !reseller.invite_expires_at || new Date(reseller.invite_expires_at).getTime() <= Date.now()) return null;
      const passwordHash = await bcrypt.hash(password, 12);
      const activated = await client.query(
        'UPDATE resellers SET password_hash=$1,status=\'active\',activated_at=NOW(),invite_token_hash=NULL,invite_expires_at=NULL,updated_at=NOW() WHERE id=$2 AND status=\'inactive\' RETURNING id,name,email',
        [passwordHash, reseller.id]
      );
      return activated.rows[0] || null;
    });
    if (!outcome) return res.status(410).json({ success: false, message: 'This invitation has expired, was cancelled, or has already been accepted.' });
    return res.json({ success: true, message: 'Your reseller account is active. Sign in using your email and new password.' });
  } catch (error) {
    return sendFailure(res, error, 'Invitation acceptance');
  }
}

async function login(req, res) {
  const identifier = String(req.body?.email || req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!identifier || !password) return res.status(400).json({ success: false, message: 'Email/username and password are required.' });
  try {
    // Email is the canonical identifier. Only fall back to a legacy username
    // when no reseller email matches, avoiding ambiguous cross-namespace matches.
    const byEmail = await db.query(
      'SELECT id,name,email,username,password_hash,status FROM resellers WHERE lower(email)=lower($1) LIMIT 1',
      [identifier]
    );
    const result = byEmail.rows[0] ? byEmail : await db.query(
      'SELECT id,name,email,username,password_hash,status FROM resellers WHERE lower(username)=lower($1) LIMIT 1',
      [identifier]
    );
    const reseller = result.rows[0];
    if (!reseller || reseller.status !== 'active' || !reseller.password_hash || !(await bcrypt.compare(password, reseller.password_hash))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials or inactive reseller account.' });
    }
    await ensureBillingAccount(reseller.id);
    req.session.regenerate(error => {
      if (error) {
        console.error('[RESELLER AUTH] Session regeneration failed:', error.message);
        return res.status(500).json({ success: false, message: 'Could not initialize a secure session. Please retry.' });
      }
      req.session.auth = { role: 'reseller', resellerId: reseller.id, isReseller: true, name: reseller.name };
      req.session.save(saveError => {
        if (saveError) {
          console.error('[RESELLER AUTH] Session save failed:', saveError.message);
          return req.session.destroy(() => res.status(500).json({ success: false, message: 'Could not save your session. Please retry.' }));
        }
        return res.json({ success: true, message: 'Signed in successfully.', redirect: '/reseller/dashboard' });
      });
    });
  } catch (error) {
    return sendFailure(res, error, 'Login');
  }
}

function logout(req, res) {
  if (!req.session || !isResellerSession(req)) {
    return res.status(401).json({ success: false, message: 'An authenticated reseller session is required.' });
  }
  req.session.destroy(error => {
    if (error) {
      console.error('[RESELLER AUTH] Session destruction failed:', error.message);
      return res.status(500).json({ success: false, message: 'Could not safely end the session. Please retry.' });
    }
    res.clearCookie('connect.sid', { path: '/' });
    return res.json({ success: true, message: 'Signed out successfully.' });
  });
}

module.exports = { invite, resendInvite, cancelInvite, showAcceptInvite, acceptInvite, login, logout };
