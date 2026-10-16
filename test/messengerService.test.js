"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const settingsService = require("../services/appSettings");
const { sendMessengerMessage } = require("../services/messengerService");

test("Messenger service sends ACCOUNT_UPDATE using the v19.0 Graph API", async () => {
  const originalSettings = settingsService.getAllSettings;
  const originalFetch = global.fetch;
  let request;
  settingsService.getAllSettings = async () => ({ messenger_page_access_token: "test-page-token" });
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ message_id: "mid.123", recipient_id: "123456" }) };
  };
  try {
    const result = await sendMessengerMessage("123456", "Your FAZ NETWORK account has been updated.");
    assert.match(request.url, /^https:\/\/graph\.facebook\.com\/v19\.0\/me\/messages\?access_token=/);
    assert.equal(request.options.method, "POST");
    assert.deepEqual(JSON.parse(request.options.body), {
      recipient: { id: "123456" },
      message: { text: "Your FAZ NETWORK account has been updated." },
      messaging_type: "MESSAGE_TAG",
      tag: "ACCOUNT_UPDATE"
    });
    assert.equal(result.success, true);
    assert.equal(result.messageId, "mid.123");
  } finally {
    settingsService.getAllSettings = originalSettings;
    global.fetch = originalFetch;
  }
});

test("Messenger service gives a safe actionable error for expired tokens", async () => {
  const originalSettings = settingsService.getAllSettings;
  const originalFetch = global.fetch;
  settingsService.getAllSettings = async () => ({ messenger_page_access_token: "expired-token" });
  global.fetch = async () => ({
    ok: false,
    status: 400,
    json: async () => ({ error: { code: 190, message: "Invalid OAuth access token." } })
  });
  try {
    await assert.rejects(sendMessengerMessage("123456", "Test"), /expired or invalid/);
  } finally {
    settingsService.getAllSettings = originalSettings;
    global.fetch = originalFetch;
  }
});

test("Messenger service rejects missing PSIDs before making a network request", async () => {
  const originalFetch = global.fetch;
  let called = false;
  global.fetch = async () => { called = true; throw new Error("unexpected network call"); };
  try {
    await assert.rejects(sendMessengerMessage("", "Test"), /PSID is required/);
    assert.equal(called, false);
  } finally {
    global.fetch = originalFetch;
  }
});
