"use strict";

const settingsService = require("./appSettings");

const API_BASE = "https://api.telegram.org";
const MAX_MESSAGE_LENGTH = 4096;

function safeDescription(value) {
  return String(value || "Telegram API request failed.").replace(/[\r\n\t]+/g, " ").slice(0, 500);
}

async function sendTelegramMessage(chatId, messageText, options = { parse_mode: "HTML" }) {
  const recipient = String(chatId ?? "").trim();
  const text = String(messageText ?? "");
  if (!recipient) return { success: false, error: "Telegram target Chat ID is required." };
  if (!text.trim()) return { success: false, error: "Telegram message text is required." };
  if (text.length > MAX_MESSAGE_LENGTH) return { success: false, error: "Telegram messages must be 4096 characters or fewer." };

  let token = "";
  try {
    const settings = await settingsService.getAllSettings();
    token = String(settings.telegram_bot_token || "").trim();
  } catch (error) {
    return { success: false, error: "Could not load Telegram settings: " + safeDescription(error.message) };
  }
  if (!token) return { success: false, error: "Telegram Bot Token is not configured." };

  const config = options && typeof options === "object" ? options : {};
  const payload = { chat_id: recipient, text };
  const parseMode = Object.prototype.hasOwnProperty.call(config, "parse_mode") ? config.parse_mode : "HTML";
  if (parseMode) payload.parse_mode = parseMode;
  if (typeof config.disable_web_page_preview === "boolean") payload.disable_web_page_preview = config.disable_web_page_preview;
  if (typeof config.disable_notification === "boolean") payload.disable_notification = config.disable_notification;
  if (config.reply_markup && typeof config.reply_markup === "object") payload.reply_markup = config.reply_markup;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(API_BASE + "/bot" + token + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "error"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) {
      const description = safeDescription(data.description || response.statusText || "Telegram API rejected the request.");
      const errorCode = Number(data.error_code || response.status || 0) || undefined;
      return {
        success: false,
        error: description,
        error_code: errorCode,
        ...(errorCode === 401 ? { hint: "The bot token is invalid or revoked." } : {}),
        ...(errorCode === 403 ? { hint: "The bot may be blocked by the recipient, or it may not have permission to post in the chat." } : {}),
        ...(errorCode === 400 ? { hint: "Check the target Chat ID, bot membership, and message formatting." } : {})
      };
    }
    return { success: true, result: data.result ? { message_id: data.result.message_id, chat_id: data.result.chat?.id } : undefined };
  } catch (error) {
    const aborted = error?.name === "AbortError";
    return {
      success: false,
      error: aborted ? "Telegram API request timed out after 8 seconds." : safeDescription(error?.message || error),
      ...(aborted ? { error_code: "TIMEOUT" } : {})
    };
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { sendTelegramMessage };
