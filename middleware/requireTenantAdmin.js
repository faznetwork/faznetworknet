'use strict';

const db = require('../db');

async function requireTenantAdmin(req, res, next) {
  const tenantId = Number(req.session?.tenantId);
  if (req.session?.tenantAdmin !== true || !Number.isSafeInteger(tenantId) || tenantId < 1) {
    if (String(req.originalUrl || '').startsWith('/api/')) return res.status(401).json({ success: false, code: 'TENANT_LOGIN_REQUIRED', message: 'Sign in through the tenant portal.', redirect: '/tenant/login' });
    return res.redirect('/tenant/login');
  }
  try {
    const result = await db.query(`
      SELECT t.id, t.name, t.slug, t.status, t.modules, s.ends_at
      FROM public.tenants t
      JOIN LATERAL (
        SELECT ends_at FROM public.tenant_subscriptions
        WHERE tenant_id=t.id AND status='active'
        ORDER BY ends_at DESC LIMIT 1
      ) s ON TRUE
      WHERE t.id=$1 AND t.status='active' AND s.ends_at > NOW()
      LIMIT 1
    `, [tenantId]);
    if (!result.rows.length) {
      return req.session.destroy(() => {
        res.clearCookie('connect.sid', { path: '/' });
        if (String(req.originalUrl || '').startsWith('/api/')) return res.status(403).json({ success: false, code: 'TENANT_INACTIVE_OR_EXPIRED', message: 'This tenant is inactive or its subscription has expired.' });
        return res.redirect('/tenant/login?error=inactive');
      });
    }
    req.tenant = result.rows[0];
    res.set('Cache-Control', 'no-store, private');
    return next();
  } catch (error) {
    console.error('[Tenant Auth] Tenant session validation failed:', error.message);
    return res.status(503).json({ success: false, message: 'Tenant authentication service is unavailable.' });
  }
}
module.exports = requireTenantAdmin;
