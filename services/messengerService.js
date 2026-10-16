"use strict";

const settingsService = require("./appSettings");

const GRAPH_API_VERSION = "v19.0";
const MAX_MESSAGE_LENGTH = 2000;
const ALLOWED_TAGS = new Set(["ACCOUNT_UPDATE", "POST_PURCHASE_UPDATE", "CONFIRMED_EVENT_UPDATE"]);

function graphError(data, status) {
  const error = data && data.error ? data.error : {};
  const code = Number(error.code || 0);
  const subcode = Number(error.error_subcode || 0);
  if (code === 190) return new Error("Messenger Page Access Token is expired or invalid. Refresh the token in Notification Hub settings.");
  if (code === 100 || subcode === 2018001) return new Error("Messenger rejected the recipient PSID. Confirm the customer has messaged the connected Facebook Page and linked the correct PSID.");
  if (status === 429 || code === 4 || code === 17 || code === 32) return new Error("Messenger API rate limit reached. The notification can be retried later.");
  return new Error("Messenger delivery failed" + (error.message ? ": " + String(error.message).slice(0, 180) : " (HTTP " + status + ")."));
}

async function sendMessengerMessage(psid, messageText, tag = "ACCOUNT_UPDATE") {
  const recipient = String(psid || "").trim();
  const message = String(messageText || "").trim();
  const messageTag = String(tag || "ACCOUNT_UPDATE").trim().toUpperCase();
  if (!recipient) throw new Error("Messenger PSID is required.");
  if (!message) throw new Error("Messenger message text is required.");
  if (message.length > MAX_MESSAGE_LENGTH) throw new Error("Messenger message must be 2000 characters or fewer.");
  if (!ALLOWED_TAGS.has(messageTag)) throw new Error("Unsupported Messenger message tag.");

  const settings = await settingsService.getAllSettings();
  const token = String(settings.messenger_page_access_token || "").trim();
  if (!token) throw new Error("Messenger Page Access Token is not configured.");
  const url = "https://graph.facebook.com/" + GRAPH_API_VERSION + "/me/messages?access_token=" + encodeURIComponent(token);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipient },
      message: { text: message },
      messaging_type: "MESSAGE_TAG",
      tag: messageTag
    }),
    redirect: "error"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw graphError(data, response.status);
  return { success: true, messageId: data.message_id || null, recipientId: data.recipient_id || recipient };
}

module.exports = { sendMessengerMessage };
