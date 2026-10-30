'use strict';

const ROLES = Object.freeze(['super_admin', 'admin', 'staff', 'reseller']);
const db = require('../db');

function normalizeRole(role) {
  const value = String(role || '').toLowerCase().replace(/[\s_-]/g, '');
  if (value === 'superadmin') return 'super_admin';
  if (value === 'admin') return 'admin';
  if (value === 'staff') return 'staff';
  if (value === 'reseller') return 'reseller';
  return null;
}

function isResellerSession(req) {
  const nested = req.session?.auth?.isReseller === true && normalizeRole(req.session?.auth?.role) === 'reseller';
  const legacy = req.session?.isReseller === true && normalizeRole(req.session?.role) === 'reseller';
  return nested || legacy;
}

function resellerSessionId(req) {
  return Number(req.session?.auth?.resellerId ?? req.session?.resellerId ?? req.session?.reseller_id);
}

function currentRole(req) {
  if (isResellerSession(req)) return 'reseller';
  if (req.session?.legacySuperAdmin === true) return 'super_admin';
  if (req.session?.isAdmin === true && !req.session?.role && !req.session?.userId) return 'super_admin';
  return normalizeRole(req.session?.role);
}

function rejectResellerSession(req, res, reason) {
  const api = String(req.originalUrl || '').startsWith('/api/');
  const session = req.session;

  // A reseller request must never continue when its account is no longer active.
  // Destroy the server-side session before returning an authentication response.
  if (!session || typeof session.destroy !== 'function') {
    console.error('[RBAC] Cannot revoke inactive reseller session: session destroy is unavailable.', { reason });
    res.clearCookie('connect.sid', { path: '/' });
    return api
      ? res.status(503).json({ success: false, message: 'Could not safely revoke the reseller session. Retry sign-in.' })
      : res.status(503).send('Could not safely revoke the reseller session. Please retry sign-in.');
  }

  return session.destroy(error => {
    // Clear the browser cookie even if the backing store reports a destroy error.
    // The error is surfaced because clearing the cookie alone cannot revoke a copied cookie.
    res.clearCookie('connect.sid', { path: '/' });
    if (error) {
      console.error('[RBAC] Failed to destroy inactive reseller session:', error.message, { reason });
      return api
        ? res.status(503).json({ success: false, message: 'Could not safely revoke the reseller session. Retry sign-in.' })
        : res.status(503).send('Could not safely revoke the reseller session. Please retry sign-in.');
    }

    return api
      ? res.status(401).json({ success: false, message: 'Reseller account is inactive or unavailable. Sign in again.' })
      : res.redirect('/reseller/login');
  });
}

function requireRole(allowedRoles) {
  const allowed = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles]).map(normalizeRole).filter(Boolean);
  return async function roleGuard(req, res, next) {
    const roleFromSession = currentRole(req);
    const resellerSession = isResellerSession(req);
    if (!req.session?.isAdmin && !resellerSession) {
      const api = String(req.originalUrl || '').startsWith('/api/');
      return api
        ? res.status(401).json({ success: false, message: 'Authentication required' })
        : res.redirect('/login?next=' + encodeURIComponent(req.originalUrl || '/admin'));
    }

    let role = roleFromSession;
    if (req.session.userId && role !== 'reseller') {
      try {
        const result = await db.query('SELECT role,status FROM admin_users WHERE id=$1 LIMIT 1', [req.session.userId]);
        const account = result.rows?.[0];
        if (!account || account.status !== 'active') {
          return req.session.destroy(() => {
            res.clearCookie('connect.sid', { path: '/' });
            const api = String(req.originalUrl || '').startsWith('/api/');
            return api
              ? res.status(401).json({ success: false, message: 'Account is inactive. Sign in again.' })
              : res.redirect('/login');
          });
        }
        role = normalizeRole(account.role);
        if (!role) return res.status(403).json({ success: false, message: 'Forbidden: invalid account role' });
        req.session.role = role;
      } catch (error) {
        console.error('[RBAC] Could not verify account status:', error.message);
        return res.status(503).json({ success: false, message: 'Authorization service unavailable' });
      }
    }

    if (role === 'reseller') {
      const resellerId = resellerSessionId(req);
      if (!Number.isSafeInteger(resellerId) || resellerId < 1) {
        return rejectResellerSession(req, res, 'invalid_reseller_identity');
      }
      try {
        const verified = await db.query('SELECT id,status FROM resellers WHERE id=$1 LIMIT 1', [resellerId]);
        const reseller = verified.rows?.[0];
        if (!reseller || String(reseller.status).toLowerCase() !== 'active') {
          return rejectResellerSession(req, res, reseller ? 'inactive_reseller' : 'missing_reseller');
        }
        req.auth = { ...(req.auth || {}), role, resellerId: Number(reseller.id) };
      } catch (error) {
        console.error('[RBAC] Could not verify reseller identity:', error.message);
        return res.status(503).json({ success: false, message: 'Authorization service unavailable' });
      }
    }

    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role permissions' });
    }
    req.auth = {
      ...(req.auth || {}),
      role,
      userId: req.session.userId || null,
      username: req.session.adminUser || '',
      ...(role === 'reseller' ? { resellerId: resellerSessionId(req) } : {})
    };
    return next();
  };
}

function requireStaffReadOnly(req, res, next) {
  const role = currentRole(req);
  if (['staff', 'reseller'].includes(role) &&
      !['GET', 'HEAD', 'OPTIONS'].includes(String(req.method || '').toUpperCase())) {
    const accountType = role === 'reseller' ? 'Reseller' : 'Staff';
    return res.status(403).json({
      success: false,
      code: 'READ_ONLY_ACCESS',
      message: accountType + ' accounts are read-only for this resource'
    });
  }
  return next();
}

module.exports = { ROLES, normalizeRole, currentRole, requireRole, requireStaffReadOnly, isResellerSession };
