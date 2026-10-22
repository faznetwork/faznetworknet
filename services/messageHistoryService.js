"use strict";
const db = require("../db");

async function recordMessage({ channel, to, message, event = "manual", status, error = null, gateway = null, method = null, httpStatus = null, providerMessageId = null } = {}) {
  try {
    const normalizedChannel = ["sms", "whatsapp", "email"].includes(String(channel)) ? String(channel) : "sms";
    const recipient = String(to || "").trim().slice(0, 254);
    const body = String(message || "").slice(0, 4000);
    if (!recipient || !body || !["sent", "failed", "skipped"].includes(status)) return;
    const phone = normalizedChannel === "email" ? "" : recipient.slice(0, 40);
    await db.getPool().query(
      `INSERT INTO sms_delivery_logs
       (recipient_phone, recipient_address, channel, message, event_key, status, gateway_mode, http_method, http_status, error, provider_message_id, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [phone, recipient, normalizedChannel, body, String(event || "manual").slice(0,80), status,
       gateway ? String(gateway).slice(0,40) : null, method ? String(method).slice(0,20) : null,
       Number.isInteger(httpStatus) ? httpStatus : null, error ? String(error).replace(/[\\r\\n\\t]+/g," ").slice(0,1000) : null,
       providerMessageId ? String(providerMessageId).slice(0,255) : null]
    );
  } catch (loggingError) {
    // Message audit must never block billing, payment or notification flows.
    console.warn("[MessageHistory] Could not record outbound attempt:", loggingError.message);
  }
}

module.exports = { recordMessage };
