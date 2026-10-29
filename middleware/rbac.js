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

function currentRole(req) {
  // The legacy shared credential intentionally remains a super-admin session.
  if (req.session?.legacySuperAdmin === true) return 'super_admin';
  if (req.session?.isAdmin === true && !req.session?.role && !req.session?.userId) return 'super_admin';
  return normalizeRole(req.session?.role);
}

function requireRole(allowedRoles) {
  const allowed = (Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles])
    .map(normalizeRole).filter(Boolean);
  return async function roleGuard(req, res, next) {
    const principalRole = normalizeRole(req.user?.role || req.session?.role);
    if (principalRole === 'reseller') {
      const resellerId = Number(req.user?.reseller_id || req.user?.resellerId || req.session?.resellerId || req.session?.reseller_id || 0);
      if (!req.user?.role && req.session?.resellerAuthenticated !== true) return res.status(401).json({ success: false, message: 'Reseller authentication required' });
      if (!Number.isSafeInteger(resellerId) || resellerId < 1) return res.status(403).json({ success: false, message: 'Forbidden: reseller identity is missing' });
      if (!allowed.includes('reseller')) return res.status(403).json({ success: false, message: 'Forbidden: insufficient role permissions' });
      try {
        const result = await db.query("SELECT id FROM resellers WHERE id=$1 AND status='active' LIMIT 1", [resellerId]);
        if (!result.rows.length) return res.status(403).json({ success: false, message: 'Reseller account is inactive or unavailable' });
      } catch (error) {
        console.error('[RBAC] Could not verify reseller status:', error.message);
        return res.status(503).json({ success: false, message: 'Authorization service unavailable' });
      }
      req.auth = { ...(req.auth || {}), role: 'reseller', reseller_id: resellerId, userId: resellerId, username: String(req.user?.username || req.session?.resellerUsername || '') };
      return next();
    }
    if (!req.session?.isAdmin) {
      const api = String(req.originalUrl || '').startsWith('/api/');
      return api
        ? res.status(401).json({ success: false, message: 'Authentication required' })
        : res.redirect('/login?next=' + encodeURIComponent(req.originalUrl || '/admin'));
    }
    let role = currentRole(req);
    if (req.session.userId) {
      try {
        const result = await db.query('SELECT role,status FROM admin_users WHERE id=$1 LIMIT 1', [req.session.userId]);
        const account = result.rows?.[0];
        if (!account || account.status !== 'active') {
          return req.session.destroy(() => {
            res.clearCookie('connect.sid', { path: '/' });
            const api = String(req.originalUrl || '').startsWith('/api/');
            return api ? res.status(401).json({ success: false, message: 'Account is inactive. Sign in again.' }) : res.redirect('/login');
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
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role permissions' });
    }
    req.auth = { ...(req.auth || {}), role, userId: req.session.userId || null, username: req.session.adminUser || '' };
    return next();
  };
}

function requireStaffReadOnly(req, res, next) {
  const role = currentRole(req);
  if (role === 'staff' && !['GET', 'HEAD', 'OPTIONS'].includes(String(req.method || '').toUpperCase())) {
    return res.status(403).json({ success: false, message: 'Staff accounts are read-only for this resource' });
  }
  return next();
}

module.exports = { ROLES, normalizeRole, currentRole, requireRole, requireStaffReadOnly };
