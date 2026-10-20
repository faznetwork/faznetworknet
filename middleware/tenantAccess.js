'use strict';

// Tenant access policy deliberately fails closed for legacy APIs whose tables and
// controller queries are not yet tenant-scoped. Never promote a tenant session
// to isAdmin or let it inherit platform-owner access.
const CORE_MODULES = Object.freeze(['customers', 'hotspot', 'billing', 'pppoe', 'mikrotik', 'olt', 'reports']);

const LEGACY_GLOBAL_API_PREFIXES = Object.freeze([
  '/api/customers', '/api/hotspot', '/api/pppoe', '/api/payments-admin',
  '/api/payments', '/api/reports', '/api/devices', '/api/mikrotik',
  '/api/router', '/api/settings', '/api/ip-pools', '/api/packages',
  '/api/network-map', '/api/olt'
]);

function normalizeModules(input) {
  // PostgreSQL JSONB may be a flat map or an enabled_modules wrapper.
  // Explicit false is respected; missing/malformed core flags retain legacy enabled defaults.
  if (!input || typeof input !== 'object' || Array.isArray(input)) input = {};
  const modules = input.enabled_modules && typeof input.enabled_modules === 'object' && !Array.isArray(input.enabled_modules)
    ? input.enabled_modules
    : input;
  const normalized = Object.fromEntries(
    Object.entries(modules).map(([key, enabled]) => [String(key), enabled === true ? true : enabled === false ? false : undefined])
  );
  for (const key of CORE_MODULES) {
    if (normalized[key] !== true && normalized[key] !== false) normalized[key] = true;
  }
  return Object.freeze(normalized);
}

function moduleEnabled(tenant, moduleName) {
  return normalizeModules(tenant?.modules)[moduleName] === true;
}

function requireTenantModule(moduleName) {
  return function tenantModuleGuard(req, res, next) {
    if (req.session?.tenantAdmin !== true) return next();
    if (!req.tenant) {
      return res.status(403).json({ success: false, code: 'TENANT_CONTEXT_REQUIRED', message: 'Tenant context is required.' });
    }
    if (!moduleEnabled(req.tenant, moduleName)) {
      return res.status(403).json({ success: false, code: 'MODULE_DISABLED', module: moduleName, message: 'This module is not enabled for your tenant.' });
    }
    return next();
  };
}

function tenantLegacyApiGuard(req, res, next) {
  if (req.session?.tenantAdmin !== true) return next();
  const path = String(req.originalUrl || req.path || '').split('?')[0];
  const blocked = LEGACY_GLOBAL_API_PREFIXES.some(prefix => path === prefix || path.startsWith(prefix + '/'));
  if (!blocked) return next();
  return res.status(403).json({
    success: false,
    code: 'TENANT_API_NOT_SCOPED',
    message: 'This API is disabled for tenant sessions until every database query is tenant-scoped. Platform-wide access is not granted.'
  });
}

module.exports = { normalizeModules, moduleEnabled, requireTenantModule, tenantLegacyApiGuard, LEGACY_GLOBAL_API_PREFIXES, CORE_MODULES };
