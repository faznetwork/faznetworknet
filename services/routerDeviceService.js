'use strict';

const { RouterOSAPI } = require('node-routeros');

function normalizeHost(value) {
  const host = String(value || '').trim().replace(/^\[|\]$/g, '');
  if (!host || host.length > 253 || /[\s/@?#]/.test(host) || host.includes('://')) {
    throw Object.assign(new Error('Enter an IPv4 address or hostname without a URL or port.'), { statusCode: 400 });
  }
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (ipv4 && host.split('.').some(part => Number(part) > 255)) {
    throw Object.assign(new Error('Invalid IPv4 address.'), { statusCode: 400 });
  }
  const hostname = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*\.?$/;
  if (!ipv4 && !hostname.test(host)) {
    throw Object.assign(new Error('Host must be a valid IPv4 address or DNS hostname.'), { statusCode: 400 });
  }
  return host;
}

function validateConfig(input) {
  const apiType = String(input.api_type || 'native_api');
  if (!['native_api', 'rest_api'].includes(apiType)) {
    throw Object.assign(new Error('Select Native API or REST API.'), { statusCode: 400 });
  }
  const host = normalizeHost(input.host);
  const username = String(input.username || '').trim();
  const password = String(input.password ?? '');
  const timeout = Number(input.timeout || 8000);
  const useSsl = apiType === 'rest_api' ? true : Boolean(input.use_ssl);
  const port = Number(input.api_port || (apiType === 'rest_api' ? 443 : (useSsl ? 8729 : 8728)));
  if (!username || username.length > 160) throw Object.assign(new Error('RouterOS username is required.'), { statusCode: 400 });
  if (!password || password.length > 1024) throw Object.assign(new Error('RouterOS password is required and must be at most 1024 characters.'), { statusCode: 400 });
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error('API port must be between 1 and 65535.'), { statusCode: 400 });
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 30000) throw Object.assign(new Error('Timeout must be between 1000 and 30000 ms.'), { statusCode: 400 });
  if (apiType === 'native_api' && ![8728, 8729].includes(port)) throw Object.assign(new Error('Native API uses port 8728 or 8729.'), { statusCode: 400 });\n  if (apiType === 'native_api' && ((port === 8729 && !useSsl) || (port === 8728 && useSsl))) throw Object.assign(new Error('Enable API-SSL for port 8729, or disable API-SSL for port 8728.'), { statusCode: 400 });
  if (apiType === 'rest_api' && !useSsl) throw Object.assign(new Error('RouterOS REST API must use HTTPS.'), { statusCode: 400 });
  return { host, apiType, port, username, password, timeout, useSsl };
}

function classifyError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || error || 'Connection failed.');
  if (/AUTH|LOGIN|WRONG USER|INVALID USER|BAD CREDENTIAL/i.test(message) || /^(EAUTH|ELOGIN)$/.test(code)) return { status: 'auth_failed', code: 'AUTH_FAILED', message: 'Authentication failed. Check the RouterOS username and password.' };
  if (/ECONNREFUSED/.test(code) || /connection refused/i.test(message)) return { status: 'offline', code: 'CONNECTION_REFUSED', message: 'Connection refused. Check the host, API service and port.' };
  if (/ETIMEDOUT|TIMEOUT/.test(code) || /timed? ?out|timeout/i.test(message)) return { status: 'offline', code: 'CONNECTION_TIMEOUT', message: 'Connection timed out. Check routing, firewall and API reachability.' };
  if (/ENOTFOUND|EAI_AGAIN/.test(code)) return { status: 'offline', code: 'HOST_NOT_FOUND', message: 'Hostname could not be resolved.' };
  if (/CERT|TLS|SSL/i.test(message) || /CERT|TLS|SSL/.test(code)) return { status: 'offline', code: 'TLS_ERROR', message: 'TLS handshake failed. Check HTTPS/API-SSL configuration and certificate.' };
  return { status: 'offline', code: 'CONNECTION_FAILED', message: 'Connection failed. Check RouterOS API settings and network reachability.' };
}

