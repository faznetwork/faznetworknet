'use strict';

const db = require('../db');

function validId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function serviceError(message, statusCode = 400, code) {
  return Object.assign(new Error(message), { statusCode, ...(code ? { code } : {}) });
}

function parseBoolean(value, field) {
  if (value === true || value === 1 || ['true', '1', 'on', 'yes'].includes(String(value).toLowerCase())) return true;
  if (value === false || value === 0 || ['false', '0', 'off', 'no'].includes(String(value).toLowerCase())) return false;
  throw serviceError(field + ' must be a boolean value.');
}

function parse(body = {}, partial = false) {
  const data = {};
  const fields = [
    'name', 'area_zone', 'reseller_id', 'vlan_id', 'pppoe_enabled',
    'pppoe_ip_pool', 'hotspot_enabled', 'hotspot_server',
    'hotspot_interface', 'hotspot_vlan_id', 'hotspot_ip_pool',
    'commission_type', 'commission_rate'
  ];
  for (const field of fields) {
    const supplied = Object.prototype.hasOwnProperty.call(body, field);
    if (partial && !supplied) continue;
    if (!partial && !supplied && (field === 'pppoe_enabled' || field === 'hotspot_enabled')) {
      data[field] = field === 'pppoe_enabled';
      continue;
    }
    const value = body[field];
    if (field === 'name' || field === 'area_zone' || field === 'hotspot_server' || field === 'hotspot_interface') {
      data[field] = String(value || '').trim();
    } else if (field === 'reseller_id') {
      data[field] = value == null || value === '' ? null : validId(value);
      if (value != null && value !== '' && data[field] === null) throw serviceError('Invalid reseller_id.');
    } else if (field === 'vlan_id' || field === 'hotspot_vlan_id') {
      data[field] = value == null || value === '' ? null : Number(value);
      if (data[field] !== null && (!Number.isInteger(data[field]) || data[field] < 1 || data[field] > 4094)) {
        throw serviceError('VLAN ID must be between 1 and 4094.');
      }
    } else if (field === 'pppoe_enabled' || field === 'hotspot_enabled') {
      data[field] = parseBoolean(value, field);
    } else if (field === 'pppoe_ip_pool') {
      const supplied = Object.prototype.hasOwnProperty.call(body, 'pppoe_ip_pool')
        ? body.pppoe_ip_pool
        : body.mikrotik_ip_pool;
      if (!partial || Object.prototype.hasOwnProperty.call(body, 'pppoe_ip_pool') || Object.prototype.hasOwnProperty.call(body, 'mikrotik_ip_pool')) {
        data.pppoe_ip_pool = String(supplied || '').trim() || null;
      }
    } else if (field === 'hotspot_ip_pool') {
      data.hotspot_ip_pool = String(value || '').trim() || null;
    } else if (field === 'commission_type') {
      data[field] = String(value || 'percentage').trim().toLowerCase();
    } else if (field === 'commission_rate') {
      data[field] = Number(value ?? 0);
    }
  }

  if (data.name !== undefined && (!data.name || data.name.length > 100)) throw serviceError('POP name is required and limited to 100 characters.');
  if (data.area_zone !== undefined && data.area_zone.length > 150) throw serviceError('Area/zone is limited to 150 characters.');
  if (data.hotspot_server !== undefined && data.hotspot_server.length > 100) throw serviceError('Hotspot Server is limited to 100 characters.');
  if (data.hotspot_interface !== undefined && data.hotspot_interface.length > 100) throw serviceError('Hotspot Interface is limited to 100 characters.');
  if (data.commission_type !== undefined && !['percentage', 'fixed'].includes(data.commission_type)) throw serviceError('Invalid commission_type.');
  if (data.commission_rate !== undefined && (!Number.isFinite(data.commission_rate) || data.commission_rate < 0 ||
      (data.commission_type === 'percentage' && data.commission_rate > 100))) throw serviceError('Invalid commission_rate.');
  return data;
}

