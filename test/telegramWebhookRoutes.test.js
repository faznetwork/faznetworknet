"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { handleTelegramUpdate, parseStartPayload } = require("../routes/telegramWebhookRoutes");

test("parseStartPayload accepts a Telegram /start deep link and optional bot mention", () => {
  assert.equal(parseStartPayload("/start pppoe_user-123"), "pppoe_user-123");
  assert.equal(parseStartPayload("/start@faznetwork_Alerts_bot pppoe_user"), "pppoe_user");
  assert.equal(parseStartPayload("/start"), "");
  assert.equal(parseStartPayload("/help pppoe_user"), null);
  assert.equal(parseStartPayload("/start invalid username"), null);
});

test("Telegram /start links the matching customer and replies with Bengali success", async () => {
  const calls = [];
  const result = await handleTelegramUpdate({
    message: { text: "/start customer_123", chat: { id: 987654321 } }
  }, {
    query: async (sql, values) => {
      calls.push({ sql, values });
      return { rows: [{ username: "customer_123" }] };
    },
    sendMessage: async (...args) => { calls.push({ reply: args }); return { success: true }; }
  });

  assert.equal(result.linked, true);
  assert.match(calls[0].sql, /UPDATE customers SET telegram_chat_id=\$1/);
  assert.deepEqual(calls[0].values, ["987654321", "customer_123"]);
  assert.equal(calls[1].reply[0], "987654321");
  assert.equal(calls[1].reply[1], "ধন্যবাদ! আপনার FAZ NETWORK সংযোগের সাথে টেলিগ্রাম অ্যালার্ট সফলভাবে যুক্ত হয়েছে।");
});

test("Telegram /start reports unknown usernames and does not claim they were linked", async () => {
  const replies = [];
  let calls = 0;
  const result = await handleTelegramUpdate({
    message: { text: "/start not_a_customer", chat: { id: 42 } }
  }, {
    query: async () => ({ rows: ++calls === 1 ? [] : [] }),
    sendMessage: async (...args) => { replies.push(args); return { success: true }; }
  });
  assert.equal(result.linked, false);
  assert.equal(result.reason, "customer-not-found");
  assert.match(replies[0][1], /পাওয়া যায়নি/);
});

test("Telegram linking ignores unrelated updates and blocks malformed payloads", async () => {
  const unrelated = await handleTelegramUpdate({ message: { text: "hello", chat: { id: 1 } } }, {
    query: async () => { throw new Error("should not query"); },
    sendMessage: async () => { throw new Error("should not reply"); }
  });
  assert.equal(unrelated.handled, false);

  const replies = [];
  const missing = await handleTelegramUpdate({ message: { text: "/start", chat: { id: 2 } } }, {
    query: async () => { throw new Error("should not query"); },
    sendMessage: async (...args) => { replies.push(args); return { success: true }; }
  });
  assert.equal(missing.linked, false);
  assert.equal(missing.reason, "missing-username");
  assert.equal(replies.length, 1);
});

test("Telegram linking refuses to overwrite a different existing Chat ID", async () => {
  const replies = [];
  let calls = 0;
  const result = await handleTelegramUpdate({ message: { text: "/start customer_1", chat: { id: 2 } } }, {
    query: async () => ({ rows: ++calls === 1 ? [] : [{ username: "customer_1", telegram_chat_id: "1" }] }),
    sendMessage: async (...args) => { replies.push(args); return { success: true }; }
  });
  assert.equal(result.linked, false);
  assert.equal(result.reason, "already-linked");
  assert.match(replies[0][1], /ইতিমধ্যে/);
});
