'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const db = require('../db');
const { getAdminCredentials } = require('../middleware/adminAuth');
const { normalizeRole } = require('../middleware/rbac');

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function hashOtp(userId, code) {
  const secret = String(process.env.OTP_HASH_SECRET || process.env.ADMIN_SESSION_SECRET || process.env.SESSION_SECRET || '');
  if (!secret) throw new Error('OTP_HASH_SECRET or ADMIN_SESSION_SECRET must be configured.');
  return crypto.createHmac('sha256', secret).update(String(userId) + ':' + String(code)).digest('hex');
}

function safeEqualHex(left, right) {
  if (!/^[a-f0-9]{64}$/i.test(String(left || '')) || !/^[a-f0-9]{64}$/i.test(String(right || ''))) return false;
  return crypto.timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

function createMailer() {
  const host = String(process.env.SMTP_HOST || '').trim();
  const user = String(process.env.SMTP_USER || '').trim();
  const pass = String(process.env.SMTP_PASS || '');
  if (!host || !user || !pass) throw new Error('Email OTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASS in Render.');
  const port = Number(process.env.SMTP_PORT || 587);
  return nodemailer.createTransport({
    host, port, secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465,
    auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
  });
}

async function sendLoginNotification(user, loginType, req) {
  const mailerUrl = String(process.env.OTP_MAILER_URL || '').trim();
  const mailerToken = String(process.env.OTP_MAILER_TOKEN || '');
  const recipient = String(process.env.ADMIN_LOGIN_NOTIFICATION_EMAIL || 'faznetwork.com@gmail.com').trim();
  if (!mailerUrl || !mailerToken) {
    throw new Error('Apps Script mailer is not configured for login notifications.');
  }

  const endpoint = new URL(mailerUrl);
  if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' ||
      !/^\/macros\/s\/[^/]+\/exec\/?$/.test(endpoint.pathname)) {
    throw new Error('OTP_MAILER_URL must be a Google Apps Script Web App /exec URL.');
  }
  if (mailerToken.length < 32) throw new Error('OTP_MAILER_TOKEN must be at least 32 characters.');

  const payload = {
    type: 'login_alert',
    token: mailerToken,
    to: recipient,
    username: String(user.username || 'unknown').slice(0, 60),
    role: String(user.role || 'staff').slice(0, 30),
    loginType: loginType === 'first_login' ? 'first_login' : 'login',
    loginAt: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dhaka', hour12: false }),
    timeZone: 'Asia/Dhaka',
    ipAddress: String(req?.ip || '').slice(0, 64) || 'Unavailable',
    userAgent: String(req?.get?.('user-agent') || '').slice(0, 240) || 'Unavailable'
  };

  const response = await fetch(endpoint.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(20000),
    redirect: 'follow'
  });
  const responseText = await response.text();
  let result;
  try { result = JSON.parse(responseText); }
  catch { throw new Error('Apps Script login notification returned an invalid response.'); }
  if (!response.ok || result.success !== true) {
    throw new Error('Apps Script login notification failed: ' + String(result.error || 'request rejected').slice(0, 120));
  }
}

