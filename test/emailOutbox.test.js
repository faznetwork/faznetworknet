"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const payloadCrypto = require("../services/emailPayloadCrypto");
const outbox = require("../services/emailOutboxService");
const emailService = require("../services/emailService");
const worker = require("../services/emailWorker");

const originalKey = process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY;
const originalQuery = db.query;
const originalTransaction = db.withTransaction;
const originalSendEmail = emailService.sendEmail;
const originalMarkDelivered = outbox.markDelivered;
const originalScheduleRetry = outbox.scheduleRetry;

function setTestKey() {
  process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY = Buffer.alloc(32, 23).toString("base64");
  process.env.EMAIL_WORKER_ENABLED = "true";
}

test.afterEach(() => {
  if (originalKey === undefined) delete process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY;
  else process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY = originalKey;
  db.query = originalQuery;
  db.withTransaction = originalTransaction;
  emailService.sendEmail = originalSendEmail;
  outbox.markDelivered = originalMarkDelivered;
  outbox.scheduleRetry = originalScheduleRetry;
});

test("email payload encryption round-trips and never exposes OTP text", () => {
  setTestKey();
  const envelope = payloadCrypto.encryptPayload({ to: "admin@example.com", text: "OTP 418205", sensitive: true });
  assert.doesNotMatch(envelope, /418205/);
  assert.deepEqual(payloadCrypto.decryptPayload(envelope), { to: "admin@example.com", text: "OTP 418205", sensitive: true });
});

test("email payload encryption rejects tampered ciphertext", () => {
  setTestKey();
  const envelope = JSON.parse(payloadCrypto.encryptPayload({ text: "secret" }));
  envelope.data = Buffer.from("tampered").toString("base64");
  assert.throws(() => payloadCrypto.decryptPayload(envelope), /authenticate|Unsupported|invalid/i);
});

test("email payload encryption fails closed when the key is absent or malformed", () => {
  delete process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY;
  assert.throws(() => payloadCrypto.encryptPayload({ text: "secret" }), /EMAIL_PAYLOAD_ENCRYPTION_KEY is required/);
  process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY = "short";
  assert.throws(() => payloadCrypto.encryptPayload({ text: "secret" }), /32-byte key/);
});

test("enqueueEmail stores encrypted payload and uses a durable idempotency key", async () => {
  setTestKey();
  let queryArgs;
  db.query = async (sql, args) => {
    assert.match(sql, /INSERT INTO email_outbox/);
    queryArgs = args;
    return { rows: [{ id: 51, status: "pending", created_at: new Date() }], rowCount: 1 };
  };
  const result = await outbox.enqueueEmail({
    to: "admin@example.com", subject: "OTP", text: "Code 418205",
    sensitive: true, expiresAt: new Date(Date.now() + 60_000), idempotencyKey: "test-otp:51"
  });
  assert.equal(result.accepted, true);
  assert.equal(result.jobId, 51);
  assert.equal(queryArgs[0], "test-otp:51");
  assert.doesNotMatch(queryArgs[3], /418205/);
  assert.equal(payloadCrypto.decryptPayload(queryArgs[3]).text, "Code 418205");
});

test("duplicate enqueue returns the existing job instead of creating a second row", async () => {
  setTestKey();
  let calls = 0;
  db.query = async sql => {
    calls++;
    if (sql.includes("INSERT INTO email_outbox")) return { rows: [], rowCount: 0 };
    return { rows: [{ id: 51, status: "pending", created_at: new Date() }], rowCount: 1 };
  };
  const result = await outbox.enqueueEmail({
    to: "admin@example.com", subject: "OTP", text: "Code",
    idempotencyKey: "stable-key"
  });
  assert.equal(calls, 2);
  assert.equal(result.duplicate, true);
  assert.equal(result.jobId, 51);
});

test("enqueueEmail uses the supplied transaction client for insert and duplicate lookup", async () => {
  setTestKey();
  const statements = [];
  db.query = async () => { throw new Error("db.query must not be used when a transaction client is supplied"); };
  const client = {
    query: async (sql, args) => {
      statements.push({ sql, args });
      if (sql.includes("INSERT INTO email_outbox")) return { rows: [], rowCount: 0 };
      return { rows: [{ id: 82, status: "pending", created_at: new Date() }], rowCount: 1 };
    }
  };
  const result = await outbox.enqueueEmail({
    to: "admin@example.com", subject: "Invitation", text: "Invite link",
    idempotencyKey: "admin-invitation:82", client
  });
  assert.equal(result.duplicate, true);
  assert.equal(result.jobId, 82);
  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /INSERT INTO email_outbox/);
  assert.match(statements[1].sql, /SELECT id,status,created_at FROM email_outbox/);
  assert.equal(statements[0].args[0], "admin-invitation:82");
});

test("enqueueEmail propagates transaction-client insert errors without falling back to pool queries", async () => {
  setTestKey();
  db.query = async () => { throw new Error("pool fallback must not occur"); };
  const client = { query: async () => { throw new Error("forced outbox insert failure"); } };
  await assert.rejects(
    outbox.enqueueEmail({ to: "admin@example.com", subject: "OTP", text: "123456", idempotencyKey: "otp:1", client }),
    /forced outbox insert failure/
  );
});

test("claimBatch uses a transaction and PostgreSQL SKIP LOCKED", async () => {
  let statement = "";
  db.withTransaction = async callback => callback({
    query: async (sql, args) => {
      statement = sql;
      assert.equal(args[0], 7);
      assert.equal(args[1], 90);
      return { rows: [{ id: 9, attempts: 1 }] };
    }
  });
  const rows = await outbox.claimBatch({ limit: 7, leaseSeconds: 90 });
  assert.equal(rows[0].id, 9);
  assert.match(statement, /FOR UPDATE SKIP LOCKED/);
  assert.match(statement, /status='processing'/);
});

test("worker never sends a queued OTP after its expiry", async () => {
  setTestKey();
  let sent = false, retry;
  emailService.sendEmail = async () => { sent = true; return { success: true }; };
  outbox.scheduleRetry = async (id, args) => { retry = { id, ...args }; return { terminal: true }; };
  const payload_ciphertext = payloadCrypto.encryptPayload({
    to: "admin@example.com", subject: "OTP", text: "expired", event: "admin_login_otp",
    expiresAt: new Date(Date.now() - 1000).toISOString(), sensitive: true
  });
  await worker.processJob({ id: 73, event_key: "admin_login_otp", attempts: 1, payload_ciphertext });
  assert.equal(sent, false);
  assert.equal(retry.id, 73);
  assert.equal(retry.code, "EMAIL_EXPIRED");
});

test("worker marks a successfully accepted SMTP message as delivered", async () => {
  setTestKey();
  let delivered;
  emailService.sendEmail = async payload => {
    assert.equal(payload.to, "admin@example.com");
    assert.equal(payload.sensitive, true);
    return { success: true, provider: "smtp", messageId: "smtp-73" };
  };
  outbox.markDelivered = async (id, result) => { delivered = { id, ...result }; };
  const payload_ciphertext = payloadCrypto.encryptPayload({
    to: "admin@example.com", subject: "Verification", text: "secret", event: "admin_login_otp",
    sensitive: true, expiresAt: null
  });
  await worker.processJob({ id: 73, event_key: "admin_login_otp", attempts: 1, payload_ciphertext });
  assert.deepEqual(delivered, { id: 73, providerMessageId: "smtp-73" });
});
