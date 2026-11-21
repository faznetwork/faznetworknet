"use strict";

// Claim-code (OTP) service for unbound pending_claim Hotspot packages (C1).
// A 6-digit code is sent to the registered phone; only its sha256 hash is
// stored. One code = one claim. SMS first, WhatsApp as fallback.
// The code is NEVER returned by this module.

const crypto = require("crypto");
const db = require("../db");

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function normalizePhone(value) {
  const bangla = "০১২৩৪৫৬৭৮৯";
  let digits = String(value ?? "").replace(/[০-৯]/g, (ch) => String(bangla.indexOf(ch))).replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) digits = "0" + digits.slice(3);
  return digits;
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function createHotspotClaimOtpService(deps = {}) {
  const database = deps.db || db;
  // Senders are injectable for tests; defaults send for real. OTPs are
  // transactional, not notification preferences, so they bypass the
  // notificationDispatcher rule gating and call the senders directly.
  const smsService = deps.smsService || require("./smsService");
  const whatsappService = deps.whatsappService || require("./whatsappService");

  async function requestClaimOtp({ phone, voucherId, client }) {
    const cleanPhone = normalizePhone(phone);
    if (!/^01\d{9}$/.test(cleanPhone)) return { sent: false, reason: "invalid_phone" };
    if (!Number.isSafeInteger(Number(voucherId)) || Number(voucherId) <= 0) return { sent: false, reason: "invalid_voucher" };
    const query = client ? client.query.bind(client) : database.query.bind(database);
    const code = String(crypto.randomInt(100000, 1000000));
    // Invalidate any previous unused codes for this voucher first.
    await query("UPDATE hotspot_claim_otps SET used_at=NOW() WHERE voucher_id=$1::bigint AND used_at IS NULL", [Number(voucherId)]);
    await query(
      "INSERT INTO hotspot_claim_otps(phone,voucher_id,code_hash,expires_at,attempts) VALUES($1::text,$2::bigint,$3::text,NOW()+INTERVAL '10 minutes',0)",
      [cleanPhone, Number(voucherId), sha256(code)]
    );
    const message = "FAZ NETWORK hotspot claim code: " + code + ". 10 minute-e meyad, kauke diben na.";
    // SMS first; WhatsApp only if SMS was skipped or failed.
    try {
      const smsResult = await smsService.sendSms({ to: cleanPhone, phone: cleanPhone, message, event: "hotspot_claim_otp", userType: "hotspot" });
      if (smsResult && smsResult.skipped !== true) return { sent: true, channels: ["sms"] };
    } catch (smsError) {
      console.warn("[Hotspot claim OTP] SMS send failed, trying WhatsApp:", smsError?.message || smsError);
    }
    try {
      await whatsappService.sendMessage({ to: cleanPhone, message, event: "hotspot_claim_otp", userType: "hotspot" });
      return { sent: true, channels: ["whatsapp"] };
    } catch (waError) {
      console.error("[Hotspot claim OTP] WhatsApp send failed:", waError?.message || waError);
      return { sent: false, reason: "send_failed" };
    }
  }

  async function verifyClaimOtp({ phone, voucherId, code, client }) {
    const cleanPhone = normalizePhone(phone);
    const cleanCode = String(code ?? "").trim();
    if (!/^\d{6}$/.test(cleanCode)) return { ok: false, code: "OTP_INVALID" };
    if (!Number.isSafeInteger(Number(voucherId)) || Number(voucherId) <= 0) return { ok: false, code: "OTP_NOT_FOUND_OR_EXPIRED" };
    const query = client ? client.query.bind(client) : database.query.bind(database);
    const found = await query(
      "SELECT id,code_hash,attempts,phone FROM hotspot_claim_otps WHERE voucher_id=$1::bigint AND used_at IS NULL AND expires_at>NOW() ORDER BY created_at DESC LIMIT 1 FOR UPDATE",
      [Number(voucherId)]
    );
    const row = found.rows?.[0];
    if (!row) return { ok: false, code: "OTP_NOT_FOUND_OR_EXPIRED" };
    if (cleanPhone && normalizePhone(row.phone) !== cleanPhone) return { ok: false, code: "OTP_NOT_FOUND_OR_EXPIRED" };
    if (Number(row.attempts) >= MAX_ATTEMPTS) return { ok: false, code: "OTP_LOCKED" };
    const expected = Buffer.from(String(row.code_hash), "utf8");
    const actual = Buffer.from(sha256(cleanCode), "utf8");
    const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    if (!match) {
      await query("UPDATE hotspot_claim_otps SET attempts=attempts+1 WHERE id=$1::uuid", [row.id]);
      return { ok: false, code: "OTP_INVALID" };
    }
    await query("UPDATE hotspot_claim_otps SET used_at=NOW() WHERE id=$1::uuid", [row.id]);
    return { ok: true };
  }

  return { requestClaimOtp, verifyClaimOtp, CODE_TTL_MS, MAX_ATTEMPTS };
}

const defaultService = createHotspotClaimOtpService();

module.exports = { ...defaultService, createHotspotClaimOtpService, normalizePhone, sha256 };
