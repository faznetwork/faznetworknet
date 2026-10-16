"use strict";

const nodemailer = require("nodemailer");
const settingsService = require("./appSettings");

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

function safeError(error) {
  return String(error && error.message || error || "SMTP operation failed.").replace(/[\r\n\t]+/g, " ").slice(0, 700);
}

function createTransport(config) {
  return nodemailer.createTransport(normalizeSmtpConfig(config));
}

async function sendEmail({ to, subject, html, text } = {}) {
  try {
    const recipient = String(to || "").trim();
    const title = String(subject || "").trim();
    if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) throw new Error("A valid recipient email address is required.");
    if (!title) throw new Error("Email subject is required.");
    if (!String(html || text || "").trim()) throw new Error("Email HTML or text body is required.");
    const settings = await settingsService.getAllSettings();
    const config = normalizeSmtpConfig(settings);
    const transporter = nodemailer.createTransport({ ...config, from: '"' + config.from.name.replace(/["\\]/g, "") + '" <' + config.from.address + '>' });
    const info = await transporter.sendMail({ from: '"' + config.from.name.replace(/["\\]/g, "") + '" <' + config.from.address + '>', to: recipient, subject: title, ...(html ? { html: String(html) } : {}), ...(text ? { text: String(text) } : {}) });
    return { success: true, messageId: info.messageId || null, accepted: Array.isArray(info.accepted) ? info.accepted : [], rejected: Array.isArray(info.rejected) ? info.rejected : [] };
  } catch (error) {
    return { success: false, error: safeError(error), code: error && error.code ? String(error.code).slice(0, 80) : undefined };
  }
}

async function verifyConnection(smtpConfig) {
  let transporter;
  try {
    const settings = smtpConfig && typeof smtpConfig === "object" ? smtpConfig : await settingsService.getAllSettings();
    transporter = createTransport(settings);
    await transporter.verify();
    return { success: true, message: "SMTP connection verified successfully." };
  } catch (error) {
    return { success: false, error: safeError(error), code: error && error.code ? String(error.code).slice(0, 80) : undefined };
  } finally {
    if (transporter && typeof transporter.close === "function") {
      try { transporter.close(); } catch (_) {}
    }
  }
}

module.exports = { sendEmail, verifyConnection, normalizeSmtpConfig };
