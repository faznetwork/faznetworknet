"use strict";

const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;

function getKey() {
  const raw = String(process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY || "").trim();
  if (!raw) {
    throw new Error("EMAIL_PAYLOAD_ENCRYPTION_KEY is required before email payloads can be queued.");
  }
  let key;
  if (/^[a-f0-9]{64}$/i.test(raw)) key = Buffer.from(raw, "hex");
  else {
    try { key = Buffer.from(raw, "base64"); } catch (_) { key = Buffer.alloc(0); }
  }
  if (!key || key.length !== 32) {
    throw new Error("EMAIL_PAYLOAD_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or base64.");
  }
  return key;
}

function encryptPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new TypeError("Email payload must be a plain object.");
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    v: VERSION,
    alg: ALGORITHM,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: ciphertext.toString("base64")
  });
}

function decryptPayload(envelope) {
  let parsed;
  try { parsed = typeof envelope === "string" ? JSON.parse(envelope) : envelope; }
  catch (_) { throw new Error("Queued email payload envelope is invalid JSON."); }
  if (!parsed || parsed.v !== VERSION || parsed.alg !== ALGORITHM ||
      typeof parsed.iv !== "string" || typeof parsed.tag !== "string" || typeof parsed.data !== "string") {
    throw new Error("Queued email payload envelope has an unsupported format.");
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(parsed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(parsed.data, "base64")),
    decipher.final()
  ]);
  const payload = JSON.parse(plaintext.toString("utf8"));
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Decrypted email payload must be an object.");
  }
  return payload;
}

function validateKey() { getKey(); return true; }

module.exports = { encryptPayload, decryptPayload, validateKey };
