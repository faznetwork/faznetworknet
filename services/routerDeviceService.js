'use strict';

const net = require('node:net');
const tls = require('node:tls');
const http = require('node:http');
const https = require('node:https');

const DEFAULT_TIMEOUT_MS = 5000;

function inputError(message) {
  return Object.assign(new Error(message), { statusCode: 400, errorCode: 'VALIDATION_ERROR', routerStatus: 'validation_error' });
}

function normalizeHost(value) {
  const host = String(value || '').trim().replace(/^\[|\]$/g, '');
  if (!host || host.length > 253 || /[\s/@?#]/.test(host) || host.includes('://')) {
    throw inputError('Enter an IPv4 address or hostname without a URL or port.');
  }
  const ipv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host);
  if (ipv4 && host.split('.').some(part => Number(part) > 255)) throw inputError('Invalid IPv4 address.');
  const hostname = /^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*\.?$/;
  if (!ipv4 && !hostname.test(host)) throw inputError('Host must be a valid IPv4 address or DNS hostname.');
  return host;
}

function validateConfig(input) {
  const host = normalizeHost(input.host);
  const username = String(input.username || '').trim();
  const password = String(input.password ?? '');
  const port = Number(input.api_port ?? input.port);
  const timeout = Number(input.timeout || DEFAULT_TIMEOUT_MS);
  if (!String(input.router_name || '').trim()) throw inputError('Router name is required.');
  if (!username || username.length > 160) throw inputError('RouterOS username is required.');
  if (!password || password.length > 1024) throw inputError('RouterOS password is required and must be at most 1024 characters.');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw inputError('Port must be an integer between 1 and 65535.');
  if (!Number.isInteger(timeout) || timeout < 500 || timeout > DEFAULT_TIMEOUT_MS) throw inputError('Timeout must be between 500 and 5000 ms.');
  return { host, username, password, port, timeout };
}

function classifyError(error) {
  const code = String(error?.code || '').toUpperCase();
  const message = String(error?.message || error || 'Connection failed.');
  if (/AUTH|LOGIN|WRONG USER|INVALID USER|BAD CREDENTIAL|NOT ENOUGH PERMISSIONS|POLICY/i.test(message) || /^(EAUTH|ELOGIN)$/.test(code)) {
    return { status: 'auth_failed', code: 'INVALID_CREDENTIALS', message: 'RouterOS rejected the credentials or the account lacks the required api/read policy.' };
  }
  if (/ETIMEDOUT|TIMEOUT|ABORT_ERR/.test(code) || error?.name === 'AbortError' || /timed? ?out|timeout|operation was aborted|aborted/i.test(message)) {
    return { status: 'offline', code: 'TIMEOUT', message: 'Router did not respond within 5 seconds. Check forwarding, routing and firewall rules.' };
  }
  if (/ECONNREFUSED|ECONNRESET|EHOSTUNREACH|ENETUNREACH|ENOTFOUND|EAI_AGAIN|EPIPE/.test(code) || /connection refused|socket hang up|host not found/i.test(message)) {
    return { status: 'offline', code: 'PORT_UNREACHABLE', message: 'Port is unreachable. Check the forwarded port, NAT and firewall rules.' };
  }
  return { status: 'offline', code: 'PORT_UNREACHABLE', message: 'No RouterOS REST or Native API service was detected on this host and port.' };
}

function encodeLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  if (length < 0x4000) return Buffer.from([(length >> 8) | 0x80, length & 0xff]);
  if (length < 0x200000) return Buffer.from([(length >> 16) | 0xc0, (length >> 8) & 0xff, length & 0xff]);
  if (length < 0x10000000) return Buffer.from([(length >> 24) | 0xe0, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff]);
  return Buffer.from([0xf0, (length >> 24) & 0xff, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff]);
}

function decodeLength(buffer, offset) {
  if (offset >= buffer.length) return null;
  const a = buffer[offset];
  if ((a & 0x80) === 0) return { length: a, bytes: 1 };
  if ((a & 0xc0) === 0x80) {
    if (offset + 2 > buffer.length) return null;
    return { length: ((a & 0x3f) << 8) | buffer[offset + 1], bytes: 2 };
  }
  if ((a & 0xe0) === 0xc0) {
    if (offset + 3 > buffer.length) return null;
    return { length: ((a & 0x1f) << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2], bytes: 3 };
  }
  if ((a & 0xf0) === 0xe0) {
    if (offset + 4 > buffer.length) return null;
    return { length: ((a & 0x0f) << 24) | (buffer[offset + 1] << 16) | (buffer[offset + 2] << 8) | buffer[offset + 3], bytes: 4 };
  }
  if (offset + 5 > buffer.length) return null;
  return { length: buffer.readUInt32BE(offset + 1), bytes: 5 };
}

