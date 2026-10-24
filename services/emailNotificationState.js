"use strict";

const db = require("../db");

async function isEnabled(client = null) {
  const query = client ? client.query.bind(client) : db.query.bind(db);
  const result = await query(
    "SELECT value FROM app_settings WHERE key = $1 LIMIT 1",
    ["notification_channel_email_enabled"]
  );
  const value = String(result.rows?.[0]?.value ?? "false").trim().toLowerCase();
  return value === "true" || value === "1";
}

module.exports = { isEnabled };
