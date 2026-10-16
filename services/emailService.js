"use strict";

const nodemailer = require("nodemailer");
const settingsService = require("./appSettings");

const APPS_SCRIPT_MODE = "apps_script";
const SMTP_MODE = "smtp";

function providerMode(config = {}) {
  const value = String(config.email_provider_mode || SMTP_MODE).trim().toLowerCase();
  return value === APPS_SCRIPT_MODE || value === "google_apps_script" || value === "google-apps-script" ? APPS_SCRIPT_MODE : SMTP_MODE;
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
  if (!fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) throw new Error("A valid From Email address is required.");
  return { host, port, secure, auth: { user, pass }, from: { name: fromName || "FAZ NETWORK Billing", address: fromEmail }, connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000 };
}

function normalizeAppsScriptConfig(config = {}) {
  const rawUrl = String(config.email_apps_script_url || "").trim();
  const token = String(config.email_apps_script_token || "").trim();
  if (!rawUrl) throw new Error("Google Apps Script Web App Exec URL is required.");
  let parsed;
  try { parsed = new URL(rawUrl); } catch (_) { throw new Error("Enter a valid Google Apps Script Web App Exec URL."); }
  if (parsed.protocol !== "https:" || parsed.hostname !== "script.google.com" || !/^\/macros\/s\/[^/]+\/exec\/?$/.test(parsed.pathname)) {
    throw new Error("Use the HTTPS Google Apps Script Web App URL ending in /macros/s/…/exec.");
  }
  if (!token) throw new Error("Google Apps Script Secret API Token is not configured.");
  return { url: parsed.toString(), token };
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
  if (!title) throw new Error("Email subject is required.");
  if (!String(html || text || "").trim()) throw new Error("Email HTML or text body is required.");
  return { recipient, title };
}

function htmlEscape(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function sendAppsScriptEmail({ to, subject, html, text }, config) {
  const appsScript = normalizeAppsScriptConfig(config);
  const htmlBody = String(html || ("<pre>" + htmlEscape(text || "") + "</pre>"));
  if (typeof fetch !== "function") throw new Error("This Node.js runtime does not provide native fetch.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    // Fetch's default redirect behavior changes POST to GET for 302/303 responses.
    // Apps Script ContentService commonly redirects to script.googleusercontent.com.
    const response = await fetch(appsScript.url, {
      method: "POST",
      redirect: "follow",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ token: appsScript.token, type: "notification", to: String(to).trim(), subject: String(subject).trim(), html: htmlBody })
    });
    const responseText = await response.text();
    let payload;
    try { payload = JSON.parse(responseText); } catch (_) {
      throw new Error("Google Apps Script returned a non-JSON response (HTTP " + response.status + ").");
    }
    if (!response.ok) {
      throw new Error(String(payload.message || payload.error || ("Google Apps Script HTTP " + response.status)).slice(0, 500));
    }
    if (!payload || payload.success !== true) {
      throw new Error(String(payload && (payload.message || payload.error) || "Google Apps Script did not confirm successful email delivery.").slice(0, 500));
    }
    return { success: true, provider: APPS_SCRIPT_MODE, messageId: payload.messageId || payload.id || null, response: { success: true, message: String(payload.message || "Email accepted by Google Apps Script.").slice(0, 300) } };
  } finally {
    clearTimeout(timer);
  }
}

async function sendSmtpEmail({ recipient, title, html, text }, settings) {
  const config = normalizeSmtpConfig(settings);
  const from = '"' + config.from.name.replace(/["\\]/g, "") + '" <' + config.from.address + '>';
  const transporter = nodemailer.createTransport({ ...config, from });
  const info = await transporter.sendMail({ from, to: recipient, subject: title, ...(html ? { html: String(html) } : {}), ...(text ? { text: String(text) } : {}) });
  return { success: true, provider: SMTP_MODE, messageId: info.messageId || null, accepted: Array.isArray(info.accepted) ? info.accepted : [], rejected: Array.isArray(info.rejected) ? info.rejected : [] };
}

async function sendEmail({ to, subject, html, text } = {}) {
  try {
    const { recipient, title } = validateEmailRequest({ to, subject, html, text });
    const settings = await settingsService.getAllSettings();
    if (providerMode(settings) === APPS_SCRIPT_MODE) {
      return await sendAppsScriptEmail({ to: recipient, subject: title, html, text }, settings);
    }
    return await sendSmtpEmail({ recipient, title, html, text }, settings);
  } catch (error) {
    return { success: false, error: safeError(error), code: error && error.code ? String(error.code).slice(0, 80) : undefined, provider: undefined };
  }
}

async function verifyConnection(emailConfig) {
  let transporter;
  try {
    const settings = emailConfig && typeof emailConfig === "object" ? emailConfig : await settingsService.getAllSettings();
    if (providerMode(settings) === APPS_SCRIPT_MODE) {
      normalizeAppsScriptConfig(settings);
      return { success: true, provider: APPS_SCRIPT_MODE, message: "Google Apps Script URL and secret are configured. Sending a test email will verify the live endpoint response." };
    }
    transporter = createTransport(settings);
    await transporter.verify();
    return { success: true, provider: SMTP_MODE, message: "SMTP connection verified successfully." };
  } catch (error) {
    return { success: false, error: safeError(error), code: error && error.code ? String(error.code).slice(0, 80) : undefined, provider: undefined };
  } finally {
    if (transporter && typeof transporter.close === "function") {
      try { transporter.close(); } catch (_) {}
    }
  }
}

module.exports = { sendEmail, verifyConnection, normalizeSmtpConfig, normalizeAppsScriptConfig, providerMode };