function fail(res, error, operation) {
  console.error('[POP API] ' + operation + ':', error);
  return res.status(error.statusCode || 503).json({
    success: false,
    code: error.code || (error.statusCode ? 'POP_VALIDATION_FAILED' : 'POP_OPERATION_FAILED'),
    message: error.statusCode ? error.message : 'POP operation failed.'
  });
}



async function options(req, res) {
  try {
    const role = req.auth?.role;
    if (!['super_admin', 'admin', 'reseller'].includes(role)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to view POP options.' });
    }
    let result;
    if (role === 'reseller') {
      const resellerId = Number(req.auth?.resellerId);
      if (!Number.isSafeInteger(resellerId) || resellerId < 1) {
        return res.status(403).json({ success: false, message: 'Verified reseller identity is required.' });
      }
      result = await db.query(
        `SELECT id,name,area_zone,vlan_id,pppoe_enabled,pppoe_ip_pool
         FROM public.pops
         WHERE reseller_id=$1 AND status='active'
           AND pppoe_enabled=TRUE AND NULLIF(BTRIM(pppoe_ip_pool),'') IS NOT NULL
         ORDER BY name ASC,id ASC`,
        [resellerId]
      );
    } else {
      result = await db.query(
        `SELECT id,name,area_zone,vlan_id,pppoe_enabled,pppoe_ip_pool
         FROM public.pops
         WHERE status='active' AND pppoe_enabled=TRUE
           AND NULLIF(BTRIM(pppoe_ip_pool),'') IS NOT NULL
         ORDER BY name ASC,id ASC`
      );
    }
    return res.json({ success: true, pops: result.rows });
  } catch (error) {
    console.error('[POP API] Active PPPoE options lookup failed:', error);
    return res.status(503).json({ success: false, code: 'POP_OPTIONS_UNAVAILABLE', message: 'Unable to load eligible PPPoE POP options. Please retry.' });
  }
}

async function list(req, res) {
  try {
    // The dual-service migration is forward-only and may not yet be present on
    // every deployed database. Resolve optional columns through the row JSON
    // representation so older POP table shapes remain readable without hiding
    // genuine database errors.
    const bindingAvailability = await db.query(
      "SELECT to_regclass('public.pop_hotspot_bindings') IS NOT NULL AS available"
    );
    const hasHotspotBindings = bindingAvailability.rows?.[0]?.available === true;
    const hotspotJoin = hasHotspotBindings
      ? `LEFT JOIN LATERAL (
           SELECT to_jsonb(hb) AS data
           FROM public.pop_hotspot_bindings hb
           WHERE to_jsonb(hb)->>'pop_id' = p.id::text
           LIMIT 1
         ) hb ON TRUE`
      : 'LEFT JOIN LATERAL (SELECT NULL::jsonb AS data) hb ON TRUE';
    const reseller = req.auth?.role === 'reseller';
    const sql = `SELECT
         p.id,
         p.reseller_id,
         p.name,
         p.area_zone,
         COALESCE(to_jsonb(p)->>'commission_type','percentage') AS commission_type,
         COALESCE((to_jsonb(p)->>'commission_rate')::numeric,0) AS commission_rate,
         COALESCE(to_jsonb(p)->>'status','inactive') AS status,
         (to_jsonb(p)->>'vlan_id')::integer AS vlan_id,
         to_jsonb(p)->>'mikrotik_ip_pool' AS mikrotik_ip_pool,
         COALESCE((to_jsonb(p)->>'pppoe_enabled')::boolean,TRUE) AS pppoe_enabled,
         COALESCE(to_jsonb(p)->>'pppoe_ip_pool',to_jsonb(p)->>'mikrotik_ip_pool') AS pppoe_ip_pool,
         p.created_at,
         p.updated_at,
         r.name AS reseller_name,
         r.username AS reseller_username,
         COUNT(DISTINCT c.id)::int AS customer_count,
         COALESCE(hb.data->>'status'='active',FALSE) AS hotspot_enabled,
         hb.data->>'hotspot_server' AS hotspot_server,
         hb.data->>'hotspot_interface' AS hotspot_interface,
         (hb.data->>'vlan_id')::integer AS hotspot_vlan_id,
         hb.data->>'ip_pool' AS hotspot_ip_pool,
         hb.data->>'status' AS hotspot_binding_status
       FROM public.pops p
       LEFT JOIN public.resellers r ON r.id=p.reseller_id
       LEFT JOIN public.customers c ON c.pop_id=p.id
       ${hotspotJoin}
       ${reseller ? 'WHERE p.reseller_id=$1' : ''}
       GROUP BY p.id,r.id,hb.data
       ORDER BY p.name ASC,p.id ASC`;
    const result = await db.query(sql, reseller ? [req.auth.resellerId] : []);
    return res.json({ success: true, pops: result.rows });
  } catch (error) {
    return fail(res, error, 'List');
  }
}

