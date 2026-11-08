'use strict';
const net = require('node:net');
const db = require('../db');
const credentials = require('../services/deviceCredentials');
const mikrotikService = require('../services/mikrotikService');

async function withTimeout(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getEffectiveTarget(routerId) {
  const router = await withTimeout(
    mikrotikService.resolveActiveRouter(routerId),
    1500,
    'Router device lookup timed out'
  );
  const host = String(router.host || '').trim();
  const port = Number(router.api_port);
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw Object.assign(new Error('The selected router has an invalid host or API port.'), {
      statusCode: 503,
      code: 'INVALID_ROUTER_ENDPOINT'
    });
  }
  return router;
}

function testTcp(host, port, timeoutMs = 2500) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish({ connected: true, message: 'TCP connection succeeded' }));
    socket.once('timeout', () => finish({ connected: false, message: 'TCP connection timed out' }));
    socket.once('error', error => finish({
      connected: false,
      message: error?.code === 'ECONNREFUSED'
        ? 'TCP connection refused'
        : error?.code === 'ENETUNREACH' || error?.code === 'EHOSTUNREACH'
          ? 'Network route unavailable'
          : error?.code === 'ETIMEDOUT'
            ? 'TCP connection timed out'
            : 'TCP connection failed'
    }));
    try {
      socket.connect({ host, port });
    } catch (error) {
      console.error('[MikroTik Diagnostics] TCP connect could not start', {
        host, port, message: error?.message || String(error)
      });
      finish({ connected: false, message: 'TCP connection could not be started' });
    }
  });
}

async function mikrotikTest(req, res) {
  let dbStatus = 'unhealthy';
  let dbError = null;
  let target = null;
  let targetError = null;
  try {
    await withTimeout(db.query('SELECT 1'), 1500, 'Database health check timed out');
    dbStatus = 'healthy';
  } catch (error) {
    dbError = String(error?.message || 'Database check failed');
  }
  try {
    target = await getEffectiveTarget(req.body?.router_id || req.query?.router_id);
  } catch (error) {
    targetError = String(error?.message || 'Router device lookup failed');
    console.error('[MikroTik Diagnostics] Active router resolution failed', {
      code: error?.code || null, message: targetError
    });
  }
  if (!target) {
    return res.status(503).set('Cache-Control', 'no-store').json({
      success: false,
      checkedAt: new Date().toISOString(),
      database: { status: dbStatus, ...(dbError ? { error: dbError } : {}) },
      endpoint: { host: null, port: null, source: 'router_devices' },
      tcp: { status: 'not_checked', message: targetError || 'No active native API router is configured.' },
      routerOS: { status: 'not_checked', error: targetError || 'Router resolution failed.' }
    });
  }

  const host = String(target.host).trim();
  const port = Number(target.api_port);
  const tcp = await testTcp(host, port);
  let router = null;
  let routerError = null;
  if (tcp.connected) {
    try {
      const runtime = await mikrotikService.getMikroTikService(target.id);
      const password = credentials.decrypt(target.password_encrypted);
      router = await withTimeout(
        runtime.testConnection({
          host,
          port,
          user: String(target.username || '').trim(),
          password
        }),
        11000,
        'RouterOS API identity test timed out'
      );
    } catch (error) {
      routerError = String(error?.message || 'RouterOS API test failed');
      console.error('[MikroTik Diagnostics] RouterOS API check failed', {
        routerId: String(target.id), host, port,
        code: error?.code || null, message: routerError
      });
    }
  } else {
    routerError = tcp.message;
  }

  const routerStatus = router ? 'connected' : 'unavailable';
  const success = dbStatus === 'healthy' && tcp.connected && routerStatus === 'connected';
  return res.status(success ? 200 : 503).set('Cache-Control', 'no-store').json({
    success,
    checkedAt: new Date().toISOString(),
    database: { status: dbStatus, ...(dbError ? { error: dbError } : {}) },
    router: { id: String(target.id), name: target.router_name || null },
    endpoint: { host, port, source: 'router_devices' },
    tcp: { status: tcp.connected ? 'connected' : 'failed', message: tcp.message },
    routerOS: {
      status: routerStatus,
      identity: router?.routerName || null,
      board: router?.boardName || router?.model || null,
      version: router?.version || null,
      uptime: router?.uptime || null,
      ...(routerError ? { error: routerError } : {})
    }
  });
}

module.exports = { mikrotikTest };
