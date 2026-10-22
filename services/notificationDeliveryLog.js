"use strict";

const db = require("../db");
const query = (...args) => db.getPool().query(...args);
let tableReady = null;

async function ensureTable() {
  if (!tableReady) {
    tableReady = query(`
      CREATE TABLE IF NOT EXISTS notification_delivery_logs (
        id BIGSERIAL PRIMARY KEY,
        channel VARCHAR(30) NOT NULL CHECK (channel IN ('whatsapp','sms','email','telegram','messenger')),
        provider VARCHAR(100) NOT NULL DEFAULT 'unknown',
        recipient VARCHAR(40) NOT NULL,
        message_body TEXT NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','sent','delivered','failed','skipped')),
        transaction_id VARCHAR(160),
        provider_message_id VARCHAR(200),
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_created
        ON notification_delivery_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_channel_provider
        ON notification_delivery_logs(channel, provider, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_recipient
        ON notification_delivery_logs(recipient);
      CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_transaction
        ON notification_delivery_logs(transaction_id) WHERE transaction_id IS NOT NULL;
    `).catch(error => { tableReady = null; throw error; });
  }
  return tableReady;
}

function providerLabel({channel, mode, preset, settings = {}} = {}) {
  if (channel === "whatsapp") return "WhatsApp";
  if (channel === "email") return String(settings.email_provider_mode || "Email").toUpperCase() === "SMTP" ? "SMTP Email" : "Email";
  const normalizedPreset = mode === "provider_preset" ? String(preset || settings.sms_provider_preset || "").toLowerCase() : "";
  const labels = { greenweb: "Greenweb", alpha_sms: "Alpha SMS", elitbuzz: "Elitbuzz", bulk_sms_bd: "Bulk SMS BD" };
  if (labels[normalizedPreset]) return labels[normalizedPreset];
  if (mode === "personal_device") return "Android SMS Gateway";
  if (mode === "bulk_sms") return "Bulk SMS Gateway";
  if (mode === "provider_preset") return "SMS Provider";
  if (mode === "custom_http") return "Custom SMS Gateway";
  return "SMS Gateway";
}

async function createAttempt({channel, provider, recipient, message, transactionId} = {}) {
  try {
    await ensureTable();
    const result = await db.query(
      `INSERT INTO notification_delivery_logs(channel,provider,recipient,message_body,status,transaction_id)
       VALUES($1,$2,$3,$4,'pending',$5) RETURNING id`,
      [String(channel || "sms").slice(0,30), String(provider || "unknown").slice(0,100),
       String(recipient || "").slice(0,40), String(message || "").slice(0,4000),
       transactionId ? String(transactionId).slice(0,160) : null]
    );
    return result.rows?.[0]?.id || null;
  } catch (error) {
    console.warn("[Notification History] Could not create delivery log:", error.message);
    return null;
  }
}

async function finishAttempt(id, {status, providerMessageId, error} = {}) {
  if (!id) return;
  try {
    await ensureTable();
    const nextStatus = ["sent","delivered","failed","skipped"].includes(status) ? status : "failed";
    await db.query(
      `UPDATE notification_delivery_logs
       SET status=$2,
           provider_message_id=COALESCE($3,provider_message_id),
           error_message=$4,
           sent_at=CASE WHEN $2 IN ('sent','delivered') THEN COALESCE(sent_at,NOW()) ELSE sent_at END,
           delivered_at=CASE WHEN $2='delivered' THEN COALESCE(delivered_at,NOW()) ELSE delivered_at END
       WHERE id=$1`,
      [id, nextStatus, providerMessageId ? String(providerMessageId).slice(0,200) : null,
       error ? String(error).slice(0,1000) : null]
    );
  } catch (updateError) {
    console.warn("[Notification History] Could not update delivery log:", updateError.message);
  }
}

async function markDeliveredByProviderMessageId(messageId) {
  const id = String(messageId || "").trim().slice(0,200);
  if (!id) return;
  try {
    await ensureTable();
    await db.query("UPDATE notification_delivery_logs SET status='delivered', delivered_at=COALESCE(delivered_at,NOW()), sent_at=COALESCE(sent_at,NOW()) WHERE channel='whatsapp' AND provider_message_id=$1 AND status IN ('pending','sent')", [id]);
  } catch (error) {
    console.warn("[Notification History] Could not record WhatsApp delivery acknowledgement:", error.message);
  }
}

async function list({channel = "all", provider = "all", status = "all", search = "", limit = 100, offset = 0} = {}) {
  await ensureTable();
  const params = [];
  const where = [];
  if (channel !== "all") { params.push(channel); where.push("channel=$" + params.length); }
  if (provider !== "all") { params.push(provider); where.push("provider=$" + params.length); }
  if (status !== "all") { params.push(status); where.push("status=$" + params.length); }
  const term = String(search || "").trim().slice(0,160);
  if (term) {
    params.push("%" + term + "%");
    const p = "$" + params.length;
    where.push("(recipient ILIKE " + p + " OR COALESCE(transaction_id,'') ILIKE " + p + " OR message_body ILIKE " + p + " OR COALESCE(provider_message_id,'') ILIKE " + p + ")");
  }
  const whereSql = where.length ? "WHERE " + where.join(" AND ") : "";
  params.push(Math.max(1, Math.min(500, Number.parseInt(limit,10) || 100)));
  const limitParam = "$" + params.length;
  params.push(Math.max(0, Number.parseInt(offset,10) || 0));
  const offsetParam = "$" + params.length;
  const result = await db.query(
    `SELECT id,channel,provider,recipient,message_body,status,transaction_id,provider_message_id,error_message,created_at,sent_at,delivered_at
     FROM notification_delivery_logs ${whereSql}
     ORDER BY created_at DESC,id DESC LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params
  );
  const countParams = params.slice(0, params.length - 2);
  const countResult = await db.query(
    `SELECT COUNT(*)::int AS total FROM notification_delivery_logs ${whereSql}`,
    countParams
  );
  const providerResult = await db.query("SELECT DISTINCT provider FROM notification_delivery_logs ORDER BY provider");
  return {items: result.rows || [], total: Number(countResult.rows?.[0]?.total || 0), providers: (providerResult.rows || []).map(row => row.provider)};
}

module.exports = { ensureTable, providerLabel, createAttempt, finishAttempt, markDeliveredByProviderMessageId, list };