async function validateResellerOwner(resellerId) {
  if (resellerId == null) return;
  const owner = await db.query("SELECT id FROM public.resellers WHERE id=$1 AND status='active' LIMIT 1", [resellerId]);
  if (!owner.rows.length) throw serviceError('Selected reseller does not exist or is inactive.');
}

async function inspectPopSchema(client) {
  const result = await client.query(`SELECT
    to_regclass('public.pop_hotspot_bindings') IS NOT NULL AS hotspot_bindings_available,
    COALESCE((SELECT array_agg(column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='pops'), ARRAY[]::text[]) AS pop_columns,
    COALESCE((SELECT array_agg(column_name) FROM information_schema.columns WHERE table_schema='public' AND table_name='pop_hotspot_bindings'), ARRAY[]::text[]) AS binding_columns`);
  const schema = result.rows?.[0] || {};
  return { hotspotBindingsAvailable: schema.hotspot_bindings_available === true,
    popColumns: new Set(schema.pop_columns || []), bindingColumns: new Set(schema.binding_columns || []) };
}

function requirePopColumns(schema, fields) {
  const missing = fields.filter(field => !schema.popColumns.has(field));
  if (missing.length) throw serviceError(
    'POP schema is not ready. Missing required POP column(s): ' + missing.join(', ') + '. Apply the approved dual-service POP migration before saving these fields.',
    503, 'POP_SCHEMA_NOT_READY'
  );
}

function requireHotspotBindingSchema(schema, fields) {
  if (!schema.hotspotBindingsAvailable) throw serviceError(
    'Hotspot binding storage is not ready. Apply the approved POP Hotspot binding migration before saving Hotspot settings.',
    503, 'POP_SCHEMA_NOT_READY'
  );
  const missing = fields.filter(field => !schema.bindingColumns.has(field));
  if (missing.length) throw serviceError(
    'POP Hotspot binding schema is incomplete. Missing required column(s): ' + missing.join(', ') + '.',
    503, 'POP_SCHEMA_NOT_READY'
  );
}

async function upsertHotspotBinding(client, popId, config, schema) {
  if (!config.enabled) {
    requireHotspotBindingSchema(schema, ['pop_id','status','updated_at']);
    await client.query("UPDATE public.pop_hotspot_bindings SET status='inactive',updated_at=NOW() WHERE pop_id=$1 AND status<>'inactive'", [popId]);
    return;
  }
  if (!config.server || !config.pool) throw serviceError('Enable Hotspot only after setting a Hotspot Server and Hotspot IP Pool.');
  requireHotspotBindingSchema(schema, ['pop_id','router_key','hotspot_server','hotspot_interface','vlan_id','ip_pool','status','updated_at']);
  await client.query(`INSERT INTO public.pop_hotspot_bindings
    (pop_id,router_key,hotspot_server,hotspot_interface,vlan_id,ip_pool,status,updated_at)
    VALUES ($1,'core_mikrotik',$2,$3,$4,$5,'active',NOW())
    ON CONFLICT (pop_id) DO UPDATE SET hotspot_server=EXCLUDED.hotspot_server,
      hotspot_interface=EXCLUDED.hotspot_interface,vlan_id=EXCLUDED.vlan_id,
      ip_pool=EXCLUDED.ip_pool,status='active',updated_at=NOW()`,
    [popId,config.server,config.interface||null,config.vlanId,config.pool]);
}

