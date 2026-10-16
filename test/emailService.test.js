"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");
const settingsService = require("../services/appSettings");
const emailService = require("../services/emailService");

const originalCreateTransport = nodemailer.createTransport;
const originalGetAllSettings = settingsService.getAllSettings;

test.afterEach(() => {
  nodemailer.createTransport = originalCreateTransport;
  settingsService.getAllSettings = originalGetAllSettings;
});

function validSettings(overrides = {}) {
  return {
    email_provider_mode: "smtp",
    smtp_host: "smtp.example.com", smtp_port: "587", smtp_secure: "false",
    smtp_username: "billing@example.com", smtp_password: "app-password",
    email_from_name: "FAZ NETWORK Billing", email_from_address: "billing@example.com",
    ...overrides
  };
}

test("sendEmail creates an authenticated SMTP transport and sends HTML plus text", async () => {
  settingsService.getAllSettings = async () => validSettings();
  let config, mail;
  nodemailer.createTransport = value => {
    config = value;
    return { sendMail: async value => { mail = value; return { messageId: "test-id", accepted: ["customer@example.com"], rejected: [] }; } };
  };
  const result = await emailService.sendEmail({ to: "customer@example.com", subject: "Renewal", html: "<p>Hello</p>", text: "Hello" });
  assert.equal(result.success, true);
  assert.equal(result.messageId, "test-id");
  assert.equal(config.host, "smtp.example.com");
  assert.equal(config.secure, false);
  assert.equal(config.auth.user, "billing@example.com");
  assert.equal(mail.to, "customer@example.com");
  assert.equal(mail.subject, "Renewal");
  assert.equal(mail.html, "<p>Hello</p>");
  assert.equal(mail.text, "Hello");
});

test("SMTP secure mode and port 465 are normalized", async () => {
  settingsService.getAllSettings = async () => validSettings({ smtp_port: "465", smtp_secure: "true" });
  let config;
  nodemailer.createTransport = value => { config = value; return { sendMail: async () => ({ accepted: [], rejected: [] }) }; };
  const result = await emailService.sendEmail({ to: "customer@example.com", subject: "Test", text: "Hello" });
  assert.equal(result.success, true);
  assert.equal(config.secure, true);
  assert.equal(config.port, 465);
});

test("verifyConnection reports SMTP handshake success and exposes bounded errors", async () => {
  let config, closed = false;
  nodemailer.createTransport = value => { config = value; return { verify: async () => true, close: () => { closed = true; } }; };
  const success = await emailService.verifyConnection(validSettings());
  assert.equal(success.success, true);
  assert.equal(config.host, "smtp.example.com");
  assert.equal(closed, true);

  nodemailer.createTransport = () => ({ verify: async () => { const error = new Error("Invalid login"); error.code = "EAUTH"; throw error; }, close() {} });
  const failure = await emailService.verifyConnection(validSettings());
  assert.equal(failure.success, false);
  assert.equal(failure.code, "EAUTH");
  assert.match(failure.error, /Invalid login/);
});

test("sendEmail catches invalid recipients and missing SMTP credentials", async () => {
  const invalidRecipient = await emailService.sendEmail({ to: "not-an-email", subject: "Test", text: "Hello" });
  assert.equal(invalidRecipient.success, false);
  assert.match(invalidRecipient.error, /valid recipient email/);

  settingsService.getAllSettings = async () => validSettings({ smtp_password: "" });
  const missingPassword = await emailService.sendEmail({ to: "customer@example.com", subject: "Test", text: "Hello" });
  assert.equal(missingPassword.success, false);
  assert.match(missingPassword.error, /Password \/ App Password/);
});

test("Apps Script mode posts the notification payload and follows Apps Script redirects", async () => {
  settingsService.getAllSettings = async () => ({
    email_provider_mode: "apps_script",
    email_apps_script_url: "https://script.google.com/macros/s/AKfycbExample/exec",
    email_apps_script_token: "secret-token"
  });
  const originalFetch = global.fetch;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, messageId: "gas-123" }) };
  };
  try {
    const result = await emailService.sendEmail({ to: "customer@example.com", subject: "Expiry reminder", html: "<p>Renew now</p>", text: "Renew now" });
    assert.equal(result.success, true);
    assert.equal(result.provider, "apps_script");
    assert.equal(result.messageId, "gas-123");
    assert.equal(request.url, "https://script.google.com/macros/s/AKfycbExample/exec");
    assert.equal(request.options.method, "POST");
    assert.equal(request.options.redirect, "follow");
    assert.equal(request.options.headers["content-type"], "application/json");
    assert.deepEqual(JSON.parse(request.options.body), {
      token: "secret-token", type: "notification", to: "customer@example.com",
      subject: "Expiry reminder", html: "<p>Renew now</p>"
    });
  } finally {
    global.fetch = originalFetch;
  }
});

test("Apps Script mode rejects invalid URL, missing token, non-JSON and unsuccessful JSON responses", async () => {
  assert.throws(() => emailService.normalizeAppsScriptConfig({
    email_apps_script_url: "https://example.com/macros/s/id/exec", email_apps_script_token: "x"
  }), /Google Apps Script Web App/);
  assert.throws(() => emailService.normalizeAppsScriptConfig({
    email_apps_script_url: "https://script.google.com/macros/s/id/exec", email_apps_script_token: ""
  }), /Secret API Token/);

  settingsService.getAllSettings = async () => ({
    email_provider_mode: "apps_script",
    email_apps_script_url: "https://script.google.com/macros/s/AKfycbExample/exec",
    email_apps_script_token: "secret-token"
  });
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => ({ ok: true, status: 200, text: async () => "<html>redirect error</html>" });
    const nonJson = await emailService.sendEmail({ to: "customer@example.com", subject: "Test", html: "<p>Test</p>" });
    assert.equal(nonJson.success, false);
    assert.match(nonJson.error, /non-JSON response/);

    global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ success: false, error: "Invalid token" }) });
    const rejected = await emailService.sendEmail({ to: "customer@example.com", subject: "Test", html: "<p>Test</p>" });
    assert.equal(rejected.success, false);
    assert.match(rejected.error, /Invalid token/);
  } finally {
    global.fetch = originalFetch;
  }
});

test("verifyConnection validates the selected Apps Script provider without exposing its token", async () => {
  const config = {
    email_provider_mode: "apps_script",
    email_apps_script_url: "https://script.google.com/macros/s/AKfycbExample/exec",
    email_apps_script_token: "secret-token"
  };
  const result = await emailService.verifyConnection(config);
  assert.equal(result.success, true);
  assert.equal(result.provider, "apps_script");
});
