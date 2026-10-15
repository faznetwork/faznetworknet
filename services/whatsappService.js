"use strict";

const db = require("../db");

let socket = null;
let qrDataUrl = null;
let qrText = null;
let connection = "disconnected";
let lastError = null;
let connectPromise = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let authConfigured = false;
let reconnectAllowed = true;
const tableReadyByDatabase = new WeakMap();

function getBaileys() {
  return require("@whiskeysockets/baileys");
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00880")) digits = digits.slice(2);
  if (digits.startsWith("01") && digits.length === 11) digits = "88" + digits;
  if (digits.startsWith("1") && digits.length === 10) digits = "880" + digits;
  if (!/^8801\d{9}$/.test(digits)) {
    throw new Error("Enter a valid Bangladesh mobile number (01XXXXXXXXX or 8801XXXXXXXXX).");
  }
  return digits;
}

async function ensureSessionTable(database = db) {
  let ready = tableReadyByDatabase.get(database);
  if (!ready) {
    ready = database.query(
      `CREATE TABLE IF NOT EXISTS whatsapp_sessions (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    ).catch(error => {
      tableReadyByDatabase.delete(database);
      throw error;
    });
    tableReadyByDatabase.set(database, ready);
  }
  return ready;
}

function deserialize(value, BufferJSON) {
  if (value === null || value === undefined) return value;
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return JSON.parse(serialized, BufferJSON.reviver);
}

function serialize(value, BufferJSON) {
  return JSON.stringify(value, BufferJSON.replacer);
}

/**
 * PostgreSQL-backed Baileys AuthenticationState.
 * Each credential/key record is independently upserted, so restarts do not
 * depend on Render's ephemeral filesystem.
 */
async function createDatabaseAuthState(options = {}) {
  const database = options.database || db;
  const baileys = options.baileys || getBaileys();
  const BufferJSON = baileys.BufferJSON;
  if (!BufferJSON || typeof baileys.initAuthCreds !== "function") {
    throw new Error("Baileys auth serialization helpers are unavailable.");
  }

  await ensureSessionTable(database);
  const credsResult = await database.query(
    "SELECT value FROM whatsapp_sessions WHERE key = $1 LIMIT 1",
    ["creds"]
  );
  const storedCreds = credsResult.rows && credsResult.rows[0] ? credsResult.rows[0].value : null;
  const creds = storedCreds ? deserialize(storedCreds, BufferJSON) : baileys.initAuthCreds();

  const keys = {
    async get(type, ids) {
      if (!Array.isArray(ids) || ids.length === 0) return {};
      const names = ids.map(id => "key:" + type + ":" + id);
      const result = await database.query(
        "SELECT key, value FROM whatsapp_sessions WHERE key = ANY($1::varchar[])",
        [names]
      );
      const byName = new Map((result.rows || []).map(row => [row.key, row.value]));
      const output = {};
      for (let index = 0; index < ids.length; index += 1) {
        const raw = byName.get(names[index]);
        if (raw === undefined || raw === null) continue;
        let value = deserialize(raw, BufferJSON);
        if (type === "app-state-sync-key" && value && baileys.proto?.Message?.AppStateSyncKeyData) {
          value = baileys.proto.Message.AppStateSyncKeyData.fromObject(value);
        }
        output[ids[index]] = value;
      }
      return output;
    },
    async set(data) {
      const entries = [];
      const removals = [];
      for (const [type, records] of Object.entries(data || {})) {
        for (const [id, value] of Object.entries(records || {})) {
          const key = "key:" + type + ":" + id;
          if (value === null || value === undefined) removals.push(key);
          else entries.push({ key, value: serialize(value, BufferJSON) });
        }
      }
      for (const key of removals) {
        await database.query("DELETE FROM whatsapp_sessions WHERE key = $1", [key]);
      }
      for (const entry of entries) {
        await database.query(
          `INSERT INTO whatsapp_sessions(key, value, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [entry.key, entry.value]
        );
      }
    }
  };

  return {
    state: { creds, keys },
    saveCreds: async () => {
      await database.query(
        `INSERT INTO whatsapp_sessions(key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        ["creds", serialize(creds, BufferJSON)]
      );
      authConfigured = Boolean(creds.registered);
    }
  };
}

async function hasRegisteredSession() {
  const baileys = getBaileys();
  await ensureSessionTable();
  const result = await db.query(
    "SELECT value FROM whatsapp_sessions WHERE key = $1 LIMIT 1",
    ["creds"]
  );
  const row = result.rows && result.rows[0];
  if (!row) return false;
  const creds = deserialize(row.value, baileys.BufferJSON);
  authConfigured = Boolean(creds && creds.registered);
  return authConfigured;
}

function scheduleReconnect() {
  if (!reconnectAllowed || reconnectTimer || connection === "connected") return;
  const delay = Math.min(30000, 1000 * (2 ** Math.min(reconnectAttempt, 5)));
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect().catch(error => {
      lastError = String(error.message || error);
      scheduleReconnect();
    });
  }, delay);
  if (typeof reconnectTimer.unref === "function") reconnectTimer.unref();
}

async function connect() {
  if (connection === "connected" && socket) return getStatus();
  if (connectPromise) return connectPromise;
  reconnectAllowed = true;
  connectPromise = (async () => {
    let baileys;
    let qrcode;
    let pino;
    try {
      baileys = getBaileys();
      qrcode = require("qrcode");
      pino = require("pino");
    } catch (_) {
      throw new Error("WhatsApp linking dependencies are unavailable. Install @whiskeysockets/baileys, qrcode, and pino, then restart the app.");
    }
    const makeWASocket = baileys.default || baileys.makeWASocket;
    if (typeof makeWASocket !== "function") {
      throw new Error("WhatsApp gateway could not load its socket implementation.");
    }

    const { state, saveCreds } = await createDatabaseAuthState({ database: db, baileys });
    authConfigured = Boolean(state.creds && state.creds.registered);
    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: "silent" }),
      browser: ["FAZ NETWORK", "Chrome", "1.0.0"]
    });
    connection = "connecting";
    lastError = null;
    qrDataUrl = null;
    qrText = null;

    socket.ev.on("creds.update", () => {
      saveCreds().catch(error => {
        lastError = "Could not persist WhatsApp credentials to PostgreSQL.";
        console.error("[WhatsApp] Credential persistence failed:", error.message);
      });
    });
    socket.ev.on("connection.update", async update => {
      if (update.qr) {
        qrText = update.qr;
        try {
          qrDataUrl = await qrcode.toDataURL(update.qr, { margin: 2, width: 280 });
        } catch (error) {
          lastError = "QR generation failed.";
        }
      }
      if (update.connection === "open") {
        connection = "connected";
        reconnectAttempt = 0;
        qrDataUrl = null;
        qrText = null;
        lastError = null;
      }
      if (update.connection === "connecting") connection = "connecting";
      if (update.connection === "close") {
        const closedSocket = socket;
        socket = null;
        connection = "disconnected";
        const code = update.lastDisconnect?.error?.output?.statusCode;
        if (code === baileys.DisconnectReason?.loggedOut) {
          lastError = "WhatsApp session logged out. Link the device again.";
          authConfigured = false;
          await clearStoredAuth().catch(error => console.error("[WhatsApp] Could not clear logged-out credentials:", error.message));
        } else {
          lastError = "WhatsApp connection closed; reconnecting automatically.";
          if (reconnectAllowed) scheduleReconnect();
        }
        try { closedSocket?.end?.(undefined); } catch (_) {}
      }
    });
    return getStatus();
  })().catch(error => {
    lastError = String(error.message || error);
    connection = "error";
    throw error;
  }).finally(() => {
    connectPromise = null;
  });
  return connectPromise;
}

async function restoreSession() {
  try {
    const registered = await hasRegisteredSession();
    if (!registered) {
      console.log("[WhatsApp] No registered PostgreSQL session to restore.");
      return { restored: false, reason: "no_saved_session" };
    }
    console.log("[WhatsApp] Restoring saved session from PostgreSQL.");
    const status = await connect();
    return { restored: true, status };
  } catch (error) {
    lastError = String(error.message || error);
    console.warn("[WhatsApp] Automatic session restore failed:", lastError);
    return { restored: false, error: lastError };
  }
}

function getStatus() {
  return {
    connection,
    connected: connection === "connected",
    qrDataUrl,
    qrText: Boolean(qrText),
    lastError,
    authConfigured
  };
}

async function sendMessage({ to, message } = {}) {
  if (!socket || connection !== "connected") {
    throw new Error("WhatsApp is not linked. Open Notification Hub and connect the WhatsApp device first.");
  }
  const digits = normalizePhone(to);
  const result = await socket.sendMessage(digits + "@s.whatsapp.net", {
    text: String(message || "").slice(0, 4000)
  });
  return { success: true, messageId: result?.key?.id || null };
}

async function clearStoredAuth() {
  await ensureSessionTable();
  await db.query("DELETE FROM whatsapp_sessions");
}

async function unlink() {
  reconnectAllowed = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  try {
    if (socket) {
      const current = socket;
      socket = null;
      current.end(undefined);
    }
  } catch (_) {}
  connection = "disconnected";
  qrDataUrl = null;
  qrText = null;
  lastError = null;
  authConfigured = false;
  reconnectAttempt = 0;
  await clearStoredAuth();
  return getStatus();
}

module.exports = {
  connect,
  restoreSession,
  getStatus,
  sendMessage,
  unlink,
  normalizePhone,
  createDatabaseAuthState
};
