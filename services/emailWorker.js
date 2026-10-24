"use strict";

const outbox = require("./emailOutboxService");
const crypto = require("./emailPayloadCrypto");
const emailService = require("./emailService");
const emailNotificationState = require("./emailNotificationState");

const POLL_INTERVAL_MS = Math.max(1000, Math.min(30000, Number(process.env.EMAIL_WORKER_POLL_MS) || 5000));
const LEASE_SECONDS = Math.max(30, Math.min(600, Number(process.env.EMAIL_WORKER_LEASE_SECONDS) || 90));
const WORKER_CONCURRENCY = Math.max(1, Math.min(10, Number(process.env.EMAIL_WORKER_CONCURRENCY) || 3));
const REQUESTED_BATCH_SIZE = Math.max(1, Math.min(50, Number(process.env.EMAIL_WORKER_BATCH_SIZE) || 10));
const SAFE_BATCH_SIZE = Math.max(1, Math.floor((LEASE_SECONDS * 1000 - 15000) / 15000) * WORKER_CONCURRENCY);
const BATCH_SIZE = Math.min(REQUESTED_BATCH_SIZE, SAFE_BATCH_SIZE);
const MAX_ATTEMPTS = Math.max(1, Math.min(20, Number(process.env.EMAIL_WORKER_MAX_ATTEMPTS) || 8));

let stopped = true;
let loopPromise = null;
let wakeTimer = null;
let wakeResolve = null;

function classifyFailure(result) {
  const code = String(result?.code || "").toUpperCase();
  const message = String(result?.error || "Email delivery failed.");
  const permanentCodes = new Set([
    "EMAIL_PAYLOAD_INVALID", "EAUTH", "EENVELOPE",
    "ERESEND_NOT_CONFIGURED", "ERESEND_SENDER_NOT_VERIFIED"
  ]);
  const resendHttpStatus = /^ERESEND_HTTP_(\d{3})$/.exec(code);
  const permanentResendResponse = Boolean(resendHttpStatus &&
    Number(resendHttpStatus[1]) >= 400 &&
    Number(resendHttpStatus[1]) < 500 &&
    Number(resendHttpStatus[1]) !== 429);
  const permanentMessage = /valid recipient|subject is required|body is required|SMTP Host is required|SMTP Username|SMTP Password|valid From Email|EMAIL_PAYLOAD_ENCRYPTION_KEY|Resend HTTP API is not configured|Resend sender is not configured/i.test(message);
  return {
    permanent: permanentCodes.has(code) || permanentResendResponse || permanentMessage,
    code: code || "EMAIL_DELIVERY_FAILED",
    message
  };
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

async function waitForNextPoll() {
  await new Promise(resolve => {
    wakeResolve = resolve;
    wakeTimer = setTimeout(() => {
      wakeTimer = null;
      wakeResolve = null;
      resolve();
    }, POLL_INTERVAL_MS);
    if (typeof wakeTimer.unref === "function") wakeTimer.unref();
  });
  wakeTimer = null;
}

async function runLoop() {
  let lastEnabledState = null;
  let lastOperationalError = null;
  while (!stopped) {
    let enabled;
    try {
      enabled = await emailNotificationState.isEnabled();
      lastOperationalError = null;
    } catch (error) {
      const message = String(error.message || error);
      if (message !== lastOperationalError) {
        console.error("[EmailWorker] Could not read the persisted email notification setting; delivery is paused.", { error: message });
        lastOperationalError = message;
      }
      await waitForNextPoll();
      continue;
    }

    if (enabled !== lastEnabledState) {
      console.info(enabled ? "[EmailWorker] Enabled by the persisted Notification Hub setting." : "[EmailWorker] Disabled by the persisted Notification Hub setting.");
      lastEnabledState = enabled;
    }
    if (!enabled) {
      await waitForNextPoll();
      continue;
    }

    try {
      crypto.validateKey();
    } catch (error) {
      const message = String(error.message || error);
      if (message !== lastOperationalError) {
        console.error("[EmailWorker] Delivery is paused because the payload encryption key is unavailable or invalid.", { error: message });
        lastOperationalError = message;
      }
      await waitForNextPoll();
      continue;
    }

    let jobs = [];
    try {
      jobs = await outbox.claimBatch({ limit: BATCH_SIZE, leaseSeconds: LEASE_SECONDS });
      lastOperationalError = null;
    } catch (error) {
      const message = String(error.message || error);
      if (message !== lastOperationalError) {
        console.error("[EmailWorker] Could not claim outbox jobs.", { error: message });
        lastOperationalError = message;
      }
    }
    if (jobs.length) {
      let nextIndex = 0;
      const workerCount = Math.min(WORKER_CONCURRENCY, jobs.length);
      await Promise.all(Array.from({ length: workerCount }, async () => {
        while (!stopped) {
          const index = nextIndex++;
          if (index >= jobs.length) return;
          const job = jobs[index];
          try {
            await processJob(job);
          } catch (error) {
            console.error("[EmailWorker] Job state update failed; lease recovery will be required.", { jobId: job.id, error: String(error.message || error) });
          }
        }
      }));
      continue;
    }
    await waitForNextPoll();
  }
}

function startEmailWorker() {
  if (loopPromise) return { enabled: true, stop: stopEmailWorker };
  stopped = false;
  loopPromise = runLoop().catch(error => {
    console.error("[EmailWorker] Worker loop terminated unexpectedly.", { error: String(error.message || error) });
    loopPromise = null;
    stopped = true;
  });
  console.info("[EmailWorker] Control loop started; delivery follows the persisted Notification Hub setting.");
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
