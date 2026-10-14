'use strict';

const db = require('../db');
const credentials = require('../services/deviceCredentials');
const routerDeviceService = require('../services/routerDeviceService');

function clean(value, max = 120) { return String(value ?? '').trim().slice(0, max); }
function isIPv4(value) {
  const parts = String(value || '').trim().split('.');
  return parts.length === 4 && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}
function publicError(res, error) {
  console.error('[Router Device API]', error?.message || error);
  if (error?.code === '23505' || error?.errorCode === 'ROUTER_DUPLICATE') {
    return res.status(error.statusCode || 409).json({ success: false, code: 'ROUTER_DUPLICATE', message: error.message || 'A router with this name or host already exists.' });
  }
  return res.status(error?.statusCode || 500).json({
    success: false,
    code: error?.errorCode || 'ROUTER_DEVICE_ERROR',
    status: error?.routerStatus || 'offline',
    message: error?.message || 'Router device operation failed.'
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

exports.testConnection = async (req, res) => {
  try {
    const input = inputFrom(req.body || {});
    if (!input.router_name) return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Router name is required.' });
    const result = await routerDeviceService.testConnection(input);
    return res.json({ success: true, ...result, message: 'RouterOS handshake successful.' });
  } catch (error) { return publicError(res, error); }
};

exports.addDevice = async (req, res) => {
  try {
    const input = inputFrom(req.body || {});
    if (!input.router_name) return res.status(400).json({ success: false, code: 'VALIDATION_ERROR', message: 'Router name is required.' });

    // Never trust the browser's test badge. Revalidate reachability and credentials immediately before saving.
    const handshake = await routerDeviceService.testConnection(input);
    const encryptedPassword = credentials.encrypt(input.password);
    const apiType = handshake.api_type;
    const ssl = Boolean(handshake.use_ssl);
    const timeout = Number(input.timeout || 8000);

    const saved = await db.withTransaction(async client => {
      const duplicate = await client.query(
        'SELECT id FROM router_devices WHERE lower(router_name)=lower($1) OR (lower(host)=lower($2) AND api_type=$3) LIMIT 1',
        [input.router_name, handshake.host, apiType]
      );
      if (duplicate.rowCount) {
        throw Object.assign(new Error('A router with this name or the same host and API type already exists.'), {
          statusCode: 409, errorCode: 'ROUTER_DUPLICATE'
        });
      }

      const routerResult = await client.query(
        'INSERT INTO router_devices ' +
        '(router_name, host, api_type, api_port, username, password_encrypted, use_ssl, timeout_ms, status, last_synced, board_model, ros_version, cpu_load, identity) ' +
        "VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'online',NOW(),$9,$10,$11,$12) " +
        'RETURNING id, router_name, host, api_type, api_port, username, use_ssl, timeout_ms, status, last_synced, board_model, ros_version, cpu_load, identity, created_at',
        [input.router_name, handshake.host, apiType, handshake.api_port, input.username,
          encryptedPassword, ssl, timeout, handshake.board_model, handshake.ros_version, handshake.cpu_load, handshake.identity]
      );

      // Keep the existing MikroTik Management inventory in sync with the connection record.
      // FQDNs are valid router hosts but cannot be stored in PostgreSQL's INET column, so use NULL there.
      const inventoryResult = await client.query(
        "INSERT INTO network_devices (device_type, name, vendor, model, management_ip, notes, last_seen_at) " +
        "VALUES ('mikrotik',$1,'MikroTik',$2,$3::inet,$4,NOW()) RETURNING id",
        [input.router_name, handshake.board_model || null, isIPv4(handshake.host) ? handshake.host : null,
          'RouterOS identity: ' + String(handshake.identity || input.router_name).slice(0, 240)]
      );

      return { router: routerResult.rows[0], inventory_id: inventoryResult.rows[0]?.id || null };
    });

    return res.status(201).json({
      success: true,
      router: saved.router,
      inventory_id: saved.inventory_id,
      message: 'MikroTik router saved after a successful handshake.'
    });
  } catch (error) { return publicError(res, error); }
};
