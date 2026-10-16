"use strict";

const express = require("express");
const crypto = require("crypto");
const db = require("../db");
const settingsService = require("../services/appSettings");
const router = express.Router();

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validSignature(req, appSecret) {
  if (!appSecret) return true;
  const supplied = String(req.get("x-hub-signature-256") || "");
  if (!/^sha256=[a-f0-9]{64}$/i.test(supplied) || !Buffer.isBuffer(req.rawBody)) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(req.rawBody).digest("hex");
  return safeEqual(supplied, expected);
}

function extractUsername(event) {
  const text = String(event?.message?.text || "").trim();
  const payload = String(event?.postback?.payload || event?.message?.quick_reply?.payload || "").trim();
  const candidate = payload || text;
  const prefixed = candidate.match(/^(?:FAZ_LINK|LINK_ACCOUNT|LINK_PPPOE):\\s*(.+)$/i);
  const username = String(prefixed ? prefixed[1] : candidate).trim();
  if (!username || username.length > 100 || /\s/.test(username)) return "";
  return username;
}

router.get("/", async (req, res) => {
  try {
    const mode = String(req.query["hub.mode"] || "");
    const token = String(req.query["hub.verify_token"] || "");
    const challenge = String(req.query["hub.challenge"] || "");
    if (mode !== "subscribe" || !token || !challenge) return res.sendStatus(400);
    const settings = await settingsService.getAllSettings();
    const expected = String(settings.messenger_verify_token || "");
    if (!expected || !safeEqual(token, expected)) return res.sendStatus(403);
    return res.status(200).type("text/plain").send(challenge);
  } catch (error) {
    console.warn("[Messenger Webhook] Verification failed:", String(error?.message || error).slice(0, 180));
    return res.sendStatus(503);
  }
});

router.post("/", async (req, res) => {
  try {
    const settings = await settingsService.getAllSettings();
    if (!validSignature(req, String(settings.messenger_app_secret || ""))) {
      console.warn("[Messenger Webhook] Rejected request with invalid signature.");
      return res.sendStatus(403);
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (body.object !== "page") return res.sendStatus(404);
    const configuredPageId = String(settings.messenger_page_id || "").trim();
    for (const entry of Array.isArray(body.entry) ? body.entry : []) {
      if (configuredPageId && String(entry.id || "") !== configuredPageId) continue;
      for (const event of Array.isArray(entry.messaging) ? entry.messaging : []) {
        const psid = String(event?.sender?.id || "").trim();
        const username = extractUsername(event);
        if (!psid || !username || psid.length > 150) continue;
        try {
          const linked = await db.query(
            "UPDATE customers SET messenger_psid=$1, updated_at=NOW() WHERE username=$2 AND (messenger_psid IS NULL OR messenger_psid=$1) RETURNING username",
            [psid, username]
          );
          if (linked.rows?.length) console.info("[Messenger] Linked PSID for customer " + username + ".");
          else console.info("[Messenger] No eligible customer found for account-link request.");
        } catch (error) {
          console.warn("[Messenger Webhook] Account link failed:", String(error?.message || error).slice(0, 180));
        }
      }
    }
    return res.status(200).json({ success: true });
  } catch (error) {
    console.warn("[Messenger Webhook] Event processing failed:", String(error?.message || error).slice(0, 180));
    // Meta retries non-2xx responses. Return 200 for safely ignored malformed events,
    // while keeping invalid signatures rejected above.
    return res.status(200).json({ success: true });
  }
});

module.exports = router;
