'use strict';

const util = require('node:util');
const { EventEmitter } = require('node:events');

const BUFFER_LIMIT = 100;
const originalMethods = new Map();
const entries = [];
const stream = new EventEmitter();
stream.setMaxListeners(0);
let nextId = 1;

function redact(value) {
  return String(value)
    .replace(/\b(password|passwd|secret|token|api[_-]?key|authorization|cookie|session)\b\s*([=:])\s*([^\s,;]+)/ig,
      (_match, key, separator) => key + separator + '[REDACTED]')
    .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/-]+=*/ig, '$1 [REDACTED]')
    .replace(/(https?:\/\/)[^/@\s]+:[^/@\s]+@/ig, '$1[REDACTED]@')
    .replace(/(cookie:\s*)[^\r\n]+/ig, '$1[REDACTED]');
}

function normalizeArgs(args) {
  let text;
  try {
    text = util.format(...args);
  } catch (_formatError) {
    text = args.map(value => {
      try { return typeof value === 'string' ? value : String(value); }
      catch (_stringError) { return '[Unserializable log value]'; }
    }).join(' ');
  }
  return redact(text).slice(0, 12000);
}

function publish(level, args) {
  const entry = Object.freeze({
    id: nextId++,
    timestamp: new Date().toISOString(),
    level,
    message: normalizeArgs(args)
  });
  entries.push(entry);
  if (entries.length > BUFFER_LIMIT) entries.splice(0, entries.length - BUFFER_LIMIT);
  // Never log from this broadcast path: console is already wrapped above.
  stream.emit('entry', entry);
}

function wrapConsole(method, level) {
  if (originalMethods.has(method) || typeof console[method] !== 'function') return;
  const original = console[method].bind(console);
  originalMethods.set(method, original);
  console[method] = function liveConsoleCapture(...args) {
    try {
      original(...args);
    } finally {
      publish(level, args);
    }
  };
}

wrapConsole('log', 'log');
wrapConsole('info', 'log');
wrapConsole('debug', 'log');
wrapConsole('warn', 'warn');
wrapConsole('error', 'error');

module.exports = Object.freeze({
  getRecentLogs() {
    return entries.slice();
  },
  subscribe(listener) {
    if (typeof listener !== 'function') throw new TypeError('A log listener function is required.');
    stream.on('entry', listener);
    return () => stream.off('entry', listener);
  },
  getBufferLimit() {
    return BUFFER_LIMIT;
  }
});