async function sendOtpEmail(user, code) {
  const mailerUrl = String(process.env.OTP_MAILER_URL || '').trim();
  const mailerToken = String(process.env.OTP_MAILER_TOKEN || '');

  // Prefer the HTTPS Apps Script mailer when configured. SMTP remains available
  // as a backwards-compatible fallback for paid/other hosting environments.
  if (mailerUrl || mailerToken) {
    if (!mailerUrl || !mailerToken) {
      throw new Error('Apps Script OTP mailer requires both OTP_MAILER_URL and OTP_MAILER_TOKEN.');
    }

    let endpoint;
    try {
      endpoint = new URL(mailerUrl);
    } catch {
      throw new Error('OTP_MAILER_URL is invalid.');
    }
    if (endpoint.protocol !== 'https:' ||
        endpoint.hostname !== 'script.google.com' ||
        !/^\/macros\/s\/[^/]+\/exec\/?$/.test(endpoint.pathname)) {
      throw new Error('OTP_MAILER_URL must be a Google Apps Script Web App /exec URL.');
    }
    if (mailerToken.length < 32) {
      throw new Error('OTP_MAILER_TOKEN must be at least 32 characters.');
    }

    let response;
    try {
      response = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: mailerToken, to: user.email, code }),
        signal: AbortSignal.timeout(20000),
        redirect: 'follow'
      });
    } catch (error) {
      throw new Error('Apps Script OTP mailer request failed: ' + String(error.name || 'network error'));
    }

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new Error('Apps Script OTP mailer returned an invalid response.');
    }
    if (!response.ok || result.success !== true) {
      const safeError = String(result.error || 'request rejected').slice(0, 120);
      throw new Error('Apps Script OTP mailer failed: ' + safeError);
    }
    return;
  }

  const transporter = createMailer();
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  await transporter.sendMail({
    from, to: user.email,
    subject: 'FAZ NETWORK sign-in verification code',
    text: 'Hello ' + user.username + ',\n\nYour FAZ NETWORK first-login verification code is ' + code + '. It expires in 5 minutes. If you did not request this, contact your system administrator.\n\nDo not share this code.',
    html: '<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px"><h2>FAZ NETWORK</h2><p>Hello ' + escapeHtml(user.username) + ',</p><p>Your first-login verification code is:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px;background:#f0fdf4;border-radius:10px;text-align:center">' + code + '</div><p>This code expires in <b>5 minutes</b>. Do not share it.</p><p>If you did not request this code, contact your system administrator.</p></div>'
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function safeNext(value) {
  const target = String(value || '/admin');
  return target.startsWith('/') && !target.startsWith('//') ? target : '/admin';
}

async function writeAudit(req, action, targetUserId, details) {
  try {
    await db.query('INSERT INTO admin_audit_logs (actor_user_id,actor_username,actor_role,action,target_user_id,details,ip_address) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)', [req.session?.userId || null, String(req.session?.adminUser || 'admin'), String(req.session?.role || (req.session?.legacySuperAdmin ? 'super_admin' : 'super_admin')), action, targetUserId || null, JSON.stringify(details || {}), String(req.ip || '').slice(0,64) || null]);
  } catch (error) { console.warn('[RBAC audit] Could not write audit record:', error.message); }
}

function establishSession(req, res, user, nextTarget, loginType = 'login') {
  req.session.regenerate(err => {
    if (err) {
      console.error('[RBAC] Session regeneration failed:', err.message);
      return res.status(500).render('login', { next: safeNext(nextTarget), error: 'Could not initialize a secure session. Please retry.' });
    }
    req.session.isAdmin = true;
    req.session.adminUser = user.username;
    req.session.role = user.role;
    req.session.userId = user.id || null;
    req.session.legacySuperAdmin = user.legacy === true;
    req.session.loginAt = Date.now();
    req.session.save(async saveErr => {
      if (saveErr) {
        console.error('[RBAC] Session save failed:', saveErr.message);
        return res.status(500).render('login', { next: safeNext(nextTarget), error: 'Could not save your session. Please retry.' });
      }
      if (user.completeFirstLogin) {
        try {
          await db.query('UPDATE admin_users SET is_first_login=FALSE, otp_code_hash=NULL, otp_expires_at=NULL, otp_attempts=0, last_login_at=NOW(), updated_at=NOW() WHERE id=$1', [user.id]);
        } catch (error) {
          console.error('[RBAC OTP] Could not finalize first login:', error.message);
          return req.session.destroy(() => res.status(503).render('verify-otp', { error: 'Could not finalize verification. Please sign in and request a new code.' }));
        }
      } else if (user.id) {
        db.query('UPDATE admin_users SET last_login_at=NOW(), updated_at=NOW() WHERE id=$1', [user.id]).catch(() => {});
      }
      if (user.id && user.legacy !== true) {
        sendLoginNotification(user, loginType, req).catch(error => {
          console.error('[RBAC login alert] Email delivery failed:', error.message);
        });
      }
      return res.redirect(safeNext(nextTarget));
    });
  });
}

async function login(req, res) {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  const nextTarget = safeNext(req.body?.next);
  if (!username || !password) return res.status(400).render('login', { next: nextTarget, error: 'Enter your username and password.' });

  // Preserve the configured shared credential as a permanent super-admin login,
  // even if an individual account later uses the same username.
  const { ADMIN_USER } = getAdminCredentials();
  const legacy = require('../middleware/adminAuth');
  if (username.toLowerCase() === ADMIN_USER.toLowerCase() && await legacy.adminCredentialsValid(username, password)) {
    return establishSession(req, res, { id: null, username, role: 'super_admin', legacy: true }, nextTarget);
  }

  try {
    const result = await db.query(
      'SELECT id, username, email, password_hash, role, is_first_login, status FROM admin_users WHERE lower(username)=lower($1) LIMIT 1',
      [username]
    );
    const user = result.rows?.[0];
    if (user) {
      if (String(user.status).toLowerCase() !== 'active' || !(await bcrypt.compare(password, user.password_hash))) {
        return res.status(401).render('login', { next: nextTarget, error: 'Invalid username or password, or account is inactive.' });
      }
      if (user.is_first_login === true) {
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
        const expiresAt = new Date(Date.now() + OTP_TTL_MS);
        const codeHash = hashOtp(user.id, code);
        await db.query('UPDATE admin_users SET otp_code_hash=$1, otp_expires_at=$2, otp_attempts=0, updated_at=NOW() WHERE id=$3', [codeHash, expiresAt, user.id]);
        try {
          await sendOtpEmail(user, code);
        } catch (mailError) {
          await db.query('UPDATE admin_users SET otp_code_hash=NULL, otp_expires_at=NULL WHERE id=$1', [user.id]).catch(() => {});
          console.error('[RBAC OTP] Email delivery failed:', mailError.message);
          return res.status(503).render('login', { next: nextTarget, error: 'Verification email could not be sent. Contact the administrator; no session was created.' });
        }
        req.session.pendingOtpUserId = user.id;
        req.session.pendingOtpNext = nextTarget;
        req.session.pendingOtpIssuedAt = Date.now();
        req.session.pendingOtpAttempts = 0;
        return req.session.save(err => {
          if (err) return res.status(500).render('login', { next: nextTarget, error: 'Could not start verification. Please retry.' });
          return res.redirect('/login/verify-otp');
        });
      }
      return establishSession(req, res, { id: user.id, username: user.username, role: normalizeRole(user.role) }, nextTarget);
    }
  } catch (error) {
    // Fail closed for database-backed users; only the configured legacy shared account may use fallback.
    if (!/relation "admin_users" does not exist/i.test(String(error.message || ''))) {
      console.error('[RBAC] User lookup failed:', error.message);
      return res.status(503).render('login', { next: nextTarget, error: 'Authentication service is temporarily unavailable. Please retry.' });
    }
  }

  return res.status(401).render('login', { next: nextTarget, error: 'Invalid username or password.' });
}

function showOtp(req, res) {
  if (!req.session?.pendingOtpUserId) return res.redirect('/login');
  return res.render('verify-otp', { error: null });
}

async function verifyOtp(req, res) {
  const userId = req.session?.pendingOtpUserId;
  if (!userId) return res.redirect('/login');
  if (Number(req.session.pendingOtpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
    await db.query('UPDATE admin_users SET otp_code_hash=NULL, otp_expires_at=NULL WHERE id=$1', [userId]).catch(() => {});
    return req.session.destroy(() => res.redirect('/login'));
  }
  const code = String(req.body?.otp || '').trim();
  if (!/^\d{6}$/.test(code)) {
    req.session.pendingOtpAttempts = Number(req.session.pendingOtpAttempts || 0) + 1;
    return req.session.save(() => res.status(400).render('verify-otp', { error: 'Enter the 6-digit code sent to your email.' }));
  }
  try {
    const result = await db.query('SELECT id, username, email, role, is_first_login, otp_code_hash, otp_expires_at, otp_attempts, status FROM admin_users WHERE id=$1 LIMIT 1', [userId]);
    const user = result.rows?.[0];
    if (user && Number(user.otp_attempts || 0) >= MAX_OTP_ATTEMPTS) {
      await db.query('UPDATE admin_users SET otp_code_hash=NULL, otp_expires_at=NULL WHERE id=$1', [userId]);
      return req.session.destroy(() => res.redirect('/login'));
    }
    const valid = user && user.status === 'active' && user.is_first_login === true &&
      user.otp_code_hash && user.otp_expires_at && new Date(user.otp_expires_at).getTime() > Date.now() &&
      safeEqualHex(user.otp_code_hash, hashOtp(userId, code));
    if (!valid) {
      req.session.pendingOtpAttempts = Number(req.session.pendingOtpAttempts || 0) + 1;
      await db.query('UPDATE admin_users SET otp_attempts=otp_attempts+1, otp_code_hash=CASE WHEN otp_attempts+1 >= $2 THEN NULL ELSE otp_code_hash END, otp_expires_at=CASE WHEN otp_attempts+1 >= $2 THEN NULL ELSE otp_expires_at END WHERE id=$1', [userId, MAX_OTP_ATTEMPTS]).catch(() => {});
      await req.session.save(() => {});
      return res.status(400).render('verify-otp', { error: 'Invalid or expired code. Check the email and try again.' });
    }
    const nextTarget = safeNext(req.session.pendingOtpNext);
    // Consume the OTP but keep first-login status pending until the user sets
    // a personal password. Do not grant an admin session at this stage.
    await db.query('UPDATE admin_users SET otp_code_hash=NULL, otp_expires_at=NULL, otp_attempts=0, updated_at=NOW() WHERE id=$1 AND is_first_login=TRUE', [user.id]);
    return req.session.regenerate(err => {
      if (err) {
        console.error('[RBAC] Password-setup session regeneration failed:', err.message);
        return res.status(500).render('verify-otp', { error: 'Verification succeeded, but secure setup could not start. Please sign in again.' });
      }
      req.session.pendingPasswordUserId = user.id;
      req.session.pendingPasswordNext = nextTarget;
      req.session.passwordOtpVerifiedAt = Date.now();
      return req.session.save(saveErr => {
        if (saveErr) {
          console.error('[RBAC] Password-setup session save failed:', saveErr.message);
          return res.status(500).render('verify-otp', { error: 'Could not start password setup. Please sign in again.' });
        }
        return res.redirect('/login/set-password');
      });
    });
  } catch (error) {
    console.error('[RBAC OTP] Verification failed:', error.message);
    return res.status(503).render('verify-otp', { error: 'Verification service is unavailable. Please retry.' });
  }
}

function showSetPassword(req, res) {
  const verifiedAt = Number(req.session?.passwordOtpVerifiedAt || 0);
  if (!req.session?.pendingPasswordUserId || !verifiedAt) return res.redirect('/login');
  if (Date.now() - verifiedAt > 10 * 60 * 1000) {
    return req.session.destroy(() => res.redirect('/login'));
  }
  return res.set('Cache-Control', 'no-store').render('set-first-password', { error: null });
}

async function setFirstPassword(req, res) {
  const userId = req.session?.pendingPasswordUserId;
  const verifiedAt = Number(req.session?.passwordOtpVerifiedAt || 0);
  if (!userId || !verifiedAt) return res.redirect('/login');
  if (Date.now() - verifiedAt > 10 * 60 * 1000) {
    return req.session.destroy(() => res.redirect('/login'));
  }

  const password = String(req.body?.password || '');
  const confirmPassword = String(req.body?.confirmPassword || '');
  if (password.length < 12 || password.length > 128) {
    return res.status(400).render('set-first-password', { error: 'Use a new password between 12 and 128 characters.' });
  }
  if (password !== confirmPassword) {
    return res.status(400).render('set-first-password', { error: 'The new password and confirmation do not match.' });
  }

  try {
    const result = await db.query(
      "SELECT id, username, email, password_hash, role, is_first_login, status FROM admin_users WHERE id=$1 LIMIT 1",
      [userId]
    );
    const user = result.rows?.[0];
    if (!user || user.status !== 'active' || user.is_first_login !== true) {
      return req.session.destroy(() => res.redirect('/login'));
    }
    if (await bcrypt.compare(password, user.password_hash)) {
      return res.status(400).render('set-first-password', { error: 'Choose a password different from the temporary password provided by the administrator.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const updated = await db.query(
      "UPDATE admin_users SET password_hash=$1, is_first_login=FALSE, otp_code_hash=NULL, otp_expires_at=NULL, otp_attempts=0, last_login_at=NOW(), updated_at=NOW() WHERE id=$2 AND is_first_login=TRUE AND status='active' RETURNING id",
      [passwordHash, userId]
    );
    if (!updated.rows.length) {
      return res.status(409).render('set-first-password', { error: 'This account has already been updated. Please sign in with your new password.' });
    }
    const nextTarget = safeNext(req.session.pendingPasswordNext);
    return establishSession(req, res, { id: user.id, username: user.username, role: normalizeRole(user.role) }, nextTarget, 'first_login');
  } catch (error) {
    console.error('[RBAC] First-login password change failed:', error.message);
    return res.status(503).render('set-first-password', { error: 'Could not save your new password. Please retry.' });
  }
}

async function listUsers(req, res) {
  try {
    const role = req.auth?.role;
    const result = role === 'super_admin'
      ? await db.query('SELECT id, username, email, role, is_first_login, status, last_login_at, created_at FROM admin_users ORDER BY created_at ASC, id ASC')
      : await db.query("SELECT id, username, email, role, is_first_login, status, last_login_at, created_at FROM admin_users WHERE role='staff' ORDER BY created_at ASC, id ASC");
    return res.json({ success: true, users: result.rows });
  } catch (error) {
    console.error('[RBAC] Listing users failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load user list.' });
  }
}

async function sendInvitationEmail(invitation, rawToken) {
  const configuredBase = String(process.env.PUBLIC_BASE_URL || 'https://faznetwork-web.onrender.com').trim().replace(/\/+$/, '');
  let base;
  try { base = new URL(configuredBase); } catch { throw new Error('PUBLIC_BASE_URL is invalid.'); }
  if (base.protocol !== 'https:' && base.hostname !== 'localhost') throw new Error('PUBLIC_BASE_URL must use HTTPS.');
  const link = base.toString().replace(/\/+$/, '') + '/invite/' + encodeURIComponent(rawToken);
  const roleLabel = invitation.role === 'super_admin' ? 'Super Admin' : invitation.role === 'admin' ? 'Admin' : 'Staff';

  // Prefer the existing Google Apps Script mailer for invitation links. SMTP is
  // retained as a fallback when the Apps Script mailer is not configured.
  const mailerUrl = String(process.env.OTP_MAILER_URL || '').trim();
  const mailerToken = String(process.env.OTP_MAILER_TOKEN || '');
  if (mailerUrl || mailerToken) {
    if (!mailerUrl || !mailerToken) throw new Error('Apps Script mailer requires both OTP_MAILER_URL and OTP_MAILER_TOKEN.');
    let endpoint;
    try { endpoint = new URL(mailerUrl); } catch { throw new Error('OTP_MAILER_URL is invalid.'); }
    if (endpoint.protocol !== 'https:' || endpoint.hostname !== 'script.google.com' ||
        !/^\/macros\/s\/[^/]+\/exec\/?$/.test(endpoint.pathname)) {
      throw new Error('OTP_MAILER_URL must be a Google Apps Script Web App /exec URL.');
    }
    if (mailerToken.length < 32) throw new Error('OTP_MAILER_TOKEN must be at least 32 characters.');
    let response;
    try {
      response = await fetch(endpoint.toString(), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'invitation', token: mailerToken, to: invitation.email,
          username: String(invitation.username || '').slice(0, 60),
          role: roleLabel, link
        }),
        signal: AbortSignal.timeout(20000),
        redirect: 'follow'
      });
    } catch (error) {
      throw new Error('Apps Script invitation mailer request failed: ' + String(error.name || 'network error'));
    }
    let result;
    try { result = JSON.parse(await response.text()); }
    catch { throw new Error('Apps Script invitation mailer returned an invalid response.'); }
    if (!response.ok || result.success !== true) {
      throw new Error('Apps Script invitation mailer failed: ' + String(result.error || 'request rejected').slice(0, 120));
    }
    return;
  }

  const transporter = createMailer();
  const from = String(process.env.SMTP_FROM || process.env.SMTP_USER || '').trim();
  await transporter.sendMail({
    from, to: invitation.email,
    subject: 'FAZ NETWORK — invitation to join as ' + roleLabel,
    text: 'Hello ' + invitation.username + ',\\n\\nYou have been invited to join FAZ NETWORK as ' + roleLabel + '. Open this secure link to verify your email with an OTP and set your own password:\\n\\n' + link + '\\n\\nThis invitation expires in 24 hours and can be cancelled by the administrator. If you were not expecting this, ignore this email.',
    html: '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;color:#0f172a"><h2>FAZ <span style="color:#059669">NETWORK</span></h2><p>Hello ' + escapeHtml(invitation.username) + ',</p><p>You have been invited to join FAZ NETWORK as <b>' + escapeHtml(roleLabel) + '</b>.</p><p>Open the secure invitation link below. We will send a one-time verification code to this email before you can set your password.</p><p style="margin:28px 0"><a href="' + escapeHtml(link) + '" style="background:#047857;color:white;text-decoration:none;padding:14px 22px;border-radius:10px;font-weight:700">Accept invitation</a></p><p>If the button does not work, copy this link into your browser:</p><p style="word-break:break-all">' + escapeHtml(link) + '</p><p>This invitation expires in <b>24 hours</b> and can be cancelled by the administrator. If you were not expecting this, ignore this email.</p></div>'
  });
}

async function createUser(req, res) {
  const username = String(req.body?.username || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const role = normalizeRole(req.body?.role);
  if (!/^[a-zA-Z0-9._-]{3,60}$/.test(username)) return res.status(400).json({ success: false, message: 'Username must be 3-60 characters (letters, numbers, dot, underscore or hyphen).' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
  if (!['staff','admin','super_admin'].includes(role)) return res.status(400).json({ success: false, message: 'Select a valid role.' });
  if (req.auth?.role === 'admin' && role !== 'staff') return res.status(403).json({ success: false, message: 'Admins may invite staff accounts only.' });
  if (req.auth?.role !== 'super_admin' && role === 'super_admin') return res.status(403).json({ success: false, message: 'Only the owner may invite a Super Admin.' });
  try {
    const existing = await db.query(
      "SELECT 1 FROM admin_users WHERE lower(username)=lower($1) OR lower(email)=lower($2) UNION ALL SELECT 1 FROM admin_invitations WHERE status='pending' AND (lower(username)=lower($1) OR lower(email)=lower($2)) LIMIT 1",
      [username, email]
    );
    if (existing.rows.length) return res.status(409).json({ success: false, message: 'Username or email is already registered or has a pending invitation.' });
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const created = await db.query(
      "INSERT INTO admin_invitations (username,email,role,token_hash,status,created_by,expires_at) VALUES ($1,$2,$3,$4,'pending',$5,$6) RETURNING id,username,email,role,status,created_at,expires_at",
      [username,email,role,tokenHash,String(req.session.adminUser || 'owner'),expiresAt]
    );
    try {
      await sendInvitationEmail(created.rows[0], rawToken);
    } catch (mailError) {
      await db.query("UPDATE admin_invitations SET status='failed', token_hash=NULL, updated_at=NOW() WHERE id=$1 AND status='pending'", [created.rows[0].id]).catch(()=>{});
      console.error('[RBAC invitation] Email delivery failed:', mailError.message);
      return res.status(503).json({ success: false, message: 'Invitation email was NOT sent. Configure SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM in Render, then create the invitation again.' });
    }
    await writeAudit(req, 'admin_invitation_created', null, { username, email, role, invitationId: created.rows[0].id });
    return res.status(201).json({ success: true, invitation: created.rows[0], message: 'Invitation link sent to ' + email + '. The account will be created only after email OTP verification and password setup.' });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Username or email is already registered.' });
    console.error('[RBAC] Invitation creation failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to create invitation.' });
  }
}

async function resendInvitation(req,res) {
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({success:false,message:'Invalid account ID.'});
  try {
    const result=await db.query("SELECT id,username,email,role,status,is_first_login FROM admin_users WHERE id=$1 LIMIT 1",[id]);
    const user=result.rows[0];
    if(!user)return res.status(404).json({success:false,message:'Account not found.'});
    if(user.is_first_login!==true)return res.status(409).json({success:false,message:'This account has already completed verification.'});
    if(req.auth?.role==='admin'&&user.role!=='staff')return res.status(403).json({success:false,message:'Admins may invite Staff accounts only.'});
    if(req.auth?.role!=='admin'&&req.auth?.role!=='super_admin')return res.status(403).json({success:false,message:'Not authorized.'});
    await db.query("UPDATE admin_invitations SET status='cancelled',token_hash=NULL,otp_code_hash=NULL,otp_expires_at=NULL,updated_at=NOW() WHERE target_user_id=$1 AND status='pending'",[id]);
    const rawToken=crypto.randomBytes(32).toString('base64url');
    const tokenHash=crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt=new Date(Date.now()+24*60*60*1000);
    const invite=await db.query("INSERT INTO admin_invitations (username,email,role,target_user_id,token_hash,status,created_by,expires_at) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7) RETURNING id,username,email,role,status,created_at,expires_at",[user.username,user.email,user.role,id,tokenHash,String(req.session.adminUser||'owner'),expiresAt]);
    try { await sendInvitationEmail(invite.rows[0],rawToken); }
    catch(mailError) {
      await db.query("UPDATE admin_invitations SET status='failed',token_hash=NULL,updated_at=NOW() WHERE id=$1",[invite.rows[0].id]).catch(()=>{});
      console.error('[RBAC invitation] Resend failed:',mailError.message);
      return res.status(503).json({success:false,message:'Invitation email was NOT sent. Configure SMTP_HOST, SMTP_USER, SMTP_PASS and SMTP_FROM in Render.'});
    }
    await writeAudit(req,'admin_invitation_resent',id,{invitationId:invite.rows[0].id,email:user.email,role:user.role});
    return res.json({success:true,message:'Invitation link sent to '+user.email+'.'});
  } catch(error) {
    console.error('[RBAC invitation] Resend failed:',error.message);
    return res.status(500).json({success:false,message:'Unable to resend invitation.'});
  }
}

async function listInvitations(req, res) {
  try {
    const result = req.auth?.role === 'super_admin'
      ? await db.query("SELECT id,username,email,role,status,created_by,created_at,expires_at FROM admin_invitations WHERE status IN ('pending','failed') ORDER BY created_at DESC")
      : await db.query("SELECT id,username,email,role,status,created_by,created_at,expires_at FROM admin_invitations WHERE status IN ('pending','failed') AND role='staff' AND lower(created_by)=lower($1) ORDER BY created_at DESC", [String(req.session.adminUser || '')]);
    return res.json({ success: true, invitations: result.rows });
  } catch (error) {
    console.error('[RBAC] Listing invitations failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to load invitations.' });
  }
}

async function cancelInvitation(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Invalid invitation ID.' });
  try {
    const result = req.auth?.role === 'super_admin'
      ? await db.query("UPDATE admin_invitations SET status='cancelled',token_hash=NULL,otp_code_hash=NULL,otp_expires_at=NULL,updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id,username,email,role", [id])
      : await db.query("UPDATE admin_invitations SET status='cancelled',token_hash=NULL,otp_code_hash=NULL,otp_expires_at=NULL,updated_at=NOW() WHERE id=$1 AND status='pending' AND role='staff' AND lower(created_by)=lower($2) RETURNING id,username,email,role", [id,String(req.session.adminUser || '')]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'Pending invitation not found; it may already be accepted or cancelled.' });
    await writeAudit(req, 'admin_invitation_cancelled', null, { invitationId:id, username:result.rows[0].username, email:result.rows[0].email });
    return res.json({ success: true, message: 'Invitation cancelled. Its link can no longer be used.' });
  } catch (error) {
    console.error('[RBAC] Invitation cancellation failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to cancel invitation.' });
  }
}

