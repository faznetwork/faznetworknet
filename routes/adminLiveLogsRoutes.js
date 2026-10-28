'use strict';

const express = require('express');
const logger = require('../services/liveLogger');

const router = express.Router();

router.get('/', (req, res) => {
  // The mount guards populate req.auth from the canonical project RBAC session.
  if (req.auth?.role !== 'super_admin') {
    return res.status(403).json({ success: false, message: 'Forbidden: SuperAdmin access required.' });
  }

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  let closed = false;
  const send = (eventName, payload) => {
    if (closed || res.writableEnded || res.destroyed) return;
    res.write('event: ' + eventName + '\\n');
    res.write('data: ' + JSON.stringify(payload) + '\\n\\n');
  };

  send('history', logger.getRecentLogs());
  const unsubscribe = logger.subscribe(entry => send('log', entry));
  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded && !res.destroyed) res.write(': heartbeat\\n\\n');
  }, 20000);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();

  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
  };
  req.on('aborted', cleanup);
  res.on('close', cleanup);
});

module.exports = router;
