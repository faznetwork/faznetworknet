'use strict';

const db = require('../db');
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
function routerParams(params) { return Object.entries(params).map(([key, value]) => '=' + key + '=' + String(value)); }

async function addRouterUser(client, kind, tid, body, username) {
  const base = kind === 'hotspot' ? '/ip/hotspot/user' : '/ppp/secret';
  const password = routerWord(body.password, 'Password', 128);
  const profile = routerWord(body.profile, 'Profile', 100);
  const params = { name: username, password, profile, comment: 'FAZ tenant ' + tid };
  if (kind === 'pppoe') params.service = 'pppoe';
  await client.write(base + '/add', routerParams(params));
  return { base, password, profile };
}
async function removeRouterUser(client, base, username) {
  const rows = await client.write(base + '/print', ['?name=' + username]);
  const row = (Array.isArray(rows) ? rows : []).find(item => String(item.name || '').toLowerCase() === username.toLowerCase());
  if (row && row['.id']) await client.write(base + '/remove', ['=.id=' + row['.id']]);
}
async function saveTenantRecord(kind, tid, body, username, password, profile) {
  return db.withTransaction(async client => {
    if (kind === 'hotspot') {
      const validity = routerWord(body.validity, 'Validity', 50);
      const price = Number(body.price ?? 0);
      if (!Number.isFinite(price) || price < 0) throw Object.assign(new Error('Price must be non-negative.'), { statusCode: 400, code: 'INVALID_ROUTER_INPUT' });
      const result = await client.query(
        `INSERT INTO public.hotspot_vouchers(tenant_id,username,password,profile,validity,price,status,comment)
         VALUES($1,$2,$3,$4,$5,$6,'unused',$7)
         RETURNING id,tenant_id,username,profile,validity,price,status,comment,created_at`,
        [tid, username, password, profile, validity, price, body.comment || null]
      );
      return result.rows[0];
    }
    const phone = routerWord(body.phone, 'Contact phone', 40);
    const fullName = clean(body.full_name || username, 255);
    const result = await client.query(
      `INSERT INTO public.customers
       (tenant_id,full_name,phone,connection_date,username,password,package_name,profile,monthly_bill,status,provisioning_status,remarks)
       VALUES($1,$2,$3,CURRENT_DATE,$4,$5,$6,$7,0,'active','provisioned',$8)
       RETURNING id,tenant_id,full_name,phone,username,package_name,profile,status,provisioning_status,created_at`,
      [tid, fullName, phone, username, password, profile, profile, 'Provisioned via tenant PPPoE form']
    );
    return result.rows[0];
  });
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
        return (Array.isArray(rows) ? rows : []).map(row => ({ id: String(row['.id'] || ''), username: String(row.name || ''), profile: String(row.profile || ''), disabled: ['true','yes'].includes(String(row.disabled || 'false').toLowerCase()), service: String(row.service || '') })).filter(row => row.username);
      }
      const matches = await client.write(base + '/print', ['?name=' + username]);
      const existing = (Array.isArray(matches) ? matches : []).find(row => String(row.name || '').toLowerCase() === username.toLowerCase());
      if (action === 'create') {
        if (existing) throw Object.assign(new Error('That username already exists on this tenant router.'), { statusCode: 409, code: 'ROUTER_USER_EXISTS' });
        let credentials;
        try {
          credentials = await addRouterUser(client, kind, tid, body, username);
        } catch (routerError) {
          try { await removeRouterUser(client, base, username); }
          catch (rollbackError) {
            console.error('[Tenant Provisioning] Router rollback failed after RouterOS create error', { tenantId: tid, kind, username, error: rollbackError.message });
            throw Object.assign(new Error('RouterOS create failed and cleanup could not be confirmed. Check this account on the tenant router.'), { statusCode: 502, code: 'PROVISIONING_ROLLBACK_FAILED', cause: routerError });
          }
          throw routerError;
        }
        const { password, profile } = credentials;
        try {
          const record = await saveTenantRecord(kind, tid, body, username, password, profile);
          return { username, profile, created: true, record };
        } catch (databaseError) {
          try { await removeRouterUser(client, base, username); }
          catch (rollbackError) {
            console.error('[Tenant Provisioning] Router rollback failed after database error', { tenantId: tid, kind, username, error: rollbackError.message });
            throw Object.assign(new Error('Database save failed and router rollback could not be confirmed. Check this account on the tenant router.'), { statusCode: 502, code: 'PROVISIONING_ROLLBACK_FAILED', cause: databaseError });
          }
          throw Object.assign(new Error('Database save failed; the router account was removed.'), { statusCode: databaseError.statusCode || 500, code: 'DATABASE_WRITE_FAILED', cause: databaseError });
        }
      }
      if (!existing) throw Object.assign(new Error('User was not found on this tenant router.'), { statusCode: 404, code: 'ROUTER_USER_NOT_FOUND' });
      const wasDisabled = ['true','yes'].includes(String(existing.disabled || 'false').toLowerCase());
      const shouldDisable = action === 'disable';
      await client.write(base + '/set', ['=.id=' + existing['.id'], '=disabled=' + (shouldDisable ? 'yes' : 'no')]);
      try {
        if (kind === 'hotspot') {
          await db.query("UPDATE public.hotspot_vouchers SET status=$1 WHERE tenant_id=$2 AND username=$3", [shouldDisable ? 'unused' : 'active', tid, username]);
        } else {
          await db.query("UPDATE public.customers SET status=$1,provisioning_status='provisioned',updated_at=NOW() WHERE tenant_id=$2 AND username=$3", [shouldDisable ? 'inactive' : 'active', tid, username]);
        }
      } catch (databaseError) {
        try { await client.write(base + '/set', ['=.id=' + existing['.id'], '=disabled=' + (wasDisabled ? 'yes' : 'no')]); }
        catch (rollbackError) {
          console.error('[Tenant Provisioning] Router toggle rollback failed', { tenantId: tid, kind, username, error: rollbackError.message });
          throw Object.assign(new Error('Database update failed and router state rollback could not be confirmed.'), { statusCode: 502, code: 'PROVISIONING_ROLLBACK_FAILED', cause: databaseError });
        }
        throw Object.assign(new Error('Database update failed; the router setting was restored.'), { statusCode: 500, code: 'DATABASE_WRITE_FAILED', cause: databaseError });
      }
      return { username, disabled: shouldDisable };
    });
    res.set('Cache-Control', 'no-store, private');
    return res.json({ success: true, result });
  } catch (error) { return respondError(res, error); }
}
exports.hotspot = (req, res) => execute(req, res, 'hotspot');
exports.pppoe = (req, res) => execute(req, res, 'pppoe');
