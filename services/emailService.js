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
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 7000
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

async function sendSmtpEmail({ recipient, title, html, text }, settings, signal) {
  const config = normalizeSmtpConfig(settings);
  const from = '"' + config.from.name.replace(/["\\]/g, "") + '" <' + config.from.address + '>';
  const transporter = nodemailer.createTransport({ ...config, from });
  let abortHandler;
  let attemptTimeout;
  try {
    const sendPromise = transporter.sendMail({
      from, to: recipient, subject: title,
      ...(html ? { html: String(html) } : {}),
      ...(text ? { text: String(text) } : {})
    });
    const timeoutPromise = new Promise((_, reject) => {
      attemptTimeout = setTimeout(() => {
        try { transporter.close(); }
        catch (error) { console.error("[EmailService] Failed to close timed-out SMTP transport:", safeError(error)); }
        const error = new Error("SMTP transport exceeded the 6.5-second attempt deadline.");
        error.code = "ETIMEDOUT";
        reject(error);
      }, 6500);
    });
    let abortPromise = new Promise(() => {});
    if (signal) {
      if (signal.aborted) {
        const error = new Error("SMTP send was aborted because the request deadline expired.");
        error.code = "ETIMEDOUT";
        throw error;
      }
      abortPromise = new Promise((_, reject) => {
        abortHandler = () => {
          try { transporter.close(); }
          catch (error) { console.error("[EmailService] Failed to close aborted SMTP transport:", safeError(error)); }
          const timeoutError = new Error("SMTP send was aborted because the request deadline expired.");
          timeoutError.code = "ETIMEDOUT";
          reject(timeoutError);
        };
        signal.addEventListener("abort", abortHandler, { once: true });
      });
    }
    const info = await Promise.race([sendPromise, timeoutPromise, abortPromise]);
    const accepted = Array.isArray(info.accepted) ? info.accepted : [];
    const rejected = Array.isArray(info.rejected) ? info.rejected : [];
    if (rejected.some(address => String(address).toLowerCase() === recipient.toLowerCase()) &&
        !accepted.some(address => String(address).toLowerCase() === recipient.toLowerCase())) {
      const error = new Error("SMTP server rejected the recipient address.");
      error.code = "EENVELOPE";
      throw error;
    }
    return { success: true, provider: SMTP_MODE, messageId: info.messageId || null, accepted, rejected };
  } finally {
    if (attemptTimeout) clearTimeout(attemptTimeout);
    if (signal && abortHandler) signal.removeEventListener("abort", abortHandler);
    try { transporter.close(); }
    catch (error) { console.error("[EmailService] Failed to close SMTP transport cleanly:", safeError(error)); }
  }
}

const SMTP_NETWORK_ERROR_CODES = new Set(["ETIMEDOUT", "ECONNECTION", "ECONNREFUSED", "ENETUNREACH", "EHOSTUNREACH", "ESOCKET", "ECONNRESET", "EAI_AGAIN"]);

async function sendResendEmail({ recipient, title, html, text }, settings, externalSignal) {
  const apiKey = String(process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) throw new Error("Resend fallback is not configured: RESEND_API_KEY is missing.");
  const fromAddress = String(settings.email_from_address || settings.smtp_username || "").trim();
  const fromName = String(settings.email_from_name || "FAZ NETWORK Billing").trim();
  if (!fromAddress || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromAddress)) {
    throw new Error("A valid verified sender email is required for Resend fallback.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const abortFromCaller = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener("abort", abortFromCaller, { once: true });
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromName + " <" + fromAddress + ">",
        to: [recipient], subject: title,
        ...(html ? { html: String(html) } : {}),
        ...(text ? { text: String(text) } : {})
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(String(payload.message || payload.error || "Resend HTTP API rejected the email (HTTP " + response.status + ")."));
      error.code = "ERESEND_HTTP_" + response.status;
      throw error;
    }
    return { success: true, provider: "resend", messageId: payload.id || null, accepted: [recipient], rejected: [] };
  } catch (error) {
    if (error && error.name === "AbortError") {
      const timeoutError = new Error("Resend HTTP API timed out after 5 seconds.");
      timeoutError.code = "ETIMEDOUT";
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    if (externalSignal) externalSignal.removeEventListener("abort", abortFromCaller);
  }
}

async function sendEmail({ to, subject, html, text, event = "manual", sensitive = false, signal } = {}) {
  const recipient = String(to || "").trim();
  const body = String(text || html || "").slice(0, 4000);
  let result;
  let provider = SMTP_MODE;
  try {
    const { recipient: validatedRecipient, title } = validateEmailRequest({ to, subject, html, text });
    const settings = await settingsService.getAllSettings();
    try {
      result = await sendSmtpEmail({ recipient: validatedRecipient, title, html, text }, settings, signal);
      return result;
    } catch (smtpError) {
      const smtpCode = String(smtpError && smtpError.code || "");
      const canFallback = SMTP_NETWORK_ERROR_CODES.has(smtpCode) &&
        Boolean(String(process.env.RESEND_API_KEY || "").trim()) &&
        !(signal && signal.aborted);
      if (!canFallback) throw smtpError;
      console.warn("[EmailService] SMTP transport failed; attempting configured Resend HTTP fallback.", {
        code: smtpCode || "SMTP_NETWORK_ERROR"
      });
      provider = "resend";
      result = await sendResendEmail({ recipient: validatedRecipient, title, html, text }, settings, signal);
      return result;
    }
  } catch (error) {
    result = {
      success: false,
      error: safeError(error),
      code: error && error.code ? String(error.code).slice(0, 80) : (error?.message?.startsWith("SMTP ") ? "SMTP_CONFIG_INVALID" : undefined),
      provider
    };
    return result;
  } finally {
    try {
      await require("./messageHistoryService").recordMessage({
        channel: "email",
        to: recipient,
        // OTPs and invitation links are never written to the message-history body.
        message: sensitive ? "[sensitive email payload omitted]" : "Subject: " + String(subject || "").slice(0, 200) + "\n" + body,
        event,
        status: result?.success ? "sent" : "failed",
        error: result?.success ? null : result?.error,
        gateway: provider,
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

module.exports = { sendEmail, verifyConnection, normalizeSmtpConfig, providerMode, sendResendEmail };
