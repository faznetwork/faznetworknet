'use strict';

const bcrypt = require('bcryptjs');
const db = require('../db');

function renderLogin(res, status, error, tenantNumber = '') {
  return res.status(status).set('Cache-Control', 'no-store').render('tenant-login', { error, tenantNumber });
}

async function showLogin(req, res) {
  if (req.session?.tenantAdmin === true && req.session?.tenantId) return res.redirect('/tenant/dashboard');
  return res.set('Cache-Control', 'no-store').render('tenant-login', { error: req.query?.error === 'inactive' ? 'This tenant is inactive or its 30-day subscription has expired.' : null, tenantNumber: String(req.query?.tenant || '') });
}

async function login(req, res) {
  const tenantNumber = String(req.body?.tenantNumber || '').trim();
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');
  if (!/^\d{1,18}$/.test(tenantNumber) || !username || !password) return renderLogin(res, 400, 'Enter your tenant number, email/username, and password.', tenantNumber);
  try {
    const result = await db.query(`
      SELECT t.id AS tenant_id, t.name AS tenant_name, t.status AS tenant_status, t.modules,
             s.ends_at, u.id AS user_id, u.username, u.email, u.password_hash, u.role, u.status AS user_status
      FROM public.tenants t
      JOIN LATERAL (
        SELECT ends_at FROM public.tenant_subscriptions
        WHERE tenant_id=t.id AND status='active'
        ORDER BY ends_at DESC LIMIT 1
      ) s ON TRUE
      JOIN public.admin_users u ON u.tenant_id=t.id
      WHERE t.id=$1 AND t.status='active' AND s.ends_at > NOW()
        AND u.status='active' AND u.role IN ('admin','staff')
        AND (lower(u.email)=lower($2) OR lower(u.username)=lower($2))
      ORDER BY u.id LIMIT 1
    `, [tenantNumber, username]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return renderLogin(res, 401, 'Invalid tenant number, credentials, or the tenant subscription is inactive/expired.', tenantNumber);
    }
    return req.session.regenerate(err => {
      if (err) {
        console.error('[Tenant Auth] Session regeneration failed:', err.message);
        return renderLogin(res, 500, 'Could not initialize a secure session. Please retry.', tenantNumber);
      }
      req.session.tenantAdmin = true;
      req.session.tenantId = Number(user.tenant_id);
      req.session.tenantName = user.tenant_name;
      req.session.isAdmin = false;
      req.session.adminUser = user.username;
      req.session.userId = user.user_id;
      req.session.role = user.role;
      req.session.legacySuperAdmin = false;
      req.session.loginAt = Date.now();
      return req.session.save(saveError => {
        if (saveError) {
          console.error('[Tenant Auth] Session save failed:', saveError.message);
          return renderLogin(res, 500, 'Could not save your session. Please retry.', tenantNumber);
        }
        db.query('UPDATE public.admin_users SET last_login_at=NOW(),updated_at=NOW() WHERE id=$1 AND tenant_id=$2', [user.user_id, user.tenant_id]).catch(() => {});
        return res.redirect('/tenant/dashboard');
      });
    });
  } catch (error) {
    console.error('[Tenant Auth] Login failed:', error.message);
    return renderLogin(res, 503, 'Tenant authentication is temporarily unavailable. Please retry.', tenantNumber);
  }
}

function logout(req, res) {
  if (!req.session) return res.redirect('/tenant/login');
  req.session.destroy(error => {
    if (error) console.error('[Tenant Auth] Logout session destroy failed:', error.message);
    res.clearCookie('connect.sid', { path: '/' });
    return res.redirect('/tenant/login');
  });
}

module.exports = { showLogin, login, logout };
