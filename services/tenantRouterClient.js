'use strict';

const { RouterOSAPI } = require('node-routeros');
const db = require('../db');
const credentials = require('./deviceCredentials');

const NO_ROUTER = () => Object.assign(new Error('No active MikroTik router is configured for this tenant.'), { statusCode: 409, code: 'NO_ROUTER_CONFIGURED' });

async function resolveTenantRouter(tenantId) {
  const id = Number(tenantId);
  if (!Number.isSafeInteger(id) || id < 1) throw Object.assign(new Error('A valid tenant context is required.'), { statusCode: 403, code: 'TENANT_CONTEXT_REQUIRED' });
  const result = await db.query(
    'SELECT id, host, api_port, username, password_encrypted FROM public.tenant_routers WHERE tenant_id=$1 AND is_active=TRUE ORDER BY id DESC LIMIT 1',
    [id]
  );
  const row = result.rows?.[0];
  if (!row) throw NO_ROUTER();
  if (!row.host || !row.username || !row.password_encrypted) throw Object.assign(new Error('The active tenant router is missing connection credentials.'), { statusCode: 503, code: 'ROUTER_CREDENTIALS_UNAVAILABLE' });
  return { id: row.id, host: row.host, port: Number(row.api_port || 8728), user: row.username, password: credentials.decrypt(row.password_encrypted) };
}

// Each call owns its own RouterOS connection. Tenant credentials never enter the
// process-wide platform MikroTik singleton or its connection cache.
async function withTenantRouter(tenantId, operation) {
  const config = await resolveTenantRouter(tenantId);
  const client = new RouterOSAPI({ host: config.host, port: config.port, user: config.user, password: config.password, timeout: 10, keepalive: false });
  try {
    await client.connect();
    return await operation(client, { id: config.id, host: config.host, port: config.port });
  } finally {
    try { if (typeof client.close === 'function') await client.close(); else if (typeof client.disconnect === 'function') await client.disconnect(); } catch (_) {}
  }
}

module.exports = { resolveTenantRouter, withTenantRouter };