async function readPop(client, id, schema) {
  const popSchema = schema || await inspectPopSchema(client);
  const hotspotJoin = popSchema.hotspotBindingsAvailable
    ? `LEFT JOIN LATERAL (SELECT to_jsonb(hb) AS data FROM public.pop_hotspot_bindings hb
        WHERE to_jsonb(hb)->>'pop_id'=p.id::text LIMIT 1) hb ON TRUE`
    : 'LEFT JOIN LATERAL (SELECT NULL::jsonb AS data) hb ON TRUE';
  const result = await client.query(`SELECT p.id,p.reseller_id,p.name,p.area_zone,
    (to_jsonb(p)->>'vlan_id')::integer AS vlan_id,
    COALESCE((to_jsonb(p)->>'pppoe_enabled')::boolean,TRUE) AS pppoe_enabled,
    COALESCE(to_jsonb(p)->>'pppoe_ip_pool',to_jsonb(p)->>'mikrotik_ip_pool') AS pppoe_ip_pool,
    to_jsonb(p)->>'mikrotik_ip_pool' AS mikrotik_ip_pool,
    COALESCE(to_jsonb(p)->>'commission_type','percentage') AS commission_type,
    COALESCE((to_jsonb(p)->>'commission_rate')::numeric,0) AS commission_rate,
    COALESCE(to_jsonb(p)->>'status','inactive') AS status,p.created_at,p.updated_at,
    COALESCE(hb.data->>'status'='active',FALSE) AS hotspot_enabled,
    hb.data->>'hotspot_server' AS hotspot_server,hb.data->>'hotspot_interface' AS hotspot_interface,
    (hb.data->>'vlan_id')::integer AS hotspot_vlan_id,hb.data->>'ip_pool' AS hotspot_ip_pool,
    hb.data->>'status' AS hotspot_binding_status
    FROM public.pops p ${hotspotJoin} WHERE p.id=$1 LIMIT 1`,[id]);
  return result.rows[0] || null;
}

async function create(req, res) {
  try {
    const data = parse(req.body);
    await validateResellerOwner(data.reseller_id);
    const pppoeEnabled = data.pppoe_enabled !== false;
    if (pppoeEnabled && !data.pppoe_ip_pool) {
      throw serviceError('Select a PPPoE IP Pool or disable the PPPoE service for this POP.');
    }
    const hotspotEnabled = data.hotspot_enabled === true;
    const pop = await db.withTransaction(async client => {
      const inserted = await client.query(
        `INSERT INTO public.pops
           (name,area_zone,reseller_id,vlan_id,pppoe_enabled,pppoe_ip_pool,commission_type,commission_rate)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING id`,
        [data.name,data.area_zone,data.reseller_id,data.vlan_id,data.pppoe_enabled ?? true,
          data.pppoe_ip_pool,data.commission_type ?? 'percentage',data.commission_rate ?? 0]
      );
      const id = inserted.rows[0]?.id;
      if (!id) throw new Error('POP insert did not return its new identity.');
      await upsertHotspotBinding(client, id, {
        enabled: hotspotEnabled, server: data.hotspot_server,
        interface: data.hotspot_interface, vlanId: data.hotspot_vlan_id, pool: data.hotspot_ip_pool
      });
      return readPop(client, id);
    });
    return res.status(201).json({ success: true, pop });
  } catch (error) {
    return fail(res, error, 'Create');
  }
}

