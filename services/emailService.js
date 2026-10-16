"use strict";

const nodemailer = require("nodemailer");
const settingsService = require("./appSettings");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const APPS_SCRIPT_MODE = "apps_script";
const SMTP_MODE = "smtp";

function providerMode(config = {}) {
  const value = String(config.email_provider_mode || APPS_SCRIPT_MODE).trim().toLowerCase();
  return value === SMTP_MODE ? SMTP_MODE : APPS_SCRIPT_MODE;
}

function normalizeAppsScriptConfig(config = {}) {
  const rawUrl = String(config.email_apps_script_url || "").trim();
  const token = String(config.email_apps_script_token || "").trim();
  if (!rawUrl) throw new Error("Google Apps Script Web App Exec URL is required.");
  let url;
  try { url = new URL(rawUrl); } catch (_) { throw new Error("Enter a valid Google Apps Script Web App URL."); }
  if (url.protocol !== "https:" || url.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec\/?$/.test(url.pathname)) {
    throw new Error("Apps Script URL must be an HTTPS Google Apps Script Web App /macros/s/.../exec URL.");
  }
  if (!token) throw new Error("Google Apps Script Secret API Token is not configured.");
  return { url: url.toString(), token };
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
  if (!host) throw new Error("SMTP Host is required.");
  if (!user) throw new Error("SMTP Username / Email Address is required.");
  if (!pass) throw new Error("SMTP Password / App Password is not configured.");
  if (!fromEmail || !EMAIL_RE.test(fromEmail)) throw new Error("A valid From Email address is required.");
  return { host, port, secure, auth: { user, pass }, from: { name: fromName || "FAZ NETWORK Billing", address: fromEmail }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000 };
}

function safeError(error) {
  return String(error && error.message || error || "Email operation failed.").replace(/[\r\n\t]+/g, " ").slice(0, 700);
}

function createTransport(config) {
  return nodemailer.createTransport(normalizeSmtpConfig(config));
}

async function sendAppsScriptEmail({ to, subject, html }, config) {
  const normalized = normalizeAppsScriptConfig(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    // Node's native fetch follows Apps Script's 302 redirect to its content-serving host.
    const response = await fetch(normalized.url, {
      method: "POST",
      redirect: "follow",
      headers: { "content-type": "application/json", "accept": "application/json" },
      body: JSON.stringify({ token: normalized.token, type: "notification", to, subject, html: String(html) }),
      signal: controller.signal
    });
    const raw = await response.text();
    let data;
    try { data = JSON.parse(raw); } catch (_) {
      throw new Error("Apps Script returned a non-JSON response (HTTP " + response.status + ").");
    }
    const appSuccess = data && (data.success === true || data.ok === true || String(data.status || "").toLowerCase() === "success");
    if (!response.ok || !appSuccess) {
      const message = String(data?.error || data?.message || data?.detail || "Apps Script email delivery was not confirmed.");
      const error = new Error(message.slice(0, 500));
      error.code = "APPS_SCRIPT_REJECTED";
      error.httpStatus = response.status;
      throw error;
    }
    return { success: true, provider: APPS_SCRIPT_MODE, messageId: data.messageId || data.message_id || null, message: String(data.message || "Email accepted by Google Apps Script.").slice(0, 300) };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendEmail({ to, subject, html, text } = {}) {
  try {
    const recipient = String(to || "").trim();
    const title = String(subject || "").trim();
    if (!recipient || !EMAIL_RE.test(recipient)) throw new Error("A valid recipient email address is required.");
    if (!title) throw new Error("Email subject is required.");
    if (!String(html || text || "").trim()) throw new Error("Email HTML or text body is required.");
    const settings = await settingsService.getAllSettings();
    if (providerMode(settings) === APPS_SCRIPT_MODE) {
      if (!String(html || "").trim()) throw new Error("Google Apps Script delivery requires an HTML email body.");
      return await sendAppsScriptEmail({ to: recipient, subject: title, html }, settings);
    }
    const config = normalizeSmtpConfig(settings);
    const from = '"' + config.from.name.replace(/["\\]/g, "") + '" <' + config.from.address + '>';
    const transporter = nodemailer.createTransport({ ...config, from });
    const info = await transporter.sendMail({ from, to: recipient, subject: title, ...(html ? { html: String(html) } : {}), ...(text ? { text: String(text) } : {}) });
    return { success: true, provider: SMTP_MODE, messageId: info.messageId || null, accepted: Array.isArray(info.accepted) ? info.accepted : [], rejected: Array.isArray(info.rejected) ? info.rejected : [] };
  } catch (error) {
    return { success: false, error: safeError(error), code: error && error.code ? String(error.code).slice(0, 80) : undefined };
  }
}

async function verifyConnection(config) {
  let transporter;
  try {
    const settings = config && typeof config === "object" ? config : await settingsService.getAllSettings();
    if (providerMode(settings) === APPS_SCRIPT_MODE) {
      normalizeAppsScriptConfig(settings);
      return { success: true, provider: APPS_SCRIPT_MODE, message: "Google Apps Script URL and token are configured. Send Test Email will verify delivery." };
    }
    transporter = createTransport(settings);
    await transporter.verify();
    return { success: true, provider: SMTP_MODE, message: "SMTP connection verified successfully." };
  } catch (error) {
    return { success: false, error: safeError(error), code: error && error.code ? String(error.code).slice(0, 80) : undefined };
  } finally {
    if (transporter && typeof transporter.close === "function") {
      try { transporter.close(); } catch (_) {}
    }
  }
}

module.exports = { sendEmail, verifyConnection, normalizeSmtpConfig, normalizeAppsScriptConfig, providerMode, sendAppsScriptEmail };
