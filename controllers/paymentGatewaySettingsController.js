"use strict";
const crypto = require("crypto");
const db = require("../db");

const MFS = ["bkash", "nagad", "rocket", "upay"];
const ENVIRONMENTS = new Set(["sandbox", "production"]);
const SETTINGS = {
  bkashNumber: "mfs_bkash_number",
  nagadNumber: "mfs_nagad_number",
  rocketNumber: "mfs_rocket_number",
  upayNumber: "mfs_upay_number",
  sslStoreId: "sslcommerz_store_id",
  sslEnvironment: "sslcommerz_environment",
  sslEnabled: "sslcommerz_enabled",
  sslStorePassword: "sslcommerz_store_password_encrypted"
};

function encryptionKey() {
  const secret = String(process.env.PAYMENT_GATEWAY_ENCRYPTION_KEY || "").trim();
  if (!secret) throw new Error("PAYMENT_GATEWAY_ENCRYPTION_KEY must be configured before saving gateway secrets.");
  return crypto.createHash("sha256").update(secret, "utf8").digest();
}
function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return "enc:v1:" + iv.toString("base64") + ":" + cipher.getAuthTag().toString("base64") + ":" + encrypted.toString("base64");
}
function isEncrypted(value) { return String(value || "").startsWith("enc:v1:"); }
function bool(value) { return value === true || value === 1 || ["true", "1", "on"].includes(String(value || "").trim().toLowerCase()); }
function cleanNumber(value, label) {
  const number = String(value || "").trim();
  if (number && !/^[+0-9 ()-]{7,24}$/.test(number)) throw new Error(label + " must be a valid phone number.");
  return number;
}
async function readMap(query = db.query.bind(db)) {
  const result = await query("SELECT key,value FROM app_settings WHERE key=ANY($1::varchar[])", [Object.values(SETTINGS)]);
  return Object.fromEntries((result.rows || []).map(row => [row.key, String(row.value || "")]));
}
async function getPaymentGateways(req, res) {
  try {
    const s = await readMap();
    const storedSecret = s[SETTINGS.sslStorePassword] || "";
    return res.set("Cache-Control", "no-store, max-age=0").json({
      success: true,
      settings: {
        mfs: Object.fromEntries(MFS.map(name => [name, {
          enabled: Boolean(s[SETTINGS[name + "Number"]]),
          number: s[SETTINGS[name + "Number"]] || ""
        }])),
        sslcommerz: {
          enabled: bool(s[SETTINGS.sslEnabled]),
          storeId: s[SETTINGS.sslStoreId] || "",
          environment: ENVIRONMENTS.has(s[SETTINGS.sslEnvironment]) ? s[SETTINGS.sslEnvironment] : "sandbox",
          secretConfigured: Boolean(storedSecret),
          secretEncrypted: !storedSecret || isEncrypted(storedSecret)
        }
      }
    });
  } catch (error) {
    console.error("[Payment Gateway Settings] Read failed:", error.message);
    return res.status(503).set("Cache-Control", "no-store").json({ success: false, message: "Payment gateway settings are temporarily unavailable." });
  }
}
async function savePaymentGateways(req, res) {
  try {
    const body = req.body || {};
    const mfs = body.mfs && typeof body.mfs === "object" && !Array.isArray(body.mfs) ? body.mfs : {};
    const ssl = body.sslcommerz && typeof body.sslcommerz === "object" && !Array.isArray(body.sslcommerz) ? body.sslcommerz : {};
    const values = [];
    for (const provider of MFS) {
      const number = cleanNumber(mfs[provider]?.number, provider.toUpperCase());
      const enabled = bool(mfs[provider]?.enabled);
      if (enabled && !number) throw new Error(provider.toUpperCase() + " receiving number is required when enabled.");
      values.push([SETTINGS[provider + "Number"], number]);
    }
    const storeId = String(ssl.storeId || "").trim().slice(0, 200);
    const environment = String(ssl.environment || "sandbox").trim().toLowerCase();
    const enabled = bool(ssl.enabled);
    const newSecret = String(ssl.storePassword || "").trim();
    if (!ENVIRONMENTS.has(environment)) throw new Error("Choose a valid SSLCommerz environment.");
    if (enabled && !storeId) throw new Error("SSLCommerz Store ID is required when enabled.");
    if (enabled && !newSecret) {
      const existing = await db.query("SELECT value FROM app_settings WHERE key=$1 LIMIT 1", [SETTINGS.sslStorePassword]);
      if (!existing.rows?.[0]?.value) throw new Error("SSLCommerz API secret is required when the gateway is enabled.");
    }
    values.push([SETTINGS.sslStoreId, storeId], [SETTINGS.sslEnvironment, environment], [SETTINGS.sslEnabled, enabled ? "true" : "false"]);
    if (newSecret) values.push([SETTINGS.sslStorePassword, encryptSecret(newSecret)]);
    await db.withTransaction(async tx => {
      for (const [key, value] of values) {
        await tx.query("INSERT INTO app_settings(key,value,updated_at) VALUES($1,$2,NOW()) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()", [key, value]);
      }
    });
    try { require("../services/appSettings").invalidate(); } catch (_) {}
    return res.set("Cache-Control", "no-store").json({ success: true, message: "Payment gateway settings saved securely." });
  } catch (error) {
    const message = String(error?.message || "Unable to save payment gateway settings.");
    const status = /PAYMENT_GATEWAY_ENCRYPTION_KEY/.test(message) ? 503 : 400;
    return res.status(status).set("Cache-Control", "no-store").json({ success: false, message });
  }
}
module.exports = { getPaymentGateways, savePaymentGateways };
