'use strict';

const crypto = require('crypto');
const db = require('../db');

function clientIdentity(req) {
  const ip = String(req.ip || req.socket?.remoteAddress || 'unknown').trim().slice(0, 128);
  const actor = req.auth?.userId || req.session?.userId || 'anonymous';
  return crypto.createHash('sha256').update(String(actor) + ':' + ip).digest('hex');
}

function createRateLimiter({ name, windowMs, max, message }) {
  if (!name || !Number.isSafeInteger(windowMs) || windowMs < 1000 ||
      !Number.isSafeInteger(max) || max < 1) {
    throw new TypeError('Rate limiter requires a name, positive windowMs, and positive max.');
  }

  return async function postgresRateLimit(req, res, next) {
    const key = name + ':' + clientIdentity(req);
    try {
      const result = await db.query(
        `WITH expired AS (
           SELECT key FROM rate_limits
           WHERE expires_at < NOW()
           ORDER BY expires_at ASC
           LIMIT 100
           FOR UPDATE SKIP LOCKED
         ), cleanup AS (
           DELETE FROM rate_limits WHERE key IN (SELECT key FROM expired)
         )
         INSERT INTO rate_limits (key, window_started_at, request_count, expires_at)
         VALUES ($1, NOW(), 1, NOW() + ($2::bigint * INTERVAL '1 millisecond'))
         ON CONFLICT (key) DO UPDATE SET
           window_started_at = CASE
             WHEN rate_limits.window_started_at <= NOW() - ($2::bigint * INTERVAL '1 millisecond')
             THEN NOW() ELSE rate_limits.window_started_at END,
           request_count = CASE
             WHEN rate_limits.window_started_at <= NOW() - ($2::bigint * INTERVAL '1 millisecond')
             THEN 1 ELSE rate_limits.request_count + 1 END,
           expires_at = CASE
             WHEN rate_limits.window_started_at <= NOW() - ($2::bigint * INTERVAL '1 millisecond')
             THEN NOW() + ($2::bigint * INTERVAL '1 millisecond')
             ELSE rate_limits.expires_at END
         RETURNING request_count,
           GREATEST(1, CEIL(EXTRACT(EPOCH FROM
             (window_started_at + ($2::bigint * INTERVAL '1 millisecond') - NOW()))))::int AS retry_after_seconds`,
        [key, windowMs]
      );
      const row = result.rows[0];
      if (!row) throw new Error('Rate-limit counter did not return its updated state.');
      res.set('RateLimit-Limit', String(max));
      res.set('RateLimit-Remaining', String(Math.max(0, max - Number(row.request_count))));
      res.set('RateLimit-Reset', String(row.retry_after_seconds));
      if (Number(row.request_count) > max) {
        res.set('Retry-After', String(row.retry_after_seconds));
        return res.status(429).json({
          success: false,
          code: 'RATE_LIMITED',
          message: message || 'Too many requests. Please wait before trying again.',
          retryAfter: Number(row.retry_after_seconds)
        });
      }
      return next();
    } catch (error) {
      console.error('[RATE LIMIT] PostgreSQL counter failed:', error.message, { limiter: name });
      return res.status(503).json({
        success: false,
        code: 'RATE_LIMIT_UNAVAILABLE',
        message: 'Request protection is temporarily unavailable. Please retry shortly.'
      });
    }
  };
}

module.exports = {
  createRateLimiter,
  resellerLogin: createRateLimiter({
    name: 'reseller-login', windowMs: 15 * 60 * 1000, max: 10,
    message: 'Too many sign-in attempts. Wait 15 minutes before trying again.'
  }),
  resellerAcceptInvite: createRateLimiter({
    name: 'reseller-accept-invite', windowMs: 15 * 60 * 1000, max: 10,
    message: 'Too many invitation attempts. Wait 15 minutes before trying again.'
  }),
  resellerAdminInvite: createRateLimiter({
    name: 'reseller-admin-invite', windowMs: 60 * 60 * 1000, max: 20
  }),
  resellerAdminResend: createRateLimiter({
    name: 'reseller-admin-resend', windowMs: 60 * 60 * 1000, max: 10
  })
};
