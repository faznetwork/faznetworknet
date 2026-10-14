'use strict';

const db = require('../db');
const credentials = require('../services/deviceCredentials');
const routerDeviceService = require('../services/routerDeviceService');

function clean(value, max = 120) { return String(value ?? '').trim().slice(0, max); }
function publicError(res, error) {
  console.error('[Router Device API]', error?.message || error);
  if (error?.code === '23505') return res.status(409).json({ success: false, code: 'ROUTER_DUPLICATE', message: 'A router with this name or host already exists.' });
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
    api_type: clean(body.api_type, 24),
    api_port: body.api_port,
    username: clean(body.username, 160),
    password: String(body.password ?? ''),
    use_ssl: body.use_ssl === true || body.use_ssl === 'true' || body.use_ssl === 'on',
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
    const duplicate = await db.query(
      "SELECT id, router_name FROM router_devices WHERE lower(router_name)=lower($1) OR (lower(host)=lower($2) AND api_type=$3) LIMIT 1",
      [input.router_name, input.host, input.api_type || 'native_api']
    );
    if (duplicate.rowCount) return res.status(409).json({ success: false, code: 'ROUTER_DUPLICATE', message: 'A router with this name or the same host and API type already exists.' });
    // Never trust the browser's test badge: perform a fresh handshake server-side before persisting.
    const handshake = await routerDeviceService.testConnection(input);
    const encryptedPassword = credentials.encrypt(input.password);
    const result = await db.query(
      `INSERT INTO router_devices
        (router_name, host, api_type, api_port, username, password_encrypted, use_ssl, timeout_ms, status, last_synced, board_model, ros_version, cpu_load, identity)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'online',NOW(),$9,$10,$11,$12)
       RETURNING id, router_name, host, api_type, api_port, username, use_ssl, timeout_ms,
                 status, last_synced, board_model, ros_version, cpu_load, identity, created_at`,
      [input.router_name, handshake.host, handshake.api_type, handshake.api_port, input.username,
       encryptedPassword, input.api_type === 'native_api' ? input.use_ssl : true,
       Number(input.timeout || 8000), handshake.board_model, handshake.ros_version, handshake.cpu_load, handshake.identity]
    );
    return res.status(201).json({ success: true, router: result.rows[0], message: 'MikroTik router saved after a successful handshake.' });
  } catch (error) { return publicError(res, error); }
};