async function showInvitation(req, res) {
  const token = String(req.params.token || '');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(400).render('accept-invitation', { invitation:null, token:'', error:'This invitation link is invalid.' });
  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const result = await db.query("SELECT id,username,email,role,expires_at FROM admin_invitations WHERE token_hash=$1 AND status='pending' LIMIT 1",[tokenHash]);
    const invitation = result.rows[0];
    if (!invitation || new Date(invitation.expires_at).getTime() <= Date.now()) return res.status(410).render('accept-invitation', { invitation:null, token:'', error:'This invitation has expired or was cancelled.' });
    return res.set('Cache-Control','no-store').render('accept-invitation',{invitation,token,error:null});
  } catch (error) {
    console.error('[RBAC invitation] Link lookup failed:',error.message);
    return res.status(503).render('accept-invitation',{invitation:null,token:'',error:'Invitation service is temporarily unavailable.'});
  }
}

async function sendInvitationOtp(req, res) {
  const token=String(req.params.token||'');
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(400).json({success:false,message:'Invalid invitation link.'});
  try {
    const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
    const result=await db.query("SELECT id,username,email,role,expires_at FROM admin_invitations WHERE token_hash=$1 AND status='pending' LIMIT 1",[tokenHash]);
    const invite=result.rows[0];
    if(!invite||new Date(invite.expires_at).getTime()<=Date.now()) return res.status(410).json({success:false,message:'Invitation expired or cancelled.'});
    const code=String(crypto.randomInt(0,1000000)).padStart(6,'0');
    const otpHash=crypto.createHmac('sha256',String(process.env.OTP_HASH_SECRET||process.env.ADMIN_SESSION_SECRET||process.env.SESSION_SECRET||'')).update('invite:'+invite.id+':'+code).digest('hex');
    const otpExpires=new Date(Date.now()+OTP_TTL_MS);
    await db.query('UPDATE admin_invitations SET otp_code_hash=$1,otp_expires_at=$2,otp_attempts=0,updated_at=NOW() WHERE id=$3 AND status=\'pending\'',[otpHash,otpExpires,invite.id]);
    try { await sendOtpEmail(invite,code); }
    catch(mailError) {
      await db.query('UPDATE admin_invitations SET otp_code_hash=NULL,otp_expires_at=NULL WHERE id=$1',[invite.id]).catch(()=>{});
      console.error('[RBAC invitation] OTP delivery failed:',mailError.message);
      return res.status(503).json({success:false,message:'Could not send OTP to the invited email. Please retry later.'});
    }
    return res.json({success:true,message:'OTP sent to the invited email. It expires in 5 minutes.'});
  } catch(error) {
    console.error('[RBAC invitation] OTP request failed:',error.message);
    return res.status(503).json({success:false,message:'Unable to send verification code.'});
  }
}

