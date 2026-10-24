"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const nodemailer = require("nodemailer");
const settingsService = require("../services/appSettings");
const emailService = require("../services/emailService");

const originalCreateTransport = nodemailer.createTransport;
const originalGetAllSettings = settingsService.getAllSettings;
const originalFetch = global.fetch;
const originalConsoleWarn = console.warn;

test.afterEach(() => {
  nodemailer.createTransport = originalCreateTransport;
  settingsService.getAllSettings = originalGetAllSettings;
  global.fetch = originalFetch;
  console.warn = originalConsoleWarn;
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


test("legacy Apps Script database mode is ignored and SMTP remains canonical", async () => {
  settingsService.getAllSettings = async () => validSettings({
    email_provider_mode: "apps_script",
    email_apps_script_url: "https://script.google.com/macros/s/legacy/exec",
    email_apps_script_token: "legacy-token"
  });
  let transportConfig;
  nodemailer.createTransport = config => {
    transportConfig = config;
    return { sendMail: async () => ({ messageId: "smtp-canonical", accepted: ["customer@example.com"], rejected: [] }), close() {} };
  };
  const result = await emailService.sendEmail({ to: "customer@example.com", subject: "Canonical", text: "Hello" });
  assert.equal(result.success, true);
  assert.equal(result.provider, "smtp");
  assert.equal(result.messageId, "smtp-canonical");
  assert.equal(transportConfig.host, "smtp.example.com");
  assert.equal(emailService.providerMode({ email_provider_mode: "apps_script" }), "smtp");
});

test("sensitive email history never includes the OTP or invitation body", async () => {
  const history = require("../services/messageHistoryService");
  const originalRecordMessage = history.recordMessage;
  let recorded;
  history.recordMessage = async payload => { recorded = payload; };
  settingsService.getAllSettings = async () => validSettings();
  nodemailer.createTransport = () => ({
    sendMail: async () => ({ messageId: "sensitive-message", accepted: ["admin@example.com"], rejected: [] }),
    close() {}
  });
  try {
    const result = await emailService.sendEmail({
      to: "admin@example.com", subject: "Verification code",
      text: "OTP 123456 must never appear in logs", html: "<p>OTP 123456</p>",
      event: "admin_login_otp", sensitive: true
    });
    assert.equal(result.success, true);
    assert.equal(recorded.message, "[sensitive email payload omitted]");
    assert.doesNotMatch(recorded.message, /123456/);
  } finally {
    history.recordMessage = originalRecordMessage;
  }
});

test("email test endpoint verifies and sends through SMTP", async () => {
  const settingsController = require("../controllers/settingsController");
  settingsService.getAllSettings = async () => validSettings();
  nodemailer.createTransport = () => ({
    verify: async () => true,
    sendMail: async () => ({ messageId: "test-endpoint-message", accepted: ["admin@example.com"], rejected: [] }),
    close() {}
  });
  const response = {
    statusCode: 200, headers: {}, payload: null,
    status(code) { this.statusCode = code; return this; },
    set(key, value) { this.headers[key] = value; return this; },
    json(value) { this.payload = value; return this; }
  };
  await settingsController.testEmail({ body: { to: "admin@example.com", subject: "Provider test" } }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.payload.success, true);
  assert.match(response.payload.message, /SMTP connection verified/);
  assert.equal(response.payload.result.provider, "smtp");
});