async function testNative(config) {
  const started = Date.now();
  const router = new RouterOSAPI({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    timeout: Math.ceil(config.timeout / 1000),
    keepalive: false,
    ...(config.useSsl ? { tls: { rejectUnauthorized: false } } : {})
  });
  let connectTimer;
  let handshakeTimer;
  try {
    await Promise.race([
      router.connect(),
      new Promise((_, reject) => { connectTimer = setTimeout(() => reject(Object.assign(new Error('Connection timed out'), { code: 'ETIMEDOUT' })), config.timeout); })
    ]);
    if (connectTimer) clearTimeout(connectTimer);
    const handshake = (async () => {
      const identityRows = await router.write('/system/identity/print');
      const resourceRows = await router.write('/system/resource/print');
      return { identityRows, resourceRows };
    })();
    const { identityRows, resourceRows } = await Promise.race([
      handshake,
      new Promise((_, reject) => { handshakeTimer = setTimeout(() => reject(Object.assign(new Error('Handshake timed out'), { code: 'ETIMEDOUT' })), config.timeout); })
    ]);
    const identity = identityRows?.[0] || {};
    const resource = resourceRows?.[0] || {};
    return {
      status: 'online', latency_ms: Date.now() - started,
      identity: String(identity.name || 'MikroTik'),
      board_model: String(resource['board-name'] || resource.platform || 'Unknown'),
      ros_version: String(resource.version || 'Unknown'),
      cpu_load: Number.isFinite(Number(resource['cpu-load'])) ? Number(resource['cpu-load']) : null
    };
  } finally {
    if (connectTimer) clearTimeout(connectTimer);
    if (handshakeTimer) clearTimeout(handshakeTimer);
    try { router.close(); } catch (_) {}
  }
}

async function testRest(config) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeout);
  const base = 'https://' + config.host + ':' + config.port;
  const headers = { Authorization: 'Basic ' + Buffer.from(config.username + ':' + config.password).toString('base64'), Accept: 'application/json' };
  async function get(path) {
    const response = await fetch(base + path, { method: 'GET', headers, signal: controller.signal });
    if (response.status === 401 || response.status === 403) throw Object.assign(new Error('Authentication failed'), { code: 'EAUTH' });
    if (!response.ok) throw Object.assign(new Error('RouterOS REST returned HTTP ' + response.status), { code: response.status === 404 ? 'EREST404' : 'EREST' });
    return response.json();
  }
  try {
    const [identityRows, resourceRows] = await Promise.all([get('/rest/system/identity'), get('/rest/system/resource')]);
    const identity = Array.isArray(identityRows) ? identityRows[0] || {} : identityRows || {};
    const resource = Array.isArray(resourceRows) ? resourceRows[0] || {} : resourceRows || {};
    return {
      status: 'online', latency_ms: Date.now() - started,
      identity: String(identity.name || 'MikroTik'),
      board_model: String(resource['board-name'] || resource.platform || 'Unknown'),
      ros_version: String(resource.version || 'Unknown'),
      cpu_load: Number.isFinite(Number(resource['cpu-load'])) ? Number(resource['cpu-load']) : null
    };
  } finally {
    clearTimeout(timer);
  }
}

async function testConnection(input) {
  const config = validateConfig(input);
  try {
    const result = config.apiType === 'rest_api' ? await testRest(config) : await testNative(config);
    return { ...result, host: config.host, api_type: config.apiType, api_port: config.port };
  } catch (error) {
    const classified = classifyError(error);
    const response = Object.assign(new Error(classified.message), {
      statusCode: classified.status === 'auth_failed' ? 401 : 503,
      routerStatus: classified.status, errorCode: classified.code,
      latency_ms: null
    });
    throw response;
  }
}

module.exports = { validateConfig, testConnection, classifyError };
