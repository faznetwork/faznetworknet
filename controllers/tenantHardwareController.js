'use strict';

const db = require('../db');
const credentials = require('../services/deviceCredentials');

function tenantIdFrom(req) {
  const value = Number(req.tenant?.id ?? req.session?.tenantId);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}
function clean(value, max = 160) { return String(value ?? '').trim().slice(0, max); }
function fail(res, error) {
  console.error('[Tenant Hardware]', error?.message || error);
  return res.status(error?.statusCode || 500).json({ success: false, message: error?.message || 'Tenant hardware request failed.' });
}
function encryptRequired(value, label) {
  const result = credentials.encrypt(String(value ?? ''));
  if (!result) throw Object.assign(new Error(label + ' is required.'), { statusCode: 400 });
  return result;
}
function requireTenant(req, res) {
  const id = tenantIdFrom(req);
  if (!id) {
    res.status(403).json({ success: false, code: 'TENANT_CONTEXT_REQUIRED', message: 'This account is not bound to a tenant. Tenant hardware cannot be managed from the platform-owner session.' });
    return null;
  }
  return id;
}

exports.list = async (req, res) => {
  const tenantId = requireTenant(req, res); if (!tenantId) return;
  try {
    const modules = req.tenant?.enabled_modules ?? req.tenant?.modules ?? {};
    const isEnabled = (key) => modules && typeof modules === 'object' && modules[key] === true;
    const [routers, olts] = await Promise.all([
      isEnabled('mikrotik')
        ? db.query('SELECT id, router_name, host, api_port, username, is_active, created_at, updated_at FROM public.tenant_routers WHERE tenant_id=$1 ORDER BY id DESC', [tenantId])
        : Promise.resolve({ rows: [] }),
      isEnabled('olt')
        ? db.query('SELECT id, olt_name, olt_type, ip_address, username, is_active, created_at, updated_at, (snmp_community_encrypted IS NOT NULL) AS snmp_configured, (password_encrypted IS NOT NULL) AS password_configured FROM public.tenant_olts WHERE tenant_id=$1 ORDER BY id DESC', [tenantId])
        : Promise.resolve({ rows: [] })
    ]);
    res.set('Cache-Control', 'no-store, private');
    return res.json({ success: true, routers: routers.rows || [], olts: olts.rows || [] });
  } catch (error) { return fail(res, error); }
};

exports.createRouter = async (req, res) => {
  const tenantId = requireTenant(req, res); if (!tenantId) return;
  try {
    const body = req.body || {};
    const name = clean(body.router_name, 120), host = clean(body.host, 253);
    const port = Number(body.api_port ?? 8728), username = clean(body.username, 160);
    if (!name || !host || !username || !Number.isInteger(port) || port < 1 || port > 65535) {
      return res.status(400).json({ success: false, message: 'Router name, host, username and a valid API port are required.' });
    }
    const password = encryptRequired(body.password, 'Router API password');
    const result = await db.query(
      'INSERT INTO public.tenant_routers(tenant_id,router_name,host,api_port,username,password_encrypted) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,router_name,host,api_port,username,is_active,created_at',
      [tenantId, name, host, port, username, password]
    );
    return res.status(201).json({ success: true, router: result.rows[0] });
  } catch (error) { return fail(res, error); }
};

exports.updateRouter = async (req, res) => {
  const tenantId = requireTenant(req, res); if (!tenantId) return;
  try {
    const id = Number(req.params.id), body = req.body || {};
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: 'Invalid router ID.' });
    const name = clean(body.router_name, 120), host = clean(body.host, 253), username = clean(body.username, 160);
    const port = Number(body.api_port ?? 8728);
    if (!name || !host || !username || !Number.isInteger(port) || port < 1 || port > 65535) return res.status(400).json({ success: false, message: 'Router name, host, username and valid API port are required.' });
    const values = [name, host, port, username, tenantId, id];
    let sql = 'UPDATE public.tenant_routers SET router_name=$1,host=$2,api_port=$3,username=$4,updated_at=NOW() WHERE tenant_id=$5 AND id=$6';
    if (String(body.password ?? '') !== '') { values.push(credentials.encrypt(body.password)); sql = sql.replace('updated_at=NOW()', 'password_encrypted=$7,updated_at=NOW()'); }
    const result = await db.query(sql + ' RETURNING id,router_name,host,api_port,username,is_active,updated_at', values);
    if (!result.rowCount) return res.status(404).json({ success: false, message: 'Router not found for this tenant.' });
    return res.json({ success: true, router: result.rows[0] });
  } catch (error) { return fail(res, error); }
};

exports.deleteRouter = async (req, res) => {
  const tenantId = requireTenant(req, res); if (!tenantId) return;
  try {
    const result = await db.query('DELETE FROM public.tenant_routers WHERE tenant_id=$1 AND id=$2 RETURNING id', [tenantId, Number(req.params.id)]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: 'Router not found for this tenant.' });
    return res.json({ success: true });
  } catch (error) { return fail(res, error); }
};

exports.createOlt = async (req, res) => {
  const tenantId = requireTenant(req, res); if (!tenantId) return;
  try {
    const body = req.body || {};
    const name = clean(body.olt_name, 120), type = clean(body.olt_type, 80), ip = clean(body.ip_address, 253);
    if (!name || !type || !ip) return res.status(400).json({ success: false, message: 'OLT name, type and IP/hostname are required.' });
    const snmp = body.snmp_community ? credentials.encrypt(body.snmp_community) : null;
    const password = body.password ? credentials.encrypt(body.password) : null;
    const result = await db.query(
      'INSERT INTO public.tenant_olts(tenant_id,olt_name,olt_type,ip_address,snmp_community_encrypted,username,password_encrypted) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,olt_name,olt_type,ip_address,username,is_active,created_at',
      [tenantId, name, type, ip, snmp, clean(body.username, 160) || null, password]
    );
    return res.status(201).json({ success: true, olt: result.rows[0] });
  } catch (error) { return fail(res, error); }
};

exports.deleteOlt = async (req, res) => {
  const tenantId = requireTenant(req, res); if (!tenantId) return;
  try {
    const result = await db.query('DELETE FROM public.tenant_olts WHERE tenant_id=$1 AND id=$2 RETURNING id', [tenantId, Number(req.params.id)]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: 'OLT not found for this tenant.' });
    return res.json({ success: true });
  } catch (error) { return fail(res, error); }
};