async function update(req, res) {
  const id = validId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid POP ID.' });
  try {
    const data = parse(req.body, true);
    await validateResellerOwner(data.reseller_id);
    const pop = await db.withTransaction(async client => {
      const schema = await inspectPopSchema(client);
      const currentResult = await client.query('SELECT * FROM public.pops WHERE id=$1 FOR UPDATE',[id]);
      const current = currentResult.rows[0];
      if (!current) return null;
      const merged = { ...current, ...data };
      if (Object.prototype.hasOwnProperty.call(data,'pppoe_enabled')) requirePopColumns(schema,['pppoe_enabled']);
      if (Object.prototype.hasOwnProperty.call(data,'pppoe_ip_pool')) requirePopColumns(schema,['pppoe_ip_pool']);
      if (data.pppoe_enabled === true && !merged.pppoe_ip_pool) throw serviceError('Select a PPPoE IP Pool before enabling PPPoE for this POP.');
      if (data.pppoe_ip_pool !== undefined && merged.pppoe_enabled && !merged.pppoe_ip_pool) throw serviceError('A PPPoE IP Pool is required while the PPPoE service is enabled.');
      const fields=['name','area_zone','reseller_id','vlan_id','pppoe_enabled','pppoe_ip_pool','commission_type','commission_rate'];
      const updates=fields.filter(field=>Object.prototype.hasOwnProperty.call(data,field));
      if(updates.length){
        requirePopColumns(schema,updates);
        const values=updates.map(field=>data[field]); values.push(id);
        const assignments=updates.map((field,index)=>field+'=$'+(index+1));
        await client.query('UPDATE public.pops SET '+assignments.join(',')+',updated_at=NOW() WHERE id=$'+values.length,values);
      }
      const hotspotFields=['hotspot_enabled','hotspot_server','hotspot_interface','hotspot_vlan_id','hotspot_ip_pool'];
      const hotspotConfigChanged=hotspotFields.some(field=>Object.prototype.hasOwnProperty.call(data,field));
      if(hotspotConfigChanged){
        requireHotspotBindingSchema(schema,['pop_id','status']);
        const bindingResult=await client.query('SELECT to_jsonb(hb) AS data FROM public.pop_hotspot_bindings hb WHERE hb.pop_id=$1 FOR UPDATE',[id]);
        const binding=bindingResult.rows[0]?.data||{};
        const hasField=field=>Object.prototype.hasOwnProperty.call(data,field);
        const config={
          enabled:hasField('hotspot_enabled')?data.hotspot_enabled:binding.status==='active',
          server:hasField('hotspot_server')?data.hotspot_server:binding.hotspot_server,
          interface:hasField('hotspot_interface')?(data.hotspot_interface||null):binding.hotspot_interface,
          vlanId:hasField('hotspot_vlan_id')?data.hotspot_vlan_id:binding.vlan_id,
          pool:hasField('hotspot_ip_pool')?data.hotspot_ip_pool:binding.ip_pool
        };
        await upsertHotspotBinding(client,id,config,schema);
      }
      return readPop(client,id,schema);
    });
    if(!pop) return res.status(404).json({success:false,message:'POP not found.'});
    return res.json({success:true,pop});
  } catch(error) {
    return fail(res,error,'Update');
  }
}

async function updateStatus(req, res) {
  const id = validId(req.params.id);
  const status = String(req.body?.status || '').toLowerCase();
  if (!id) return res.status(400).json({ success: false, message: 'Invalid POP ID.' });
  if (!['active', 'inactive'].includes(status)) return res.status(400).json({ success: false, message: 'Status must be active or inactive.' });
  try {
    const result = await db.query(
      'UPDATE pops SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,status',
      [status,id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, message: 'POP not found.' });
    return res.json({ success: true, pop: result.rows[0], message: 'POP status updated. Customer records were preserved.' });
  } catch (error) {
    return fail(res, error, 'Status update');
  }
}

module.exports = { options, list, create, update, updateStatus };
