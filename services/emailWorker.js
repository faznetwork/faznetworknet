"use strict";

const outbox = require("./emailOutboxService");
const crypto = require("./emailPayloadCrypto");
const emailService = require("./emailService");

const POLL_INTERVAL_MS = Math.max(1000, Math.min(30000, Number(process.env.EMAIL_WORKER_POLL_MS) || 5000));
const BATCH_SIZE = Math.max(1, Math.min(50, Number(process.env.EMAIL_WORKER_BATCH_SIZE) || 10));
const LEASE_SECONDS = Math.max(30, Math.min(600, Number(process.env.EMAIL_WORKER_LEASE_SECONDS) || 90));
const MAX_ATTEMPTS = Math.max(1, Math.min(20, Number(process.env.EMAIL_WORKER_MAX_ATTEMPTS) || 8));

let stopped = true;
let loopPromise = null;
let wakeTimer = null;
let wakeResolve = null;

function classifyFailure(result) {
  const code = String(result?.code || "").toUpperCase();
  const message = String(result?.error || "Email delivery failed.");
  const permanentCodes = new Set(["EMAIL_PAYLOAD_INVALID", "EAUTH", "EENVELOPE"]);
  const permanentMessage = /valid recipient|subject is required|body is required|SMTP Host is required|SMTP Username|SMTP Password|valid From Email|EMAIL_PAYLOAD_ENCRYPTION_KEY/i.test(message);
  return { permanent: permanentCodes.has(code) || permanentMessage, code: code || "EMAIL_DELIVERY_FAILED", message };
}

async function processJob(job) {
  let payload;
  try {
    payload = crypto.decryptPayload(job.payload_ciphertext);
  } catch (error) {
    console.error("[EmailWorker] Queued payload could not be decrypted; marking job failed.", { jobId: job.id, error: String(error.message || error) });
    await outbox.scheduleRetry(job.id, { attempts: MAX_ATTEMPTS, maxAttempts: MAX_ATTEMPTS, code: "EMAIL_PAYLOAD_INVALID", message: "Queued email payload could not be decrypted." });
    return;
  }

  if (payload.expiresAt && Number.isFinite(new Date(payload.expiresAt).getTime()) && new Date(payload.expiresAt).getTime() <= Date.now()) {
    await outbox.scheduleRetry(job.id, { attempts: MAX_ATTEMPTS, maxAttempts: MAX_ATTEMPTS, code: "EMAIL_EXPIRED", message: "Email expired before delivery and was not sent." });
    console.warn("[EmailWorker] Expired email job was not sent.", { jobId: job.id, event: job.event_key });
    return;
  }

  try {
    const result = await emailService.sendEmail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      event: payload.event || job.event_key,
      sensitive: payload.sensitive === true
    });
    if (!result || result.success !== true) {
      const failure = classifyFailure(result);
      const attempts = failure.permanent ? MAX_ATTEMPTS : Number(job.attempts || 1);
      const retry = await outbox.scheduleRetry(job.id, {
        attempts,
        maxAttempts: MAX_ATTEMPTS,
        code: failure.code,
        message: failure.message
      });
      console.error("[EmailWorker] Email delivery failed.", { jobId: job.id, event: job.event_key, attempt: job.attempts, terminal: retry.terminal, code: failure.code });
      return;
    }
    await outbox.markDelivered(job.id, { providerMessageId: result.messageId || null });
    console.info("[EmailWorker] Email accepted by provider.", { jobId: job.id, event: job.event_key, provider: result.provider || "smtp", messageId: result.messageId || null });
  } catch (error) {
    const failure = classifyFailure({ code: error.code, error: error.message });
    const retry = await outbox.scheduleRetry(job.id, {
      attempts: failure.permanent ? MAX_ATTEMPTS : Number(job.attempts || 1),
      maxAttempts: MAX_ATTEMPTS,
      code: failure.code,
      message: failure.message
    });
    console.error("[EmailWorker] Job processing failed.", { jobId: job.id, event: job.event_key, terminal: retry.terminal, code: failure.code, error: failure.message });
  }
}

async function runLoop() {
  while (!stopped) {
    let jobs = [];
    try {
      jobs = await outbox.claimBatch({ limit: BATCH_SIZE, leaseSeconds: LEASE_SECONDS });
    } catch (error) {
      console.error("[EmailWorker] Could not claim outbox jobs.", { error: String(error.message || error) });
    }
    if (jobs.length) {
      // A batch is processed sequentially to bound SMTP concurrency and protect shared DB/SMTP resources.
      for (const job of jobs) {
        if (stopped) break;
        try {
          await processJob(job);
        } catch (error) {
          // Failure to persist a job state is operationally significant; log it and allow the lease to recover.
          console.error("[EmailWorker] Job state update failed; lease recovery will be required.", { jobId: job.id, error: String(error.message || error) });
        }
      }
      continue;
    }
    await new Promise(resolve => {
      wakeResolve = resolve;
      wakeTimer = setTimeout(() => { wakeTimer = null; wakeResolve = null; resolve(); }, POLL_INTERVAL_MS);
      if (typeof wakeTimer.unref === "function") wakeTimer.unref();
    });
    wakeTimer = null;
  }
}

function startEmailWorker() {
  if (String(process.env.EMAIL_WORKER_ENABLED || "").toLowerCase() !== "true") {
    console.info("[EmailWorker] Disabled; set EMAIL_WORKER_ENABLED=true after the outbox migration and encryption key are configured.");
    return { enabled: false, stop: async () => {} };
  }
  try { require("./emailPayloadCrypto").validateKey(); }
  catch (error) {
    console.error("[EmailWorker] Refusing to start because encrypted payloads cannot be read:", String(error.message || error));
    return { enabled: false, reason: "encryption_key_invalid", stop: async () => {} };
  }
  if (loopPromise) return { enabled: true, stop: stopEmailWorker };
  stopped = false;
  loopPromise = runLoop().catch(error => {
    console.error("[EmailWorker] Worker loop terminated unexpectedly.", { error: String(error.message || error) });
    loopPromise = null;
    stopped = true;
  });
  console.info("[EmailWorker] Started.", { pollMs: POLL_INTERVAL_MS, batchSize: BATCH_SIZE, leaseSeconds: LEASE_SECONDS });
  return { enabled: true, stop: stopEmailWorker };
}

async function stopEmailWorker() {
  stopped = true;
  if (wakeTimer) clearTimeout(wakeTimer);
  wakeTimer = null;
  if (wakeResolve) wakeResolve();
  wakeResolve = null;
  if (loopPromise) {
    await loopPromise;
    loopPromise = null;
  }
  console.info("[EmailWorker] Stopped.");
}

module.exports = { startEmailWorker, stopEmailWorker, processJob, classifyFailure };