function encodeSentence(words) {
  const chunks = [];
  for (const word of words) {
    const bytes = Buffer.from(String(word), 'utf8');
    chunks.push(encodeLength(bytes.length), bytes);
  }
  chunks.push(Buffer.from([0]));
  return Buffer.concat(chunks);
}

function decodeSentences(buffer) {
  const sentences = [];
  let offset = 0;
  let words = [];
  while (offset < buffer.length) {
    const decoded = decodeLength(buffer, offset);
    if (!decoded) break;
    offset += decoded.bytes;
    if (decoded.length === 0) {
      sentences.push(words);
      words = [];
      continue;
    }
    if (offset + decoded.length > buffer.length) {
      offset -= decoded.bytes;
      break;
    }
    words.push(buffer.toString('utf8', offset, offset + decoded.length));
    offset += decoded.length;
  }
  return { sentences, remaining: buffer.subarray(offset) };
}

function sentenceObject(words) {
  const type = words[0] || '';
  const values = {};
  for (const word of words.slice(1)) {
    if (word.startsWith('=')) {
      const split = word.indexOf('=', 1);
      if (split > 1) values[word.slice(1, split)] = word.slice(split + 1);
    }
  }
  return { type, values };
}

function nativeRequest(config, secure) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    let socket;
    let buffer = Buffer.alloc(0);
    let settled = false;
    let phase = 'login';
    let loginComplete = false;
    const results = {};
    const commands = [
      ['/system/identity/print', 'identity'],
      ['/system/resource/print', 'resource']
    ];
    let commandIndex = 0;
    const timer = setTimeout(() => finish(Object.assign(new Error('RouterOS request timed out'), { code: 'ETIMEDOUT' })), config.timeout);
    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (socket && !socket.destroyed) socket.destroy();
      error ? reject(error) : resolve({ ...value, latency_ms: Date.now() - started, api_type: 'native_api' });
    }
    function send(words) {
      if (socket && !socket.destroyed) socket.write(encodeSentence(words));
    }
    function sendNextCommand() {
      if (commandIndex >= commands.length) {
        const identity = results.identity?.[0] || {};
        const resource = results.resource?.[0] || {};
        return finish(null, formatResource(identity, resource));
      }
      phase = commands[commandIndex][1];
      send([commands[commandIndex][0]]);
    }
    function onData(chunk) {
      buffer = Buffer.concat([buffer, chunk]);
      const decoded = decodeSentences(buffer);
      buffer = decoded.remaining;
      for (const words of decoded.sentences) {
        const sentence = sentenceObject(words);
        if (sentence.type === '!fatal') return finish(Object.assign(new Error(sentence.values.message || 'RouterOS API fatal error'), { code: 'PORT_UNREACHABLE' }));
        if (sentence.type === '!trap') {
          const msg = sentence.values.message || 'RouterOS API rejected the request.';
          const auth = !loginComplete || /not enough permissions|policy|login|password|user/i.test(msg);
          return finish(Object.assign(new Error(msg), { code: auth ? 'EAUTH' : 'EAPI' }));
        }
        if (phase === 'login') {
          if (sentence.type === '!done') {
            loginComplete = true;
            phase = 'commands';
            sendNextCommand();
          }
          continue;
        }
        if (sentence.type === '!re') {
          if (!results[phase]) results[phase] = [];
          results[phase].push(sentence.values);
        } else if (sentence.type === '!done') {
          commandIndex += 1;
          sendNextCommand();
        }
      }
    }
    const options = { host: config.host, port: config.port };
    socket = secure
      ? tls.connect({ ...options, rejectUnauthorized: false, servername: net.isIP(config.host) ? undefined : config.host })
      : net.createConnection(options);
    socket.setTimeout(config.timeout, () => finish(Object.assign(new Error('RouterOS request timed out'), { code: 'ETIMEDOUT' })));
    socket.once('error', error => finish(error));
    socket.once('connect', () => {
      if (secure) return;
      send(['/login', '=name=' + config.username, '=password=' + config.password]);
    });
    if (secure) socket.once('secureConnect', () => send(['/login', '=name=' + config.username, '=password=' + config.password]));
    socket.on('data', onData);
    socket.once('end', () => { if (!settled) finish(Object.assign(new Error('RouterOS closed the connection'), { code: 'ECONNRESET' })); });
  });
}

