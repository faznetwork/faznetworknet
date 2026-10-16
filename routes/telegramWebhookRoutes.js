"use strict";

const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const telegramService = require("../services/telegramService");

const router = express.Router();
const SUCCESS_MESSAGE = "ধন্যবাদ! আপনার FAZ NETWORK সংযোগের সাথে টেলিগ্রাম অ্যালার্ট সফলভাবে যুক্ত হয়েছে।";

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parseStartPayload(text) {
  const match = String(text || "").trim().match(/^\/start(?:@\w+)?(?:\s+([A-Za-z0-9_-]{1,64}))?\s*$/i);
  return match ? String(match[1] || "").trim() : null;
}

async function handleTelegramUpdate(update, dependencies = {}) {
  const query = dependencies.query || ((sql, values) => db.query(sql, values));
  const sendMessage = dependencies.sendMessage || telegramService.sendTelegramMessage;
  const message = update && update.message;
  if (!message || !message.chat || message.chat.id === undefined || message.chat.id === null || (message.chat.type && message.chat.type !== "private")) {
    return { handled: false, reason: "not-a-chat-message" };
  }

  const text = String(message.text || "").trim();
  if (!/^\/start(?:@\w+)?(?:\s|$)/i.test(text)) {
    return { handled: false, reason: "not-start-command" };
  }

  const chatId = String(message.chat.id);
  const username = parseStartPayload(text);
  if (!username) {
    await sendMessage(chatId, "আপনার FAZ NETWORK সংযোগ যুক্ত করতে আপনার ব্যক্তিগত লিংক থেকে বটটি খুলুন।", { parse_mode: null });
    return { handled: true, linked: false, reason: "missing-username" };
  }

  try {
    const linked = await query(
      "UPDATE customers SET telegram_chat_id=$1, updated_at=NOW() WHERE LOWER(username)=LOWER($2) AND (telegram_chat_id IS NULL OR BTRIM(telegram_chat_id)='' OR telegram_chat_id=$1) RETURNING username",
      [chatId, username]
    );
    if (linked.rows && linked.rows.length) {
      await sendMessage(chatId, SUCCESS_MESSAGE, { parse_mode: null });
      console.info("[Telegram Link] Customer Telegram alerts linked.");
      return { handled: true, linked: true };
    }

    const existing = await query(
      "SELECT username, telegram_chat_id FROM customers WHERE LOWER(username)=LOWER($1) LIMIT 1",
      [username]
    );
    if (!existing.rows || !existing.rows.length) {
      await sendMessage(chatId, "দুঃখিত, এই PPPoE ইউজারনেমটি FAZ NETWORK-এ পাওয়া যায়নি। আপনার ইউজারনেম যাচাই করে আবার চেষ্টা করুন।", { parse_mode: null });
      return { handled: true, linked: false, reason: "customer-not-found" };
    }

    const currentChatId = String(existing.rows[0].telegram_chat_id || "").trim();
    if (currentChatId && currentChatId !== chatId) {
      await sendMessage(chatId, "এই সংযোগটি ইতিমধ্যে অন্য একটি Telegram অ্যাকাউন্টের সাথে যুক্ত আছে। সহায়তার জন্য FAZ NETWORK সাপোর্টে যোগাযোগ করুন।", { parse_mode: null });
      return { handled: true, linked: false, reason: "already-linked" };
    }

    await sendMessage(chatId, "এই Telegram অ্যাকাউন্টটি অন্য একটি সংযোগের সাথে যুক্ত থাকতে পারে। সহায়তার জন্য FAZ NETWORK সাপোর্টে যোগাযোগ করুন।", { parse_mode: null });
    return { handled: true, linked: false, reason: "chat-id-in-use" };
  } catch (error) {
    // A unique-index collision means this Telegram chat is already assigned to
    // another customer. Do not expose database details to the Telegram user.
    const collision = error && (error.code === "23505" || /unique/i.test(String(error.message || "")));
    console.warn("[Telegram Link] Account-link operation failed:", collision ? "chat ID already linked" : String(error && error.message || error).slice(0, 180));
    try {
      await sendMessage(chatId, collision
        ? "এই Telegram অ্যাকাউন্টটি ইতিমধ্যে অন্য একটি FAZ NETWORK সংযোগের সাথে যুক্ত আছে।"
        : "দুঃখিত, এখন Telegram অ্যালার্ট যুক্ত করা যাচ্ছে না। কিছুক্ষণ পর আবার চেষ্টা করুন।", { parse_mode: null });
    } catch (replyError) {
      console.warn("[Telegram Link] Could not send reply:", String(replyError && replyError.message || replyError).slice(0, 160));
    }
    return { handled: true, linked: false, reason: collision ? "chat-id-in-use" : "operation-failed" };
  }
}

router.post("/", async (req, res) => {
  const expectedSecret = String(process.env.TELEGRAM_WEBHOOK_SECRET || "").trim();
  if (expectedSecret && !safeEqual(req.get("x-telegram-bot-api-secret-token"), expectedSecret)) {
    console.warn("[Telegram Webhook] Rejected request with invalid secret token.");
    return res.sendStatus(403);
  }
  try {
    await handleTelegramUpdate(req.body);
    // Telegram retries non-2xx responses. A malformed or irrelevant update is
    // safely ignored; transient delivery errors are recorded and not retried forever.
    return res.sendStatus(200);
  } catch (error) {
    console.warn("[Telegram Webhook] Update processing failed:", String(error && error.message || error).slice(0, 180));
    return res.sendStatus(200);
  }
});

module.exports = router;
module.exports.handleTelegramUpdate = handleTelegramUpdate;
module.exports.parseStartPayload = parseStartPayload;
