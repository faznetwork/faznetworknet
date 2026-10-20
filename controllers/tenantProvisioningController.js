'use strict';

const { withTenantRouter } = require('../services/tenantRouterClient');

function tenantId(req) {
  const id = Number(req.session?.tenantId);
  return req.session?.tenantAdmin === true && Number.isSafeInteger(id) && id > 0 ? id : null;
}
function respondError(res, error) {
  const status = error?.statusCode || 502;
  return res.status(status).json({ success: false, code: error?.code || 'TENANT_ROUTER_OPERATION_FAILED', message: error?.message || 'Tenant router operation failed.' });
}
function clean(value, max = 100) { return String(value ?? '').trim().slice(0, max); }
function routerWord(value, label, max = 100) {
  const v = clean(value, max);
  if (!v || /[\r\n\0]/.test(v)) throw Object.assign(new Error(label + ' is required.'), { statusCode: 400, code: 'INVALID_ROUTER_INPUT' });
  return v;
}
async function execute(req, res, kind) {
  const tid = tenantId(req);
  if (!tid) return res.status(403).json({ success: false, code: 'TENANT_CONTEXT_REQUIRED', message: 'A tenant-admin session is required.' });
  const body = req.body || {};
  const action = clean(body.action, 20).toLowerCase();
  const username = clean(body.username, 100);
  try {
    if (!['create', 'print', 'enable', 'disable'].includes(action)) return res.status(400).json({ success: false, code: 'INVALID_ACTION', message: 'Supported actions are create, print, enable and disable.' });
    if (action !== 'print' && !username) return res.status(400).json({ success: false, code: 'INVALID_ROUTER_INPUT', message: 'Username is required.' });
    const result = await withTenantRouter(tid, async (client) => {
      const base = kind === 'hotspot' ? '/ip/hotspot/user' : '/ppp/secret';
      if (action === 'print') {
        const rows = await client.write(base + '/print');
        return (Array.isArray(rows) ? rows : []).map(row => ({ id: String(row['.id'] || ''), username: String(row.name || ''), profile: String(row.profile || ''), disabled: String(row.disabled || 'false') === 'true', service: String(row.service || '') })).filter(row => row.username);
      }
      const matches = await client.write(base + '/print', ['?name=' + username]);
      const existing = (Array.isArray(matches) ? matches : []).find(row => String(row.name || '').toLowerCase() === username.toLowerCase());
      if (action === 'create') {
        if (existing) throw Object.assign(new Error('That username already exists on this tenant router.'), { statusCode: 409, code: 'ROUTER_USER_EXISTS' });
        const password = routerWord(body.password, 'Password', 128);
        const profile = routerWord(body.profile, 'Profile', 100);
        const params = { name: username, password, profile, comment: 'FAZ tenant ' + tid };
        if (kind === 'pppoe') params.service = 'pppoe';
        await client.write(base + '/add', Object.entries(params).map(([k,v]) => '=' + k + '=' + String(v)));
        return { username, profile, created: true };
      }
      if (!existing) throw Object.assign(new Error('User was not found on this tenant router.'), { statusCode: 404, code: 'ROUTER_USER_NOT_FOUND' });
      await client.write(base + '/set', ['=.id=' + existing['.id'], '=disabled=' + (action === 'disable' ? 'yes' : 'no')]);
      return { username, disabled: action === 'disable' };
    });
    res.set('Cache-Control', 'no-store, private');
    return res.json({ success: true, result });
  } catch (error) { return respondError(res, error); }
}
exports.hotspot = (req, res) => execute(req, res, 'hotspot');
exports.pppoe = (req, res) => execute(req, res, 'pppoe');
