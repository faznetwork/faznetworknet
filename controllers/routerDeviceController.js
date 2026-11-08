'use strict';
const crypto = require('node:crypto');
const db = require('../db');
const credentials = require('../services/deviceCredentials');
const routerDeviceService = require('../services/routerDeviceService');
const mikrotikService = require('../services/mikrotikService');

function clean(value, max = 120) {
  return String(value ?? '').trim().slice(0, max);
}

const CONNECTION_VERIFICATION_TTL_MS = 2 * 60 * 1000;
const connectionVerifications = new Map();

function connectionFingerprint(input) {
  const normalized = [
    clean(input.router_name, 120),
    clean(input.host, 253).toLowerCase(),
    Number(input.api_port ?? input.port),
    clean(input.username, 160),
    String(input.password ?? ''),
    Math.min(Number(input.timeout) || 5000, 5000)
  ];
  return crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

function issueConnectionVerification(input, handshake) {
  const now = Date.now();
  for (const [token, item] of connectionVerifications) {
    if (item.expiresAt <= now) connectionVerifications.delete(token);
  }
  const token = crypto.randomBytes(32).toString('base64url');
  connectionVerifications.set(token, {
    fingerprint: connectionFingerprint(input),
    handshake,
    expiresAt: now + CONNECTION_VERIFICATION_TTL_MS
  });
  while (connectionVerifications.size > 256) {
    connectionVerifications.delete(connectionVerifications.keys().next().value);
  }
  return token;
}

function consumeConnectionVerification(input, tokenValue) {
  const token = String(tokenValue || '').trim();
  if (!token) return null;
  const verification = connectionVerifications.get(token);
  connectionVerifications.delete(token);
  if (!verification || verification.expiresAt <= Date.now() ||
      verification.fingerprint !== connectionFingerprint(input)) {
    throw Object.assign(
      new Error('The successful connection test expired or the router settings changed. Test the current settings again before saving.'),
      { statusCode: 409, errorCode: 'CONNECTION_TEST_REQUIRED' }
    );
  }
  return verification.handshake;
}
function isIPv4(value) {
  const parts = String(value || '').trim().split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}
function positiveId(value) {
  const id = String(value ?? '').trim();
  if (!/^[1-9]\d*$/.test(id)) {
    throw Object.assign(new Error('A positive integer router ID is required.'), {
      statusCode: 400, errorCode: 'INVALID_ROUTER_ID'
    });
  }
  return id;
}
function publicError(res, error) {
  console.error('[Router Device API]', {
    code: error?.code || error?.errorCode || null,
    message: error?.message || String(error)
  });
  if (error?.code === '23505' || error?.errorCode === 'ROUTER_DUPLICATE') {
    return res.status(error.statusCode || 409).json({
      success: false, code: 'ROUTER_DUPLICATE',
      message: error.message || 'A router with this name or host already exists.'
    });
  }
  return res.status(error?.statusCode || 500).json({
    success: false,
    code: error?.errorCode || 'ROUTER_DEVICE_ERROR',
    status: error?.routerStatus || 'offline',
    message: error?.message || 'Router device operation failed.'
  });
}
function connectionTestError(res, error) {
  const code = String(error?.errorCode || error?.code || '').toUpperCase();
  const authFailure = code === 'INVALID_CREDENTIALS' || code === 'EAUTH';
  const validationFailure = error?.statusCode === 400 || code === 'VALIDATION_ERROR';
  const unreachable = ['TIMEOUT', 'PORT_UNREACHABLE', 'ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET'].includes(code);
  const status = authFailure ? 'auth_failed' : validationFailure ? 'invalid' : unreachable ? 'unreachable' : 'error';
  const httpStatus = validationFailure ? 400 : (authFailure || unreachable) ? 200 : (error?.statusCode || 500);
  if (httpStatus >= 500) {
    console.error('[Router Device API] Connection test failed', { code: code || null, message: error?.message || String(error) });
  } else {
    console.warn('[Router Device API] Connection test failed', { code: code || null, status, message: error?.message || String(error) });
  }
  return res.set('Cache-Control', 'no-store').status(httpStatus).json({
    success: false,
    status,
    code: error?.errorCode || code || 'ROUTER_CONNECTION_FAILED',
    errorCode: error?.errorCode || null,
    message: error?.message || (unreachable ? 'Router is unreachable or its API port is closed.' : 'Router connection test failed.'),
    protocolDiagnostics: Array.isArray(error?.protocolDiagnostics) ? error.protocolDiagnostics : []
  });
}
function inputFrom(body) {
  return {
    router_name: clean(body.router_name, 120),
    host: clean(body.host, 253),
    api_port: body.api_port ?? body.port,
    username: clean(body.username, 160),
    password: String(body.password ?? ''),
    timeout: body.timeout
  };
}
function assertValidInput(input) {
  if (!input.router_name) throw Object.assign(new Error('Router name is required.'), { statusCode: 400, errorCode: 'VALIDATION_ERROR' });
  if (!input.host) throw Object.assign(new Error('Router host/IP is required.'), { statusCode: 400, errorCode: 'VALIDATION_ERROR' });
  if (!input.username) throw Object.assign(new Error('RouterOS API username is required.'), { statusCode: 400, errorCode: 'VALIDATION_ERROR' });
  if (!input.password) throw Object.assign(new Error('RouterOS API password is required.'), { statusCode: 400, errorCode: 'VALIDATION_ERROR' });
}

async function synchronizeExistingInventory(client, oldRouter, handshake, routerName) {
  const oldIp = isIPv4(oldRouter.host) ? oldRouter.host : null;
  const matches = await client.query(
    "SELECT id FROM network_devices WHERE device_type='mikrotik' AND " +
    "(lower(name)=lower($1) OR ($2::inet IS NOT NULL AND management_ip=$2::inet)) ORDER BY id",
    [oldRouter.router_name, oldIp]
  );
  if ((matches.rows || []).length > 1) {
    return { inventory_id: null, inventory_sync: 'ambiguous_existing_inventory' };
  }
  if ((matches.rows || []).length === 0) {
    return { inventory_id: null, inventory_sync: 'not_linked_in_current_schema' };
  }
  const managementIp = isIPv4(handshake.host) ? handshake.host : null;
  const notes = 'RouterOS identity: ' + String(handshake.identity || routerName).slice(0, 240);
  const updated = await client.query(
    "UPDATE network_devices SET name=$1,vendor='MikroTik',model=$2,management_ip=$3::inet," +
    "notes=$4,last_seen_at=NOW(),updated_at=NOW() WHERE id=$5 RETURNING id",
    [routerName, handshake.board_model || null, managementIp, notes, matches.rows[0].id]
  );
  return {
    inventory_id: updated.rows[0]?.id || null,
    inventory_sync: updated.rows[0] ? 'updated_existing_inventory' : 'not_updated'
  };
}

async function invalidateAfterSave(routerId, replaceRecord) {
  try {
    if (replaceRecord) await mikrotikService.runtimePool.replace(routerId, replaceRecord);
    else await mikrotikService.runtimePool.invalidate(routerId);
    return true;
  } catch (error) {
    console.error('[Router Device API] Router record saved but runtime invalidation failed', {
      routerId: String(routerId), message: error?.message || String(error)
    });
    return false;
  }
}

exports.testConnection = async (req, res) => {
  try {
    const input = inputFrom(req.body || {});
    assertValidInput(input);
    const result = await routerDeviceService.testConnection(input);
    const verificationToken = issueConnectionVerification(input, result);
    return res.set('Cache-Control', 'no-store').json({ success: true, status: 'online', ...result, verification_token: verificationToken, message: 'RouterOS handshake successful.' });
  } catch (error) {
    return connectionTestError(res, error);
  }
};

exports.testSavedDevice = async (req, res) => {
  let routerId = null;
  try {
    const id = positiveId(req.params.id);
    routerId = id;
    const result = await db.query(
      "SELECT id,router_name,host,api_port,username,password_encrypted,timeout_ms FROM router_devices WHERE id=$1 LIMIT 2",
      [id]
    );
    if ((result.rows || []).length !== 1) {
      throw Object.assign(new Error('Saved router was not found.'), { statusCode: 404, errorCode: 'ROUTER_NOT_FOUND' });
    }
    const router = result.rows[0];
    const handshake = await routerDeviceService.testConnection({
      router_name: router.router_name,
      host: router.host,
      api_port: router.api_port,
      username: router.username,
      password: credentials.decrypt(router.password_encrypted),
      timeout: Math.min(Number(router.timeout_ms) || 5000, 5000)
    });
    await db.query("UPDATE router_devices SET status='online',last_synced=NOW(),updated_at=NOW() WHERE id=$1", [id])
      .catch(error => console.warn('[Router Device API] Could not persist successful connection check', { routerId: id, message: error?.message || String(error) }));
    return res.set('Cache-Control', 'no-store').json({
      success: true, status: 'online', router_id: String(router.id),
      ...handshake, message: 'RouterOS handshake successful.'
    });
  } catch (error) {
    if (routerId && error?.errorCode !== 'ROUTER_NOT_FOUND' && error?.errorCode !== 'INVALID_ROUTER_ID') {
      const status = error?.routerStatus === 'auth_failed' || error?.errorCode === 'INVALID_CREDENTIALS' ? 'auth_failed' : 'offline';
      await db.query("UPDATE router_devices SET status=$1,updated_at=NOW() WHERE id=$2", [status, routerId])
        .catch(updateError => console.warn('[Router Device API] Could not persist failed connection check', { routerId, message: updateError?.message || String(updateError) }));
    }
    return connectionTestError(res, error);
  }
};

exports.listDevices = async (_req, res) => {
  try {
    const result = await db.query(
      "SELECT id,router_name,host,api_type,api_port,username,use_ssl,timeout_ms,status," +
      "last_synced,board_model,ros_version,cpu_load,identity,is_active " +
      "FROM router_devices ORDER BY is_active DESC,id ASC"
    );
    return res.json({ success: true, devices: result.rows || [] });
  } catch (error) {
    return publicError(res, error);
  }
};

exports.addDevice = async (req, res) => {
  try {
    const input = inputFrom(req.body || {});
    assertValidInput(input);
    const handshake = consumeConnectionVerification(input, req.body?.verification_token) || await routerDeviceService.testConnection(input);
    const encryptedPassword = credentials.encrypt(input.password);
    const apiType = handshake.api_type;
    const ssl = Boolean(handshake.use_ssl);
    const timeout = Number(input.timeout || 5000);

    const saved = await db.withTransaction(async client => {
      const duplicate = await client.query(
        "SELECT id,is_active FROM router_devices " +
        "WHERE lower(router_name)=lower($1) OR (lower(host)=lower($2) AND api_type=$3) " +
        "ORDER BY id FOR UPDATE",
        [input.router_name, handshake.host, apiType]
      );
      if (duplicate.rowCount > 1 || (duplicate.rowCount === 1 && duplicate.rows[0].is_active)) {
        throw Object.assign(
          new Error('A router with this name or host already exists. Use Edit for an existing router.'),
          { statusCode: 409, errorCode: 'ROUTER_DUPLICATE' }
        );
      }

      const values = [
        input.router_name, handshake.host, apiType, handshake.api_port,
        input.username, encryptedPassword, ssl, timeout,
        handshake.board_model, handshake.ros_version, handshake.cpu_load, handshake.identity
      ];
      const routerResult = duplicate.rowCount === 1
        ? await client.query(
            "UPDATE router_devices SET router_name=$1,host=$2,api_type=$3,api_port=$4," +
            "username=$5,password_encrypted=$6,use_ssl=$7,timeout_ms=$8,status='online'," +
            "last_synced=NOW(),board_model=$9,ros_version=$10,cpu_load=$11,identity=$12," +
            "is_active=FALSE,updated_at=NOW() WHERE id=$13 " +
            "RETURNING id,router_name,host,api_type,api_port,username,use_ssl,timeout_ms,status," +
            "last_synced,board_model,ros_version,cpu_load,identity,is_active,created_at",
            [...values, duplicate.rows[0].id]
          )
        : await client.query(
            "INSERT INTO router_devices " +
            "(router_name,host,api_type,api_port,username,password_encrypted,use_ssl,timeout_ms,status,last_synced,board_model,ros_version,cpu_load,identity,is_active) " +
            "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'online',NOW(),$9,$10,$11,$12,FALSE) " +
            "RETURNING id,router_name,host,api_type,api_port,username,use_ssl,timeout_ms,status," +
            "last_synced,board_model,ros_version,cpu_load,identity,is_active,created_at",
            values
          );

      const savedRouter = routerResult.rows[0];
      const managementIp = isIPv4(handshake.host) ? handshake.host : null;
      const notes = 'RouterOS identity: ' + String(handshake.identity || input.router_name).slice(0, 240);
      const inventory = await client.query(
        "SELECT id FROM network_devices WHERE device_type='mikrotik' AND " +
        "(lower(name)=lower($1) OR ($2::inet IS NOT NULL AND management_ip=$2::inet)) " +
        "ORDER BY id LIMIT 2",
        [input.router_name, managementIp]
      );
      if (inventory.rowCount > 1) {
        throw Object.assign(
          new Error('Multiple MikroTik inventory records match this router. Resolve the inventory ambiguity before adding it.'),
          { statusCode: 409, errorCode: 'AMBIGUOUS_DEVICE_INVENTORY' }
        );
      }
      const inventoryResult = inventory.rowCount === 1
        ? await client.query(
            "UPDATE network_devices SET name=$1,vendor='MikroTik',model=$2,management_ip=$3::inet," +
            "notes=$4,last_seen_at=NOW(),updated_at=NOW() WHERE id=$5 RETURNING id",
            [input.router_name, handshake.board_model || null, managementIp, notes, inventory.rows[0].id]
          )
        : await client.query(
            "INSERT INTO network_devices (device_type,name,vendor,model,management_ip,notes,last_seen_at) " +
            "VALUES ('mikrotik',$1,'MikroTik',$2,$3::inet,$4,NOW()) RETURNING id",
            [input.router_name, handshake.board_model || null, managementIp, notes]
          );

      return {
        router: savedRouter,
        inventory_id: inventoryResult.rows[0]?.id || null,
        reused_router_id: duplicate.rowCount === 1
      };
    });

    const invalidated = saved.reused_router_id
      ? await invalidateAfterSave(saved.router.id, null)
      : true;
    if (!invalidated) {
      return res.status(503).json({
        success: false, saved: true, reconnect: 'failed',
        router: saved.router, inventory_id: saved.inventory_id,
        message: 'Router details were saved, but the previous runtime could not be closed. Do not retry Add; inspect the service logs.'
      });
    }
    return res.status(201).json({
      success: true, router: saved.router, inventory_id: saved.inventory_id,
      message: 'MikroTik router saved after a successful handshake.'
    });
  } catch (error) {
    return publicError(res, error);
  }
};

exports.activateDevice = async (req, res) => {
  try {
    const id = positiveId(req.params.id);
    const activated = await db.withTransaction(async client => {
      await client.query("SELECT pg_advisory_xact_lock(71420531, 1)");
      const target = await client.query(
        "SELECT id,api_type FROM router_devices WHERE id=$1 FOR UPDATE",
        [id]
      );
      if ((target.rows || []).length !== 1) {
        throw Object.assign(new Error('Saved router was not found.'), {
          statusCode: 404, errorCode: 'ROUTER_NOT_FOUND'
        });
      }
      if (target.rows[0].api_type !== 'native_api') {
        throw Object.assign(new Error('Only a native RouterOS API device can be the active core router.'), {
          statusCode: 409, errorCode: 'UNSUPPORTED_ROUTER_API_TYPE'
        });
      }
      const previous = await client.query(
        "SELECT id FROM router_devices WHERE is_active=TRUE AND api_type='native_api' AND id<>$1 FOR UPDATE",
        [id]
      );
      await client.query(
        "UPDATE router_devices SET is_active=FALSE,updated_at=NOW() WHERE is_active=TRUE AND api_type='native_api' AND id<>$1",
        [id]
      );
      const result = await client.query(
        "UPDATE router_devices SET is_active=TRUE,updated_at=NOW() WHERE id=$1 " +
        "RETURNING id,router_name,host,api_type,api_port,username,use_ssl,timeout_ms,status,is_active",
        [id]
      );
      return { router: result.rows[0], previousIds: (previous.rows || []).map(row => String(row.id)) };
    });
    try {
      await Promise.all([...activated.previousIds, String(id)].map(routerId =>
        mikrotikService.runtimePool.invalidate(routerId)
      ));
    } catch (error) {
      console.error('[Router Device API] Router activated but runtime pool invalidation failed', {
        routerId: String(id), message: error?.message || String(error)
      });
      mikrotikService.invalidateConfigCache();
      return res.status(503).json({
        success: false, saved: true, reconnect: 'failed', router: activated.router,
        message: 'Router activation was saved, but one or more existing RouterOS runtimes could not be closed. Review service logs before retrying.'
      });
    }
    mikrotikService.invalidateConfigCache();
    return res.set('Cache-Control', 'no-store').json({
      success: true, router: activated.router, message: 'Router activated as the sole core MikroTik router.'
    });
  } catch (error) {
    return publicError(res, error);
  }
};

exports.deactivateDevice = async (req, res) => {
  try {
    const id = positiveId(req.params.id);
    const result = await db.withTransaction(async client => {
      await client.query("SELECT pg_advisory_xact_lock(71420531, 1)");
      const updated = await client.query(
        "UPDATE router_devices SET is_active=FALSE,updated_at=NOW() " +
        "WHERE id=$1 AND api_type='native_api' RETURNING id,is_active",
        [id]
      );
      if ((updated.rows || []).length !== 1) {
        throw Object.assign(new Error('Saved native API router was not found.'), {
          statusCode: 404, errorCode: 'ROUTER_NOT_FOUND'
        });
      }
      return updated.rows[0];
    });
    try {
      await mikrotikService.runtimePool.invalidate(id);
    } catch (error) {
      console.error('[Router Device API] Router deactivated but runtime invalidation failed', {
        routerId: String(id), message: error?.message || String(error)
      });
      mikrotikService.invalidateConfigCache();
      return res.status(503).json({
        success: false, saved: true, reconnect: 'failed', router: result,
        message: 'Router deactivation was saved, but its runtime could not be closed. Review service logs.'
      });
    }
    mikrotikService.invalidateConfigCache();
    return res.set('Cache-Control', 'no-store').json({
      success: true, router: result, message: 'Router deactivated. No core router is currently selected.'
    });
  } catch (error) {
    return publicError(res, error);
  }
};

exports.deleteDevice = async (req, res) => {
  let deletedId = null;
  try {
    const id = positiveId(req.params.id);
    const deleted = await db.withTransaction(async client => {
      await client.query("SELECT pg_advisory_xact_lock(71420531, 1)");
      const target = await client.query(
        "SELECT id,is_active FROM router_devices WHERE id=$1 FOR UPDATE",
        [id]
      );
      if ((target.rows || []).length !== 1) {
        throw Object.assign(new Error('Saved router was not found.'), { statusCode: 404, errorCode: 'ROUTER_NOT_FOUND' });
      }
      if (target.rows[0].is_active) {
        throw Object.assign(new Error('The active gateway cannot be deleted. Activate another router or deactivate this gateway first.'), {
          statusCode: 409, errorCode: 'ACTIVE_ROUTER_DELETE_BLOCKED'
        });
      }
      const result = await client.query(
        "DELETE FROM router_devices WHERE id=$1 AND is_active=FALSE RETURNING id",
        [id]
      );
      if ((result.rows || []).length !== 1) {
        throw Object.assign(new Error('Router changed while deletion was in progress. Refresh and try again.'), {
          statusCode: 409, errorCode: 'ROUTER_DELETE_CONFLICT'
        });
      }
      return result.rows[0];
    });
    deletedId = String(deleted.id);
    try {
      await mikrotikService.runtimePool.invalidate(id);
    } catch (error) {
      console.error('[Router Device API] Router was deleted but its runtime could not be closed', {
        routerId: deletedId, message: error?.message || String(error)
      });
      mikrotikService.invalidateConfigCache();
      return res.status(200).json({
        success: false, deleted: true, router_id: deletedId, reconnect: 'failed',
        message: 'Router was removed, but its runtime could not be closed. Refresh the list and review service logs.'
      });
    }
    mikrotikService.invalidateConfigCache();
    return res.set('Cache-Control', 'no-store').json({
      success: true, deleted: true, router_id: deletedId, message: 'Standby router removed.'
    });
  } catch (error) {
    return publicError(res, error);
  }
};

exports.updateDevice = async (req, res) => {
  let persisted = false;
  try {
    const id = positiveId(req.params.id);
    const existingResult = await db.query(
      "SELECT id,router_name,host,api_type,api_port,username,password_encrypted,use_ssl,timeout_ms,is_active " +
      "FROM router_devices WHERE id=$1 LIMIT 2",
      [id]
    );
    if ((existingResult.rows || []).length !== 1) {
      throw Object.assign(new Error('Active router was not found uniquely.'), {
        statusCode: 404, errorCode: 'ROUTER_NOT_FOUND'
      });
    }
    const existing = existingResult.rows[0];
    if (existing.api_type !== 'native_api') {
      throw Object.assign(new Error('This Edit endpoint currently supports native API routers only.'), {
        statusCode: 409, errorCode: 'UNSUPPORTED_ROUTER_API_TYPE'
      });
    }

    const body = req.body || {};
    const input = {
      router_name: clean(body.router_name ?? existing.router_name, 120),
      host: clean(body.host ?? existing.host, 253),
      api_port: body.api_port ?? body.port ?? existing.api_port,
      username: clean(body.username ?? existing.username, 160),
      password: String(body.password || '') || credentials.decrypt(existing.password_encrypted),
      timeout: body.timeout ?? Math.min(Number(existing.timeout_ms) || 5000, 5000)
    };
    assertValidInput(input);
    const handshake = await routerDeviceService.testConnection(input);
    if (handshake.api_type !== 'native_api') {
      throw Object.assign(new Error('The selected endpoint did not negotiate a native RouterOS API connection.'), {
        statusCode: 409, errorCode: 'UNSUPPORTED_ROUTER_API_TYPE'
      });
    }

    const encryptedPassword = credentials.encrypt(input.password);
    const ssl = Boolean(handshake.use_ssl);
    const timeout = Number(input.timeout || existing.timeout_ms || 5000);
    const saved = await db.withTransaction(async client => {
      const locked = await client.query(
        "SELECT id,router_name,host,api_type,api_port FROM router_devices " +
        "WHERE id=$1 FOR UPDATE",
        [id]
      );
      if ((locked.rows || []).length !== 1) {
        throw Object.assign(new Error('Router was removed or deactivated while the update was being verified.'), {
          statusCode: 409, errorCode: 'ROUTER_CHANGED_DURING_UPDATE'
        });
      }
      const duplicate = await client.query(
        "SELECT id FROM router_devices WHERE id<>$1 AND " +
        "(lower(router_name)=lower($2) OR (lower(host)=lower($3) AND api_type='native_api')) " +
        "ORDER BY id LIMIT 2",
        [id, input.router_name, handshake.host]
      );
      if (duplicate.rowCount > 0) {
        throw Object.assign(new Error('Another router record already uses this name or host. The existing router ID was not changed.'), {
          statusCode: 409, errorCode: 'ROUTER_DUPLICATE'
        });
      }

      const update = await client.query(
        "UPDATE router_devices SET router_name=$1,host=$2,api_type='native_api',api_port=$3," +
        "username=$4,password_encrypted=$5,use_ssl=$6,timeout_ms=$7,status='online'," +
        "last_synced=NOW(),board_model=$8,ros_version=$9,cpu_load=$10,identity=$11,updated_at=NOW() " +
        "WHERE id=$12 " +
        "RETURNING id,router_name,host,api_type,api_port,username,use_ssl,timeout_ms,status," +
        "last_synced,board_model,ros_version,cpu_load,identity,is_active,created_at",
        [
          input.router_name, handshake.host, Number(handshake.api_port), input.username,
          encryptedPassword, ssl, timeout, handshake.board_model || null,
          handshake.ros_version || null, handshake.cpu_load, handshake.identity || null, id
        ]
      );
      if ((update.rows || []).length !== 1) {
        throw Object.assign(new Error('Router update did not affect exactly one active record.'), {
          statusCode: 409, errorCode: 'ROUTER_UPDATE_CONFLICT'
        });
      }
      const inventory = await synchronizeExistingInventory(client, existing, handshake, input.router_name);
      return { router: update.rows[0], ...inventory };
    });

    persisted = true;
    const replacement = {
      id: String(saved.router.id),
      router_name: saved.router.router_name,
      host: saved.router.host,
      api_type: 'native_api',
      api_port: Number(saved.router.api_port),
      is_active: Boolean(saved.router.is_active)
    };
    const replaced = await invalidateAfterSave(id, saved.router.is_active ? replacement : null);
    if (!replaced) {
      return res.status(503).json({
        success: false, saved: true, reconnect: 'failed',
        router: saved.router, inventory_id: saved.inventory_id,
        inventory_sync: saved.inventory_sync,
        message: 'Router details were saved, but the stale RouterOS socket could not be closed. The new runtime was not confirmed.'
      });
    }
    return res.set('Cache-Control', 'no-store').json({
      success: true, saved: true, reconnect: 'runtime_replaced',
      router: saved.router, inventory_id: saved.inventory_id,
      inventory_sync: saved.inventory_sync,
      message: 'Router updated in place. The previous runtime was closed and a fresh runtime instance is installed; it will connect on the next RouterOS operation.'
    });
  } catch (error) {
    if (persisted) {
      console.error('[Router Device API] Post-save runtime transition failed', {
        routerId: String(req.params.id || ''),
        message: error?.message || String(error)
      });
    }
    return publicError(res, error);
  }
};
