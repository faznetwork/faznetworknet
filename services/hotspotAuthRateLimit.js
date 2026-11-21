"use strict";

// Shared in-memory rate limiting + lockout for the Hotspot auth surface (H6).
// Replaces the per-IP-only `allowAttempt` in hotspotAuthController and the
// route-local device-lookup limiter. Keys are namespaced ("ip:<ip>",
// "phone:<phone>", "pin:<pin>") so limits cannot be bypassed by spoofing
// X-Forwarded-For for a fresh IP bucket: the phone/PIN buckets still bind.
// Expired buckets are swept on every call AND by a 60s interval so idle
// keys do not leak memory. Hard cap: 10000 keys per map.

const MAX_KEYS = 10000;

function createHotspotAuthRateLimit(options = {}) {
  const now = options.now || Date.now;
  const buckets = new Map(); // key -> { count, resetAt }
  const failures = new Map(); // key -> { count, lockedUntil }

  function sweep() {
    const t = now();
    for (const [key, bucket] of buckets) if (bucket.resetAt <= t) buckets.delete(key);
    for (const [key, entry] of failures) if (entry.lockedUntil && entry.lockedUntil <= t) failures.delete(key);
    if (buckets.size > MAX_KEYS) {
      // Expired buckets are already gone; drop the oldest remaining ones.
      for (const key of buckets.keys()) {
        if (buckets.size <= MAX_KEYS) break;
        buckets.delete(key);
      }
    }
    if (failures.size > MAX_KEYS) {
      for (const key of failures.keys()) {
        if (failures.size <= MAX_KEYS) break;
        failures.delete(key);
      }
    }
  }

  // Returns { allowed, retryAfterMs }. Every call counts one attempt
  // against each key in the window.
  function checkLimit({ keys, limit, windowMs }) {
    sweep();
    const list = (Array.isArray(keys) ? keys : [keys]).map((key) => String(key)).filter(Boolean);
    const t = now();
    let retryAfterMs = 0;
    for (const key of list) {
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= t) {
        bucket = { count: 0, resetAt: t + windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (bucket.count > limit) retryAfterMs = Math.max(retryAfterMs, bucket.resetAt - t);
    }
    return { allowed: retryAfterMs <= 0, retryAfterMs };
  }

  function isLocked(key) {
    sweep();
    const entry = failures.get(String(key));
    return Boolean(entry && entry.lockedUntil && entry.lockedUntil > now());
  }

  function lockRemainingMs(key) {
    const entry = failures.get(String(key));
    if (!entry || !entry.lockedUntil) return 0;
    return Math.max(0, entry.lockedUntil - now());
  }

  // Records one failure for a key. After maxFailures consecutive failures
  // the key is locked for lockMs. Returns { locked, failures }.
  function recordFailure(key, { maxFailures, lockMs }) {
    sweep();
    const k = String(key);
    const entry = failures.get(k) || { count: 0, lockedUntil: 0 };
    entry.count += 1;
    if (entry.count >= maxFailures) entry.lockedUntil = now() + lockMs;
    failures.set(k, entry);
    return { locked: Boolean(entry.lockedUntil && entry.lockedUntil > now()), failures: entry.count };
  }

  function clearFailures(key) {
    failures.delete(String(key));
  }

  function __resetForTests() {
    buckets.clear();
    failures.clear();
  }

  return { checkLimit, isLocked, lockRemainingMs, recordFailure, clearFailures, sweep, __resetForTests };
}

const defaultLimiter = createHotspotAuthRateLimit();

// Sweep idle keys every 60s so the maps do not grow unbounded between
// calls. Unref'd so it never holds the process open on its own.
const sweeper = setInterval(() => defaultLimiter.sweep(), 60000);
if (typeof sweeper.unref === "function") sweeper.unref();

module.exports = { ...defaultLimiter, createHotspotAuthRateLimit };
