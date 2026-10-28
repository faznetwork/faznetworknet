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
  let unsubscribe = () => {};
  const send = (eventName, payload) => {
    if (closed || res.writableEnded || res.destroyed) return;
    res.write('event: ' + eventName + String.fromCharCode(10));
    res.write('data: ' + JSON.stringify(payload) + String.fromCharCode(10, 10));
  };
  const cleanup = () => {
    if (closed) return;
    closed = true;
    clearInterval(heartbeat);
    unsubscribe();
    req.off('aborted', cleanup);
  };
  const heartbeat = setInterval(() => {
    if (!closed && !res.writableEnded && !res.destroyed) {
      res.write(': heartbeat' + String.fromCharCode(10, 10));
    }
  }, 20000);
  if (typeof heartbeat.unref === 'function') heartbeat.unref();
  unsubscribe = logger.subscribe(entry => send('log', entry));
  req.on('aborted', cleanup);
  res.on('close', cleanup);

  // Subscribe before reading history so entries logged during connection setup are not lost.
  send('history', logger.getRecentLogs());
});

module.exports = router;
