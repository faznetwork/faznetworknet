"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const settingsService = require("../services/appSettings");
const telegramService = require("../services/telegramService");

const originalGetAllSettings = settingsService.getAllSettings;
const originalFetch = global.fetch;

test.afterEach(() => {
  settingsService.getAllSettings = originalGetAllSettings;
  global.fetch = originalFetch;
});

test("sendTelegramMessage sends Bot API payload and returns message id", async () => {
  settingsService.getAllSettings = async () => ({ telegram_bot_token: "123456:fake-token" });
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ ok: true, result: { message_id: 77, chat: { id: 123 } } }) };
  };

  const result = await telegramService.sendTelegramMessage("123", "<b>Hello</b>");
  assert.equal(result.success, true);
  assert.equal(result.result.message_id, 77);
  assert.match(request.url, /bot123456:fake-token\/sendMessage$/);
  assert.deepEqual(JSON.parse(request.options.body), { chat_id: "123", text: "<b>Hello</b>", parse_mode: "HTML" });
});

test("sendTelegramMessage exposes Telegram API errors without throwing", async () => {
  settingsService.getAllSettings = async () => ({ telegram_bot_token: "123456:fake-token" });
  global.fetch = async () => ({
    ok: false, status: 403, statusText: "Forbidden",
    json: async () => ({ ok: false, error_code: 403, description: "bot was blocked by the user" })
  });

  const result = await telegramService.sendTelegramMessage("123", "Hello");
  assert.equal(result.success, false);
  assert.equal(result.error_code, 403);
  assert.match(result.error, /blocked by the user/);
  assert.match(result.hint, /blocked/);
});

test("sendTelegramMessage reports missing credentials and target safely", async () => {
  settingsService.getAllSettings = async () => ({ telegram_bot_token: "" });
  const missingToken = await telegramService.sendTelegramMessage("123", "Hello");
  assert.equal(missingToken.success, false);
  assert.match(missingToken.error, /Bot Token is not configured/);

  settingsService.getAllSettings = async () => ({ telegram_bot_token: "token" });
  const missingChat = await telegramService.sendTelegramMessage("", "Hello");
  assert.equal(missingChat.success, false);
  assert.match(missingChat.error, /Chat ID is required/);
});

test("sendTelegramMessage handles fetch failures without uncaught exceptions", async () => {
  settingsService.getAllSettings = async () => ({ telegram_bot_token: "123456:fake-token" });
  global.fetch = async () => { throw new Error("network unavailable"); };
  const result = await telegramService.sendTelegramMessage("123", "Hello");
  assert.equal(result.success, false);
  assert.match(result.error, /network unavailable/);
});
