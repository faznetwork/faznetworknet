"use strict";

const nodemailer = require("nodemailer");
const settingsService = require("./appSettings");

const SMTP_MODE = "smtp";

function providerMode() {
  // SMTP is the canonical provider. Legacy Apps Script settings are deliberately not read.
  return SMTP_MODE;
}

function normalizeSmtpConfig(config = {}) {
  const secure = config.smtp_secure === true || String(config.smtp_secure || "").toLowerCase() === "true" || String(config.smtp_secure || "") === "1";
  const portValue = Number(config.smtp_port);
  const port = Number.isInteger(portValue) && portValue >= 1 && portValue <= 65535 ? portValue : (secure ? 465 : 587);
  const host = String(config.smtp_host || "").trim();
  const user = String(config.smtp_username || "").trim();
  const pass = String(config.smtp_password || "");
  const fromEmail = String(config.email_from_address || user).trim();
  const fromName = String(config.email_from_name || "FAZ NETWORK Billing").trim();
  if (!host) throw new Error("SMTP Host is required in Notification Hub settings.");
  if (!user) throw new Error("SMTP Username / Email Address is required in Notification Hub settings.");
  if (!pass) throw new Error("SMTP Password / App Password is not configured in Notification Hub settings.");
  if (!fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) throw new Error("A valid From Email address is required in Notification Hub settings.");
  return {
    host, port, secure,
    auth: { user, pass },
    from: { name: fromName || "FAZ NETWORK Billing", address: fromEmail },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000
  };
}

function safeError(error) {
  return String(error && error.message || error || "Email operation failed.").replace(/[\r\n\t]+/g, " ").slice(0, 700);
}

function createTransport(config) {
  return nodemailer.createTransport(normalizeSmtpConfig(config));
}

function validateEmailRequest({ to, subject, html, text } = {}) {
  const recipient = String(to || "").trim();
  const title = String(subject || "").trim();
  if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("A valid recipient email address is required.");
  if (!title || title.length > 200) throw new Error("Email subject is required and must not exceed 200 characters.");
  if (!String(html || text || "").trim()) throw new Error("Email HTML or text body is required.");
  return { recipient, title };
}

async function sendSmtpEmail({ recipient, title, html, text }, settings) {
  const config = normalizeSmtpConfig(settings);
  const from = '"' + config.from.name.replace(/["\\]/g, "") + '" <' + config.from.address + '>';
  const transporter = nodemailer.createTransport({ ...config, from });
  try {
    const info = await transporter.sendMail({
      from, to: recipient, subject: title,
      ...(html ? { html: String(html) } : {}),
      ...(text ? { text: String(text) } : {})
    });
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (rejected.some(address => String(address).toLowerCase() === recipient.toLowerCase()) &&
        !accepted.some(address => String(address).toLowerCase() === recipient.toLowerCase())) {
      return { success: false, provider: SMTP_MODE, messageId: info.messageId || null, accepted, rejected, error: "SMTP server rejected the recipient address.", code: "EENVELOPE" };
    }
    return { success: true, provider: SMTP_MODE, messageId: info.messageId || null, accepted, rejected };
  } finally {
    try { transporter.close(); }
    catch (error) { console.error("[EmailService] Failed to close SMTP transport cleanly:", safeError(error)); }
  }
}

async function sendEmail({ to, subject, html, text, event = "manual", sensitive = false } = {}) {
  const recipient = String(to || "").trim();
  let result;
  try {
    const { recipient: validatedRecipient, title } = validateEmailRequest({ to, subject, html, text });
    const settings = await settingsService.getAllSettings();
    result = await sendSmtpEmail({ recipient: validatedRecipient, title, html, text }, settings);
    return result;
  } catch (error) {
    result = {
      success: false,
      error: safeError(error),
      code: error && error.code ? String(error.code).slice(0, 80) : (error?.message?.startsWith("SMTP ") ? "SMTP_CONFIG_INVALID" : undefined),
      provider: SMTP_MODE
    };
    return result;
  } finally {
    try {
      await require("./messageHistoryService").recordMessage({
        channel: "email",
        to: recipient,
        // OTPs and invitation links are never written to the message-history body.
        message: sensitive ? "[sensitive email payload omitted]" : "Subject: " + String(subject || "").slice(0, 200),
        event,
        status: result?.success ? "sent" : "failed",
        error: result?.success ? null : result?.error,
        gateway: SMTP_MODE,
        providerMessageId: result?.messageId || null
      });
    } catch (error) {
      // History is observability only; never turn a delivery result into a false failure.
      console.error("[EmailService] Message history write failed:", safeError(error));
    }
  }
}

async function verifyConnection(emailConfig) {
  let transporter;
  try {
    const settings = emailConfig && typeof emailConfig === "object" ? emailConfig : await settingsService.getAllSettings();
    transporter = createTransport(settings);
    await transporter.verify();
    return { success: true, provider: SMTP_MODE, message: "SMTP connection verified successfully." };
  } catch (error) {
    return { success: false, error: safeError(error), code: error && error.code ? String(error.code).slice(0, 80) : undefined, provider: SMTP_MODE };
  } finally {
    if (transporter && typeof transporter.close === "function") {
      try { transporter.close(); }
      catch (error) { console.error("[EmailService] Failed to close verification transport:", safeError(error)); }
    }
  }
}

module.exports = { sendEmail, verifyConnection, normalizeSmtpConfig, providerMode };
