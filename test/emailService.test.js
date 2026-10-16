"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");
const settingsService = require("../services/appSettings");
const emailService = require("../services/emailService");

const originalCreateTransport = nodemailer.createTransport;
const originalGetAllSettings = settingsService.getAllSettings;
const originalFetch = global.fetch;

test.afterEach(() => {
  nodemailer.createTransport = originalCreateTransport;
  settingsService.getAllSettings = originalGetAllSettings;
  global.fetch = originalFetch;
});

function validSettings(overrides = {}) {
  return {
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


function validAppsScriptSettings(overrides = {}) {
  return {
    email_provider_mode: "apps_script",
    email_apps_script_url: "https://script.google.com/macros/s/AKfycbExample/exec",
    email_apps_script_token: "script-secret-token",
    ...overrides
  };
}

test("Apps Script provider POSTs the required JSON payload and accepts successful JSON", async () => {
  settingsService.getAllSettings = async () => validAppsScriptSettings();
  let request;
  global.fetch = async (url, options) => {
    request = { url, options, body: JSON.parse(options.body) };
    return { ok: true, status: 200, text: async () => JSON.stringify({ success: true, message: "Email sent", messageId: "gas-message-1" }) };
  };

  const result = await emailService.sendEmail({ to: "customer@example.com", subject: "Renewal", html: "<p>Hello</p>", text: "Hello" });
  assert.equal(result.success, true);
  assert.equal(result.provider, "apps_script");
  assert.equal(result.messageId, "gas-message-1");
  assert.equal(request.url, "https://script.google.com/macros/s/AKfycbExample/exec");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.redirect, "follow");
  assert.equal(request.options.headers["Content-Type"], "application/json");
  assert.deepEqual(request.body, {
    token: "script-secret-token",
    type: "notification",
    to: "customer@example.com",
    subject: "Renewal",
    html: "<p>Hello</p>"
  });
});

test("Apps Script mode validates configuration and does not require SMTP credentials", async () => {
  settingsService.getAllSettings = async () => validAppsScriptSettings();
  const verification = await emailService.verifyConnection();
  assert.equal(verification.success, true);
  assert.equal(verification.provider, "apps_script");
  assert.equal(typeof global.fetch, "function");

  settingsService.getAllSettings = async () => validAppsScriptSettings({ email_apps_script_token: "" });
  const missingToken = await emailService.sendEmail({ to: "customer@example.com", subject: "Test", html: "<p>Hello</p>" });
  assert.equal(missingToken.success, false);
  assert.match(missingToken.error, /Secret API Token/);
});

test("Apps Script delivery rejects unsuccessful JSON and non-JSON responses", async () => {
  settingsService.getAllSettings = async () => validAppsScriptSettings();
  global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ success: false, error: "Invalid token" }) });
  const rejected = await emailService.sendEmail({ to: "customer@example.com", subject: "Test", html: "<p>Hello</p>" });
  assert.equal(rejected.success, false);
  assert.match(rejected.error, /Invalid token/);

  global.fetch = async () => ({ ok: true, status: 200, text: async () => "<html>Redirect error</html>" });
  const nonJson = await emailService.sendEmail({ to: "customer@example.com", subject: "Test", html: "<p>Hello</p>" });
  assert.equal(nonJson.success, false);
  assert.match(nonJson.error, /non-JSON response/);
});

test("Apps Script URL validation blocks non-Google or non-HTTPS endpoints", async () => {
  settingsService.getAllSettings = async () => validAppsScriptSettings({ email_apps_script_url: "http://example.com/exec" });
  const result = await emailService.verifyConnection();
  assert.equal(result.success, false);
  assert.match(result.error, /HTTPS Google Apps Script/);
});

test("Email test endpoint reports Apps Script success only when its JSON confirms delivery", async () => {
  const settingsController = require("../controllers/settingsController");
  settingsService.getAllSettings = async () => validAppsScriptSettings();
  global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ success: true, message: "Sent by MailApp" }) });
  const response = {
    statusCode: 200, headers: {}, payload: null,
    status(code) { this.statusCode = code; return this; },
    set(key, value) { this.headers[key] = value; return this; },
    json(value) { this.payload = value; return this; }
  };
  await settingsController.testEmail({ body: { to: "admin@example.com", subject: "Provider test" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.success, true);
  assert.match(response.payload.message, /Google Apps Script confirmed/);
  assert.equal(response.payload.result.provider, "apps_script");

  global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ success: false, error: "Token mismatch" }) });
  const failedResponse = {
    statusCode: 200, headers: {}, payload: null,
    status(code) { this.statusCode = code; return this; },
    set(key, value) { this.headers[key] = value; return this; },
    json(value) { this.payload = value; return this; }
  };
  await settingsController.testEmail({ body: { to: "admin@example.com", subject: "Provider test" } }, failedResponse);
  assert.equal(failedResponse.statusCode, 502);
  assert.equal(failedResponse.payload.success, false);
  assert.match(failedResponse.payload.message, /Token mismatch/);
});
