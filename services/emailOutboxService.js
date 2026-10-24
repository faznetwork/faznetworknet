"use strict";

const crypto = require("crypto");
const db = require("../db");
const { encryptPayload } = require("./emailPayloadCrypto");

const MAX_EVENT_LENGTH = 100;
const MAX_RECIPIENT_LENGTH = 254;

function normalizeEmail(value) {
  const email = String(value || "").trim();
  if (email.length > MAX_RECIPIENT_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("A valid email recipient is required.");
  }
  return email;
}

function makeIdempotencyKey({ idempotencyKey, event, recipient, payload }) {
  const supplied = String(idempotencyKey || "").trim();
  if (supplied) return supplied.slice(0, 200);
  // Stable across retries of the same enqueue request only when caller supplies a key.
  // Random default avoids accidentally suppressing two legitimate identical notifications.
  return crypto.randomUUID();
}

async function enqueueEmail({ event = "manual", to, subject, html, text, idempotencyKey, availableAt = new Date(), expiresAt = null, sensitive = false, client = null } = {}) {
  if (String(process.env.EMAIL_WORKER_ENABLED || "").toLowerCase() !== "true") {
    throw new Error("Native email worker is disabled; email was not queued. Configure EMAIL_WORKER_ENABLED=true before enabling queued email flows.");
  }
  const recipient = normalizeEmail(to);
  const title = String(subject || "").trim();
  const htmlBody = String(html || "");
  const textBody = String(text || "");
  if (!title || title.length > 200) throw new Error("Email subject is required and must not exceed 200 characters.");
  if (!htmlBody.trim() && !textBody.trim()) throw new Error("Email HTML or text body is required.");
  if (!Number.isFinite(new Date(availableAt).getTime())) throw new Error("Email outbox availableAt must be a valid date.");

  const normalizedEvent = String(event || "manual").trim().slice(0, MAX_EVENT_LENGTH) || "manual";
  if (expiresAt !== null && !Number.isFinite(new Date(expiresAt).getTime())) throw new Error("Email outbox expiresAt must be a valid date.");
  const payload = { to: recipient, subject: title, html: htmlBody, text: textBody, event: normalizedEvent, sensitive: Boolean(sensitive), expiresAt: expiresAt === null ? null : new Date(expiresAt).toISOString() };
  const encryptedPayload = encryptPayload(payload);
  const key = makeIdempotencyKey({ idempotencyKey, event: normalizedEvent, recipient, payload });
  const query = client ? client.query.bind(client) : db.query.bind(db);
  const result = await query(
    `INSERT INTO email_outbox
      (idempotency_key, event_key, recipient_address, payload_ciphertext, status, attempts, available_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4,'pending',0,$5,NOW(),NOW())
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id, status, created_at`,
    [key, normalizedEvent, recipient, encryptedPayload, new Date(availableAt)]
  );
  if (result.rows[0]) return { accepted: true, duplicate: false, jobId: result.rows[0].id, status: result.rows[0].status };
  const existing = await query(
    "SELECT id,status,created_at FROM email_outbox WHERE idempotency_key=$1 LIMIT 1",
    [key]
  );
  if (!existing.rows[0]) throw new Error("Email outbox enqueue conflicted but the existing job could not be loaded.");
  return { accepted: true, duplicate: true, jobId: existing.rows[0].id, status: existing.rows[0].status };
}

async function claimBatch({ limit = 10, leaseSeconds = 90 } = {}) {
  const batchSize = Math.max(1, Math.min(50, Math.trunc(Number(limit) || 10)));
  const lease = Math.max(15, Math.min(600, Math.trunc(Number(leaseSeconds) || 90)));
  return db.withTransaction(async client => {
    const result = await client.query(
      `WITH candidates AS (
         SELECT id
         FROM email_outbox
         WHERE ((status='pending' AND available_at <= NOW())
             OR (status='processing' AND lease_until < NOW()))
         ORDER BY available_at ASC, id ASC
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE email_outbox AS job
       SET status='processing',
           attempts=job.attempts+1,
           lease_until=NOW() + ($2::int * INTERVAL '1 second'),
           updated_at=NOW()
       FROM candidates
       WHERE job.id=candidates.id
       RETURNING job.id,job.event_key,job.recipient_address,job.payload_ciphertext,job.attempts,job.created_at`,
      [batchSize, lease]
    );
    return result.rows;
  });
}

async function markDelivered(id, { providerMessageId = null } = {}) {
  const result = await db.query(
    `UPDATE email_outbox
     SET status='sent', provider_message_id=$2, delivered_at=NOW(), lease_until=NULL,
         last_error_code=NULL,last_error_message=NULL,updated_at=NOW()
     WHERE id=$1 AND status='processing'`,
    [id, providerMessageId ? String(providerMessageId).slice(0, 255) : null]
  );
  if (result.rowCount !== 1) throw new Error("Email outbox job was not marked sent because its processing lease was lost.");
}

async function scheduleRetry(id, { attempts, code = "DELIVERY_FAILED", message = "Email delivery failed.", retryAfterMs, maxAttempts = 8 } = {}) {
  const terminal = Number(attempts) >= Number(maxAttempts);
  const exponential = Math.min(60 * 60 * 1000, 5000 * (2 ** Math.max(0, Number(attempts || 1) - 1)));
  const delayMs = Math.max(1000, Math.min(60 * 60 * 1000, Number(retryAfterMs) || exponential + Math.floor(Math.random() * Math.min(exponential / 4, 30000))));
  const result = await db.query(
    `UPDATE email_outbox
     SET status=$2, available_at=CASE WHEN $2='pending' THEN NOW()+($3::bigint * INTERVAL '1 millisecond') ELSE available_at END,
         lease_until=NULL,last_error_code=$4,last_error_message=$5,updated_at=NOW()
     WHERE id=$1 AND status='processing'`,
    [id, terminal ? "failed" : "pending", delayMs, String(code).slice(0, 80), String(message).replace(/[\r\n\t]+/g, " ").slice(0, 500)]
  );
  if (result.rowCount !== 1) throw new Error("Email outbox retry state was not saved because its processing lease was lost.");
  return { terminal, delayMs };
}

module.exports = { enqueueEmail, claimBatch, markDelivered, scheduleRetry };