async function acceptInvitation(req, res) {
  const token=String(req.params.token||'');
  const code=String(req.body?.otp||'').trim();
  const password=String(req.body?.password||'');
  const confirmPassword=String(req.body?.confirmPassword||'');
  if(!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return res.status(400).render('accept-invitation',{invitation:null,token:'',error:'Invalid invitation link.'});
  if(!/^\d{6}$/.test(code)) return res.status(400).render('accept-invitation',{invitation:{},token,error:'Enter the 6-digit OTP sent to your email.'});
  if(password.length<12||password.length>128) return res.status(400).render('accept-invitation',{invitation:{},token,error:'Password must be 12–128 characters.'});
  if(password!==confirmPassword) return res.status(400).render('accept-invitation',{invitation:{},token,error:'Passwords do not match.'});
  try {
    const tokenHash=crypto.createHash('sha256').update(token).digest('hex');
    const found=await db.query("SELECT * FROM admin_invitations WHERE token_hash=$1 AND status='pending' LIMIT 1",[tokenHash]);
    const invite=found.rows[0];
    if(!invite||new Date(invite.expires_at).getTime()<=Date.now()) return res.status(410).render('accept-invitation',{invitation:null,token:'',error:'Invitation expired or cancelled.'});
    if(!invite.otp_code_hash||!invite.otp_expires_at||new Date(invite.otp_expires_at).getTime()<=Date.now()||Number(invite.otp_attempts)>=MAX_OTP_ATTEMPTS) return res.status(400).render('accept-invitation',{invitation:invite,token,error:'OTP expired or locked. Request a new code.'});
    const secret=String(process.env.OTP_HASH_SECRET||process.env.ADMIN_SESSION_SECRET||process.env.SESSION_SECRET||'');
    const otpHash=crypto.createHmac('sha256',secret).update('invite:'+invite.id+':'+code).digest('hex');
    if(!safeEqualHex(invite.otp_code_hash,otpHash)) {
      await db.query('UPDATE admin_invitations SET otp_attempts=otp_attempts+1,updated_at=NOW() WHERE id=$1',[invite.id]);
      return res.status(400).render('accept-invitation',{invitation:invite,token,error:'Invalid OTP. Please check the code and retry.'});
    }
    const passwordHash=await bcrypt.hash(password,12);
    let created;
    if(invite.target_user_id) {
      created=await db.query("UPDATE admin_users SET password_hash=$1,role=$2,is_first_login=FALSE,otp_code_hash=NULL,otp_expires_at=NULL,otp_attempts=0,status='active',updated_at=NOW() WHERE id=$3 AND is_first_login=TRUE AND lower(email)=lower($4) RETURNING id,username,email,role,status,created_at",[passwordHash,invite.role,invite.target_user_id,invite.email]);
      if(!created.rows.length)return res.status(409).render('accept-invitation',{invitation:null,token:'',error:'This account is no longer pending verification. Contact the administrator.'});
    } else {
      const exists=await db.query("SELECT 1 FROM admin_users WHERE lower(username)=lower($1) OR lower(email)=lower($2) LIMIT 1",[invite.username,invite.email]);
      if(exists.rows.length) return res.status(409).render('accept-invitation',{invitation:invite,token,error:'This username or email has already been registered. Contact the administrator.'});
      created=await db.query("INSERT INTO admin_users (username,email,password_hash,role,is_first_login,otp_code_hash,otp_expires_at,otp_attempts,status,created_by) VALUES ($1,$2,$3,$4,FALSE,NULL,NULL,0,'active',$5) RETURNING id,username,email,role,status,created_at",[invite.username,invite.email,passwordHash,invite.role,invite.created_by]);
    }
    const consumed=await db.query("UPDATE admin_invitations SET status='accepted',token_hash=NULL,otp_code_hash=NULL,otp_expires_at=NULL,updated_at=NOW() WHERE id=$1 AND status='pending' RETURNING id",[invite.id]);
    if(!consumed.rows.length) {
      return res.status(409).render('accept-invitation',{invitation:null,token:'',error:'This invitation has already been used or cancelled.'});
    }
    await writeAudit(req,'admin_invitation_accepted',created.rows[0].id,{invitationId:invite.id,username:invite.username,role:invite.role});
    return res.render('accept-invitation-success',{username:invite.username});
  } catch(error) {
    if(error.code==='23505') return res.status(409).render('accept-invitation',{invitation:null,token:'',error:'Username or email has already been registered.'});
    console.error('[RBAC invitation] Acceptance failed:',error.message);
    return res.status(503).render('accept-invitation',{invitation:null,token:'',error:'Unable to complete invitation. Please retry or contact the administrator.'});
  }
}

async function updateUserStatus(req, res) {
  const id = Number(req.params.id);
  const status = String(req.body?.status || '').toLowerCase();
  if (!Number.isSafeInteger(id) || id < 1 || !['active', 'disabled'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid user or status.' });
  try {
    const target = await db.query('SELECT id, role FROM admin_users WHERE id=$1 LIMIT 1', [id]);
    if (!target.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    if (req.auth?.role !== 'super_admin' && req.auth?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to change account status.' });
    }
    if (req.auth?.role === 'admin' && target.rows[0].role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Admins may manage staff accounts only.' });
    }
    if (req.session.userId && Number(req.session.userId) === id && status === 'disabled') return res.status(400).json({ success: false, message: 'You cannot disable your own account.' });
    const result = await db.query('UPDATE admin_users SET status=$1, updated_at=NOW(), otp_code_hash=NULL, otp_expires_at=NULL WHERE id=$2 RETURNING id,username,email,role,status', [status, id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User not found.' });
    await writeAudit(req, 'admin_user_status_changed', id, { status });
    return res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    console.error('[RBAC] Status update failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to update account status.' });
  }
}


async function deleteUser(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({ success: false, message: 'Invalid user ID.' });
  }
  if (req.session.userId && Number(req.session.userId) === id) {
    return res.status(400).json({ success: false, message: 'You cannot delete your own account.' });
  }
  try {
    const targetResult = await db.query('SELECT id, username, role FROM admin_users WHERE id=$1 LIMIT 1', [id]);
    const target = targetResult.rows?.[0];
    if (!target) return res.status(404).json({ success: false, message: 'User not found.' });
    // The legacy owner session is the only super-admin identity that is
    // not stored in admin_users. Owner can remove stale DB-backed super_admin
    // rows; ordinary Admin accounts remain restricted to Staff.
    if (req.auth?.role === 'admin' && target.role !== 'staff') {
      return res.status(403).json({ success: false, message: 'Admins may delete staff accounts only.' });
    }
    if (req.auth?.role !== 'super_admin' && req.auth?.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You do not have permission to delete accounts.' });
    }
    const result = req.auth?.role === 'super_admin'
      ? await db.query('DELETE FROM admin_users WHERE id=$1 RETURNING id, username, role', [id])
      : await db.query("DELETE FROM admin_users WHERE id=$1 AND role='staff' RETURNING id, username, role", [id]);
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'User was not found or has already been deleted.' });
    await writeAudit(req, 'admin_user_deleted', id, { username: target.username, role: target.role });
    return res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (error) {
    if (error.code === '23503') {
      return res.status(409).json({ success: false, message: 'This account is still referenced by support or audit records and cannot be deleted safely. Disable the account instead.' });
    }
    console.error('[RBAC] User deletion failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to delete account.' });
  }
}

module.exports = { login, showOtp, verifyOtp, showSetPassword, setFirstPassword, listUsers, createUser, listInvitations, cancelInvitation, resendInvitation, showInvitation, sendInvitationOtp, acceptInvitation, updateUserStatus, deleteUser };
