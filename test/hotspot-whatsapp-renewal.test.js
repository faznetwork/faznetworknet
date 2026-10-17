"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const appSettings = require("../services/appSettings");
const whatsapp = require("../services/whatsappService");
const dispatcher = require("../services/notificationDispatcher");

test("Hotspot Quick Renew sends WhatsApp with normalized Bangladesh number and safe fallback template", async () => {
  const oldSettings = appSettings.getAllSettings;
  const oldQuery = db.query;
  const oldSend = whatsapp.sendMessage;
  const sent = [];
  appSettings.getAllSettings = async () => ({ notification_channel_whatsapp_enabled: false });
  db.query = async sql => {
    if (String(sql).includes("FROM notification_templates")) return { rows: [] };
    throw new Error("Unexpected database query in dispatcher test: " + sql);
  };
  whatsapp.sendMessage = async payload => {
    sent.push(payload);
    return { success: true, messageId: "mock-message-id" };
  };
  try {
    const result = await dispatcher.dispatchNow({
      userType: "hotspot",
      event: "hotspot_renewal",
      phone: "01712345678",
      username: "voucher-test",
      customer: { username: "voucher-test", name: "Test Subscriber", phone: "01712345678" },
      variables: { package: "Daily", expiry_date: "2026-10-18 18:00:00", price: 10 },
      channels: ["sms", "whatsapp"]
    });
    assert.equal(result.success, true);
    assert.equal(sent.length, 1, "WhatsApp must be invoked even when no separate renewal rule exists");
    assert.equal(sent[0].to, "8801712345678");
    assert.match(sent[0].message, /FAZ NETWORK: আপনার হটস্পট প্যাকেজ সফলভাবে রিনিউ হয়েছে/);
    assert.match(sent[0].message, /2026-10-18 18:00:00/);
    assert.match(sent[0].message, /ধন্যবাদ!/);
    assert.equal(result.results.find(item => item.channel === "whatsapp").result.success, true);
  } finally {
    appSettings.getAllSettings = oldSettings;
    db.query = oldQuery;
    whatsapp.sendMessage = oldSend;
  }
});

test("WhatsApp dispatcher normalizes local and international Bangladesh mobile numbers", () => {
  assert.equal(dispatcher.normalizePhone("01712345678"), "8801712345678");
  assert.equal(dispatcher.normalizePhone("+8801712345678"), "8801712345678");
  assert.equal(dispatcher.normalizePhone("008801712345678"), "8801712345678");
});
