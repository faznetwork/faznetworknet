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