function formatResource(identity, resource) {
  return {
    status: 'online',
    identity: String(identity.name || 'MikroTik'),
    board_model: String(resource['board-name'] || resource.platform || 'Unknown'),
    architecture: String(resource['architecture-name'] || 'Unknown'),
    ros_version: String(resource.version || 'Unknown'),
    uptime: String(resource.uptime || 'Unknown'),
    cpu_load: Number.isFinite(Number(resource['cpu-load'])) ? Number(resource['cpu-load']) : null,
    api_type: 'native_api'
  };
}

function requestRest(config, protocol, path = '/rest/system/resource') {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const transport = protocol === 'https:' ? https : http;
    const controller = new AbortController();
    const headers = {
      Authorization: 'Basic ' + Buffer.from(config.username + ':' + config.password).toString('base64'),
      Accept: 'application/json'
    };
    const req = transport.request({
      protocol,
      hostname: config.host,
      port: config.port,
      path,
      method: 'GET',
      headers,
      timeout: config.timeout,
      ...(protocol === 'https:' ? { rejectUnauthorized: false, servername: config.host } : {})
    }, response => {
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { data += chunk; if (data.length > 1024 * 1024) req.destroy(new Error('REST response too large')); });
      response.on('end', () => {
        if (response.statusCode === 401 || response.statusCode === 403) return reject(Object.assign(new Error('RouterOS REST authentication or policy failure'), { code: 'EAUTH' }));
        if (response.statusCode === 404 || response.statusCode === 405 || response.statusCode === 400) return reject(Object.assign(new Error('Not a RouterOS REST endpoint'), { code: 'ENOTREST' }));
        if (response.statusCode < 200 || response.statusCode >= 300) return reject(Object.assign(new Error('RouterOS REST HTTP ' + response.statusCode), { code: 'ENOTREST' }));
        let resource;
        try { resource = JSON.parse(data); } catch (_) { return reject(Object.assign(new Error('Non-JSON REST response'), { code: 'ENOTREST' })); }
        resolve({ resource: Array.isArray(resource) ? resource[0] || {} : resource, latency_ms: Date.now() - started, protocol });
      });
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('RouterOS request timed out'), { code: 'ETIMEDOUT' })));
    req.on('error', reject);
    req.end();
  });
}

async function testRest(config, protocol) {
  const result = await requestRest(config, protocol, '/rest/system/resource');
  const identityResult = await requestRest(config, protocol, '/rest/system/identity').catch(() => null);
  // Resource endpoint alone proves REST. Identity is supplemental; it must not make a valid REST handshake fail.
  const identity = identityResult?.resource?.name ? identityResult.resource : {};
  return {
    status: 'online',
    latency_ms: result.latency_ms,
    identity: String(identity.name || 'MikroTik'),
    board_model: String(result.resource['board-name'] || result.resource.platform || 'Unknown'),
    architecture: String(result.resource['architecture-name'] || 'Unknown'),
    ros_version: String(result.resource.version || 'Unknown'),
    uptime: String(result.resource.uptime || 'Unknown'),
    cpu_load: Number.isFinite(Number(result.resource['cpu-load'])) ? Number(result.resource['cpu-load']) : null,
    api_type: 'rest_api',
    use_ssl: protocol === 'https:'
  };
}

async function testConnection(input) {
  const config = validateConfig(input);
  const errors = [];
  for (const protocol of ['https:', 'http:']) {
    try {
      const result = await testRest({ ...config, timeout: Math.min(config.timeout, 700) }, protocol);
      return { ...result, host: config.host, api_port: config.port };
    } catch (error) {
      if (error?.code === 'EAUTH') {
        const classified = classifyError(error);
        throw Object.assign(new Error(classified.message), { statusCode: 401, routerStatus: classified.status, errorCode: classified.code });
      }
      errors.push(error);
    }
  }
  for (const secure of [true, false]) {
    try {
      const result = await nativeRequest({ ...config, timeout: Math.min(config.timeout, 1700) }, secure);
      return { ...result, host: config.host, api_port: config.port, use_ssl: secure };
    } catch (error) {
      errors.push(error);
      if (error?.code === 'EAUTH') {
        const classified = classifyError(error);
        throw Object.assign(new Error(classified.message), { statusCode: 401, routerStatus: classified.status, errorCode: classified.code });
      }
    }
  }
  const best = errors.find(error => error?.code === 'ETIMEDOUT') || errors[errors.length - 1] || new Error('RouterOS service was not detected.');
  const classified = classifyError(best);
  throw Object.assign(new Error(classified.message), {
    statusCode: classified.code === 'INVALID_CREDENTIALS' ? 401 : 503,
    routerStatus: classified.status,
    errorCode: classified.code,
    latency_ms: null
  });
}

module.exports = { validateConfig, testConnection, classifyError, encodeLength, decodeLength, encodeSentence, decodeSentences };
