const OFFICIAL_SENDERS = Object.freeze({
  bkash: ["bkash", "16247"],
  nagad: ["nagad", "16167"],
  rocket: ["rocket", "16216", "dbbl"],
  upay: ["upay", "16268"]
});
function firstDefined(values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return "";
}
function getNestedValue(body, keys) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return "";
  for (const key of keys) if (Object.prototype.hasOwnProperty.call(body, key)) return body[key];
  return "";
}
function extractWebhookPayload(body, query = {}, headers = {}) {
  const objectBody = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const text = firstDefined([
    getNestedValue(objectBody, ["message","sms","text","body","sms_body","sms_message","sms body","smsText","smsTextMessage","notification"]),
    query?.message, query?.text, query?.sms, query?.body,
    headers["x-sms-message"], headers["x-sms-body"], headers["x-sms-text"], headers["x-message"], headers["x-sms"], headers["x-notification-message"],
    typeof body === "string" ? body : ""
  ]);
  const sender = firstDefined([
    getNestedValue(objectBody, ["sender","from","sms_number","sender_id","originator","service_code"]),
    headers["x-sms-sender"], headers["x-sender"], headers["x-sms-from"], query?.sender, query?.from
  ]);
  const recipient = firstDefined([
    getNestedValue(objectBody, ["recipient","recipient_phone","receiving_number","receiver","destination","to","merchant_number","account_number"]),
    headers["x-sms-recipient"], headers["x-recipient-phone"], headers["x-receiving-number"], query?.recipient, query?.recipient_phone, query?.to
  ]);
  const token = firstDefined([headers["x-webhook-token"], headers["x-macrodroid-token"], getNestedValue(objectBody, ["token","secret"]), query?.token]);
  return { text: String(typeof text === "object" ? JSON.stringify(text) : text || ""), sender: String(sender || "").trim(), recipient: String(recipient || "").trim(), token: String(token || "").trim() };
}
function normalizePhone(value) {
  const bangla = "০১২৩৪৫৬৭৮৯";
  let p = String(value || "").replace(/[০-৯]/g, ch => String(bangla.indexOf(ch))).replace(/[^0-9]/g, "");
  if (p.startsWith("880") && p.length === 13) p = "0" + p.slice(3);
  return p;
}
function normalizeTrxId(value) { return String(value || "").replace(/[\u200b\u200c\u200d]/g, "").trim().toUpperCase(); }
function normalizeAmount(value) {
  const cleaned = String(value || "").replace(/[, ]/g, "").trim();
  const amount = Number(cleaned);
  return Number.isFinite(amount) ? amount : NaN;
}
function normalizeSender(value) { return String(value || "").normalize("NFKC").trim().replace(/[^a-z0-9]/gi, "").toLowerCase(); }
function channelFrom(text, sender = "") {
  const raw = String(sender || "").trim();
  const normalizedPhone = normalizePhone(raw);
  if (/^(?:\+?8801|01)\d{9}$/.test(raw.replace(/[\s-]/g, "")) || /^01\d{9}$/.test(normalizedPhone)) {
    const error = new Error("Forwarding sender must be an official MFS service sender, not a personal phone number.");
    error.code = "UNTRUSTED_FORWARDER_SENDER"; error.statusCode = 403; throw error;
  }
  const candidate = normalizeSender(raw);
  for (const [channel, senders] of Object.entries(OFFICIAL_SENDERS)) {
    if (senders.some(senderId => normalizeSender(senderId) === candidate)) return channel;
  }
  const error = new Error("Forwarding sender is not on the official MFS sender allowlist.");
  error.code = "UNTRUSTED_FORWARDER_SENDER"; error.statusCode = 403; throw error;
}
function extractTransactionId(text) {
  const t = String(text || "").replace(/[\u200b\u200c\u200d]/g, "");
  const patterns = [
    /\b(?:trx\s*id|transaction\s*id|txn\s*id)\s*[:#=\-]?\s*([A-Z0-9][A-Z0-9._-]{5,39})\b/i,
    /\b(?:trx|txn)\s*[:#=\-]\s*([A-Z0-9][A-Z0-9._-]{5,39})\b/i
  ];
  for (const re of patterns) { const m = t.match(re); if (m) return normalizeTrxId(m[1]).replace(/[^A-Z0-9_-]/g, ""); }
  return "";
}
function extractAmount(text) {
  const t = String(text || "").replace(/\u00a0/g, " ");
  const patterns = [
    /(?:amount|received|payment|paid|cash\s*in|cashin)\s*[:=\-]?\s*(?:tk|taka|৳)\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]{1,2})?)/i,
    /(?:tk|taka|৳)\s*[:=\-]?\s*((?:[0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)(?:\.[0-9]{1,2})?)/i
  ];
  for (const re of patterns) { const m = t.match(re); if (m) { const n = normalizeAmount(m[1]); if (Number.isFinite(n) && n > 0) return n; } }
  return NaN;
}
function extractRecipientPhone(text) {
  const m = String(text || "").match(/\bto\s*((?:\+?880[\s-]*|0)1(?:[\s-]*\d){9})/i);
  const value = m ? normalizePhone(m[1]) : "";
  return /^01\d{9}$/.test(value) ? value : "";
}
function extractSenderPhone(text) {
  const matches = String(text || "").match(/(?:\+?880[\s-]*|0)1(?:[\s-]*\d){9}/g) || [];
  const normalized = matches.map(normalizePhone).filter(v => /^01\d{9}$/.test(v));
  return normalized[0] || "";
}
function extractReference(text) {
  const m = String(text || "").match(/\b(?:ref|reference)\s*[:#=-]?\s*([A-Za-z0-9_-]{1,50})/i);
  return m ? m[1].trim() : "";
}
function parseSms(body, query = {}, headers = {}, options = {}) {
  const payload = extractWebhookPayload(body, query, headers);
  const channel = channelFrom(payload.text, payload.sender);
  const trxId = extractTransactionId(payload.text);
  const amount = extractAmount(payload.text);
  if (!trxId || !Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Could not parse transaction ID or amount from SMS.");
    error.code = "INVALID_SMS_PAYLOAD"; error.statusCode = 400; throw error;
  }
  const recipient = normalizePhone(payload.recipient || extractRecipientPhone(payload.text));
  if (recipient) {
    const configured = normalizePhone(options.recipientNumbers?.[channel] || "");
    if (!configured) {
      const error = new Error("Receiving number is not configured for " + channel + ".");
      error.code = "RECIPIENT_NOT_CONFIGURED"; error.statusCode = 403; throw error;
    }
    if (recipient !== configured) {
      const error = new Error("SMS recipient does not match the configured " + channel + " receiving number.");
      error.code = "INVALID_RECIPIENT"; error.statusCode = 403; throw error;
    }
  }
  return { channel, trxId: normalizeTrxId(trxId), amount, senderPhone: extractSenderPhone(payload.text), recipientPhone: recipient, customerRef: extractReference(payload.text), rawSms: payload.text, sourceSender: payload.sender };
}
module.exports = { extractWebhookPayload, extractTransactionId, extractAmount, parseSms, normalizePhone, normalizeTrxId, channelFrom, extractRecipientPhone, OFFICIAL_SENDERS };
