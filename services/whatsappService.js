"use strict";

const crypto = require("crypto");
const db = require("../db");

let socket = null;
let activeCreds = null;
let qrDataUrl = null;
let qrText = null;
let connection = "disconnected";
let lastError = null;
let connectPromise = null;
let reconnectTimer = null;
let reconnectAttempt = 0;
let authConfigured = false;
let reconnectAllowed = true;
let accountMetadata = null;
let socketOwner = false;
let socketOwnerToken = null;
let socketHeartbeatTimer = null;
let freshQrResetPending = false;
const SOCKET_LEASE_KEY = 20261017;
const SOCKET_LOCK_STALE_MS = 90_000;
const SOCKET_HEARTBEAT_MS = 20_000;
const RESTORE_RETRY_DELAYS = [500, 1500];
const INITIAL_HANDSHAKE_GRACE_MS = 15000;
let handshakeGraceTimer = null;
const tableReadyByDatabase = new WeakMap();

function getBaileys() {
  return require("@whiskeysockets/baileys");
}

function normalizePhone(value) {
  let digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("00880")) digits = digits.slice(2);
  if (digits.startsWith("01") && digits.length === 11) digits = "88" + digits;
  if (digits.startsWith("1") && digits.length === 10) digits = "880" + digits;
  if (!/^8801[3-9]\d{8}$/.test(digits)) {
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
 * PostgreSQL-backed Baileys AuthenticationState. Credential writes are queued
 * in event order and Signal-key batches commit atomically.
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
  let credentialWriteQueue = Promise.resolve();

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
      const persistBatch = async transaction => {
        for (const key of removals) {
          await transaction.query("DELETE FROM whatsapp_sessions WHERE key = $1", [key]);
        }
        for (const entry of entries) {
          await transaction.query(
            `INSERT INTO whatsapp_sessions(key, value, updated_at)
             VALUES ($1, $2::jsonb, NOW())
             ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
            [entry.key, entry.value]
          );
        }
      };
      if (typeof database.withTransaction === "function") {
        await database.withTransaction(persistBatch);
        return;
      }
      await database.query("BEGIN");
      try {
        await persistBatch(database);
        await database.query("COMMIT");
      } catch (error) {
        try { await database.query("ROLLBACK"); } catch (_) {}
        throw error;
      }
    }
  };

  const saveCreds = () => {
    // Snapshot inside the queue, not before it: a queued callback must never
    // persist an older credential state after a newer creds.update event.
    const write = credentialWriteQueue.then(async () => {
      const snapshot = serialize(creds, BufferJSON);
      await database.query(
        `INSERT INTO whatsapp_sessions(key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        ["creds", snapshot]
      );
      authConfigured = creds.registered === true;
    });
    credentialWriteQueue = write.catch(() => {});
    return write;
  };

  return { state: { creds, keys }, saveCreds };
}

function extractConnectedAccount(user, linkedSince = new Date().toISOString()) {
  const rawId = String(user?.id || user?.jid || "");
  const jidUser = rawId.split(":")[0].split("@")[0];
  const digits = jidUser.replace(/\D/g, "");
  let phone = null;
  try {
    if (digits) phone = "+" + normalizePhone(digits);
  } catch (_) {}
  const name = String(user?.name || user?.verifiedName || "").trim() || null;
  return { phone, name, linkedSince };
}

async function loadConnectedAccount() {
  await ensureSessionTable();
  const result = await db.query("SELECT value FROM whatsapp_sessions WHERE key = $1 LIMIT 1", ["metadata"]);
  const value = result.rows && result.rows[0] ? result.rows[0].value : null;
  if (value && typeof value === "object" && !Array.isArray(value)) accountMetadata = value;
  else if (typeof value === "string") {
    try { accountMetadata = JSON.parse(value); } catch (_) { accountMetadata = null; }
  }
  return accountMetadata;
}

async function persistConnectedAccount(user) {
  const extracted = extractConnectedAccount(user);
  if (!extracted.phone) {
    console.warn("[WhatsApp] Connected, but the socket did not expose a valid phone JID.");
    return accountMetadata;
  }
  let previous = accountMetadata;
  if (!previous) {
    try { previous = await loadConnectedAccount(); } catch (_) {}
  }
  const linkedSince = previous?.phone === extracted.phone && previous?.linkedSince
    ? previous.linkedSince
    : new Date().toISOString();
  accountMetadata = { ...extracted, linkedSince };
  await ensureSessionTable();
  await db.query(
    `INSERT INTO whatsapp_sessions(key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    ["metadata", JSON.stringify(accountMetadata)]
  );
  return accountMetadata;
}

async function inspectStoredSession() {
  const baileys = getBaileys();
  await ensureSessionTable();
  await loadConnectedAccount();
  const result = await db.query(
    "SELECT value FROM whatsapp_sessions WHERE key = $1 LIMIT 1",
    ["creds"]
  );
  const row = result.rows && result.rows[0];
  if (!row) {
    authConfigured = false;
    return { registered: false, reason: "missing_creds" };
  }
  const creds = deserialize(row.value, baileys.BufferJSON);
  authConfigured = Boolean(creds && creds.registered);
  return authConfigured
    ? { registered: true, reason: "registered" }
    : { registered: false, reason: "unlinked" };
}

/** Remove only stale auth material after confirming the stored creds are not registered.
 * Linked-account metadata and any registered session are never touched here.
 */
async function resetUnregisteredAuthRows(database = db, baileys = getBaileys()) {
  await ensureSessionTable(database);
  const result = await database.query(
    "SELECT value FROM whatsapp_sessions WHERE key = $1 LIMIT 1",
    ["creds"]
  );
  const raw = result.rows?.[0]?.value;
  const stored = raw ? deserialize(raw, baileys.BufferJSON) : null;
  if (stored?.registered === true) {
    return { reset: false, reason: "registered" };
  }
  const purge = async tx => {
    await tx.query("DELETE FROM whatsapp_sessions WHERE key = $1 OR key LIKE $2", ["creds", "key:%"]);
  };
  if (typeof database.withTransaction === "function") await database.withTransaction(purge);
  else {
    await database.query("BEGIN");
    try { await purge(database); await database.query("COMMIT"); }
    catch (error) { try { await database.query("ROLLBACK"); } catch (_) {} throw error; }
  }
  activeCreds = null;
  authConfigured = false;
  return { reset: true, reason: raw ? "unregistered" : "missing_creds" };
}

// A registered session that WhatsApp revoked server-side can never emit a QR
// code: Baileys retries the dead credentials instead of pairing. Clear the
// dead rows (creds, Signal keys, and linked-account metadata) so the next
// pairing starts clean. Only called when WhatsApp itself already reported the
// session logged out, or the user explicitly unlinks the device.
async function resetRegisteredAuthRows(database = db) {
  await ensureSessionTable(database);
  const purge = async tx => {
    await tx.query("DELETE FROM whatsapp_sessions WHERE key = $1 OR key LIKE $2", ["creds", "key:%"]);
    await tx.query("DELETE FROM whatsapp_sessions WHERE key = $1", ["metadata"]);
  };
  if (typeof database.withTransaction === "function") await database.withTransaction(purge);
  else {
    await database.query("BEGIN");
    try { await purge(database); await database.query("COMMIT"); }
    catch (error) { try { await database.query("ROLLBACK"); } catch (_) {} throw error; }
  }
  activeCreds = null;
  authConfigured = false;
  accountMetadata = null;
  return { reset: true, reason: "registered_revoked" };
}

async function ensureSocketLeaseTable(database = db) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_socket_lease (
      lock_key BIGINT PRIMARY KEY,
      owner_pid INTEGER NOT NULL,
      heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  // owner_token identifies one acquire. It is the ONLY ownership identity:
  // never use pg_backend_pid() to match a heartbeat or a release, because
  // under Supavisor transaction pooling the backend behind a query can
  // differ per query.
  await database.query("ALTER TABLE whatsapp_socket_lease ADD COLUMN IF NOT EXISTS owner_token TEXT");
}

// Heartbeat runs on the ordinary pool: a failed heartbeat (DB blip, DNS
// outage) only logs a warning and never ends the socket — the socket stays
// connected to WhatsApp and the lease simply goes stale after 90s, letting
// the other instance take over cleanly. But a heartbeat that matches zero
// rows means the lease was taken by another owner: stop this socket instead
// of connecting again and getting kicked (connectionReplaced) in a loop.
async function heartbeatSocketLease(database = db) {
  try {
    if (!socketOwnerToken) return;
    const result = await database.query(
      "UPDATE whatsapp_socket_lease SET heartbeat_at=NOW() WHERE lock_key=$1 AND owner_token=$2",
      [SOCKET_LEASE_KEY, socketOwnerToken]
    );
    if (result && result.rowCount === 0) {
      console.warn("[WhatsApp] Socket lease lost to another instance; stopping this socket.");
      socketOwner = false;
      socketOwnerToken = null;
      if (socketHeartbeatTimer) { clearInterval(socketHeartbeatTimer); socketHeartbeatTimer = null; }
      const activeSocket = socket;
      socket = null;
      if (activeSocket) { try { activeSocket.end(undefined); } catch (_) {} }
      connection = "disconnected";
      lastError = "WhatsApp socket ownership moved to another instance; reconnecting only when the lease is free.";
      scheduleReconnect();
    }
  } catch (error) {
    console.warn("[WhatsApp] Ownership heartbeat failed:", error.message);
  }
}

async function acquireSocketOwnership(databaseOverride) {
  // Single-owner gate for the WhatsApp socket. The exclusion primitive is ONE
  // atomic lease-row statement — never a session-level advisory lock, and
  // never an in-memory flag on its own. Why: this app connects through the
  // Supabase pooler (Supavisor, transaction mode), where the backend behind
  // a client can be recycled silently. A session-level advisory lock then
  // vanishes without any error, while this process still believes it owns
  // the socket — and the other instance (Render) believes the same. Both
  // connect with the same PostgreSQL-backed creds, WhatsApp allows only one
  // live session, so each side is kicked with connectionReplaced (440) and
  // reconnects ~4 seconds later: thousands of reconnects, panel showing
  // "unlinked" again and again. The lease row is a plain table row, so it
  // survives pooling, and the INSERT ... ON CONFLICT ... WHERE stale below
  // is atomic: exactly one instance can hold a fresh lease at a time.
  const database = databaseOverride || db;
  // Re-validate on every call: a fresh lease row carrying our own token is
  // the only proof we still own the socket.
  if (socketOwner && socketOwnerToken) {
    const held = await database.query(
      "SELECT owner_token, (EXTRACT(EPOCH FROM (NOW()-heartbeat_at))*1000)::bigint AS age_ms FROM whatsapp_socket_lease WHERE lock_key=$1",
      [SOCKET_LEASE_KEY]
    );
    const row = held.rows?.[0];
    if (row && row.owner_token === socketOwnerToken && Number(row.age_ms) <= SOCKET_LOCK_STALE_MS) return;
    // Our lease is gone or stale: fall through and re-acquire cleanly instead
    // of connecting on a stale belief of ownership.
    socketOwner = false;
    socketOwnerToken = null;
    if (socketHeartbeatTimer) { clearInterval(socketHeartbeatTimer); socketHeartbeatTimer = null; }
  }
  await ensureSocketLeaseTable(database);
  const token = crypto.randomUUID();
  const claimed = await database.query(
    `INSERT INTO whatsapp_socket_lease(lock_key, owner_pid, owner_token, heartbeat_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT(lock_key) DO UPDATE SET owner_pid=EXCLUDED.owner_pid, owner_token=EXCLUDED.owner_token, heartbeat_at=NOW()
     WHERE whatsapp_socket_lease.heartbeat_at < NOW() - INTERVAL '90 seconds'
     RETURNING owner_token`,
    [SOCKET_LEASE_KEY, process.pid, token]
  );
  if (claimed.rows?.[0]?.owner_token !== token) {
    const error = new Error("WhatsApp socket is owned by another application instance.");
    error.code = "WHATSAPP_SOCKET_OWNED_ELSEWHERE";
    throw error;
  }
  socketOwner = true;
  socketOwnerToken = token;
  if (socketHeartbeatTimer) clearInterval(socketHeartbeatTimer);
  socketHeartbeatTimer = setInterval(() => { heartbeatSocketLease(database); }, SOCKET_HEARTBEAT_MS);
  if (typeof socketHeartbeatTimer.unref === "function") socketHeartbeatTimer.unref();
}

async function releaseSocketOwnership(database = db) {
  const token = socketOwnerToken;
  socketOwner = false;
  socketOwnerToken = null;
  if (socketHeartbeatTimer) { clearInterval(socketHeartbeatTimer); socketHeartbeatTimer = null; }
  if (!token) return;
  try {
    await database.query("DELETE FROM whatsapp_socket_lease WHERE lock_key=$1 AND owner_token=$2", [SOCKET_LEASE_KEY, token]);
  } catch (_) {}
}

async function shutdown() {
  reconnectAllowed = false;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (handshakeGraceTimer) { clearTimeout(handshakeGraceTimer); handshakeGraceTimer = null; }
  const activeSocket = socket;
  socket = null;
  if (activeSocket) { try { activeSocket.end(undefined); } catch (_) {} }
  connection = "disconnected";
  await releaseSocketOwnership();
}

async function handleConnectionClose(update, baileys, closedSocket) {
  if (socket === closedSocket) socket = null;
  const code = update?.lastDisconnect?.error?.output?.statusCode;
  // Log EVERY close with its reason. The old code logged nothing for
  // non-loggedOut closes, so a connectionReplaced (440) storm — another
  // instance connecting with the same creds — was invisible in the logs
  // and looked like the session "unlinking itself" over and over.
  const reasonEntries = Object.entries(baileys.DisconnectReason || {});
  const reasonNames = reasonEntries.filter(([, value]) => value === code).map(([name]) => name);
  const reason = reasonNames.length > 0 ? reasonNames.join("/") : `unknown(${code ?? "n/a"})`;
  console.warn(`[WhatsApp] Connection closed: ${reason} (statusCode ${code ?? "n/a"}).`);
  if (code === baileys.DisconnectReason?.loggedOut && reconnectAllowed) {
    connection = "reconnect_required";
    lastError = "WhatsApp session was logged out remotely. PostgreSQL auth rows were preserved; reconnect or explicitly unlink from Notification Hub.";
    authConfigured = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    console.warn("[WhatsApp] Session requires re-linking; preserving PostgreSQL auth rows.");
    if (freshQrResetPending) {
      // A fresh-QR request was waiting on exactly this verdict: the stored
      // session is dead, so clear it and pair fresh instead of retrying it.
      // The scheduled reconnect then starts a clean pairing and emits a QR.
      freshQrResetPending = false;
      try {
        await resetRegisteredAuthRows(db);
        console.log("[WhatsApp] Logged-out session cleared for the pending fresh-QR request; starting a clean pairing.");
      } catch (error) {
        console.warn("[WhatsApp] Could not clear revoked auth rows:", error.message);
      }
      reconnectAttempt = 0;
      scheduleReconnect();
    }
  } else if (!reconnectAllowed) {
    connection = "disconnected";
  } else {
    connection = "disconnected";
    lastError = "WhatsApp connection closed; reconnecting automatically.";
    scheduleReconnect();
  }
  try { closedSocket?.end?.(undefined); } catch (_) {}
  return getStatus();
}

// Baileys can reject an internal passive-IQ promise with a transient 408 timeout
// after the socket has otherwise connected. On Node versions that treat unhandled
// rejections as fatal, contain only this known transport timeout and reconnect;
// unrelated unhandled rejections retain Node's normal fatal behavior.
const handledBaileysTimeouts = new WeakSet();
process.on("unhandledRejection", (reason) => {
  const message = String(reason?.message || reason || "");
  const stack = String(reason?.stack || "");
  const statusCode = Number(reason?.output?.statusCode || reason?.data?.statusCode || 0);
  const isBaileysTimeout = /Timed Out|Request Time-out/i.test(message)
    && stack.includes("@whiskeysockets/baileys/lib/Utils/generics.js")
    && (statusCode === 408 || /statusCode: 408/.test(stack));
  if (!isBaileysTimeout || (reason && typeof reason === "object" && handledBaileysTimeouts.has(reason))) return;
  if (reason && typeof reason === "object") handledBaileysTimeouts.add(reason);
  lastError = "WhatsApp transport timed out; reconnecting without stopping the API server.";
  console.warn("[WhatsApp] Contained transient Baileys 408 timeout; scheduling reconnect.");
  if (connection === "connected" || connection === "connecting") connection = "disconnected";
  scheduleReconnect();
});

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

async function connect(options = {}) {
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

    // A previous QR attempt can leave an open-but-unregistered socket behind.
    // Replace that socket before creating a fresh QR; never create parallel sockets
    // against the same PostgreSQL auth state. Do NOT release the lease here:
    // acquireSocketOwnership re-validates it, and deleting our fresh lease
    // row would hand the socket to the other instance mid-reconnect.
    if (socket && connection !== "connected") {
      const staleSocket = socket;
      socket = null;
      try { staleSocket.end(undefined); } catch (_) {}
      qrDataUrl = null;
      qrText = null;
      connection = "disconnected";
    }

    if (options.freshQr === true) {
      // Manual pairing is a clean path only for unregistered/missing credentials.
      // Registered sessions are preserved and must reconnect silently — unless
      // WhatsApp already reported this session logged out, in which case the
      // stored creds are dead and can never emit a QR code. Clear them and
      // pair fresh; otherwise arm a reset if this attempt is then reported
      // logged out, so one Connect click still ends with a QR code.
      const reset = await resetUnregisteredAuthRows(db, baileys);
      if (reset.reason === "registered") {
        const sessionKnownDead = connection === "reconnect_required" || /logged out/i.test(String(lastError || ""));
        if (sessionKnownDead) {
          await resetRegisteredAuthRows(db);
          console.log("[WhatsApp] Fresh-QR request found a revoked registered session; cleared dead auth rows for a clean pairing.");
          if (socket) { try { socket.end(undefined); } catch (_) {} socket = null; }
          activeCreds = null;
          qrDataUrl = null;
          qrText = null;
          connection = "disconnected";
        } else {
          freshQrResetPending = true;
          console.log("[WhatsApp] Fresh-QR request found registered credentials; preserving auth and restoring existing session.");
        }
      } else {
        freshQrResetPending = false;
        console.log("[WhatsApp] Fresh pairing auth reset:", reset.reason);
        if (socket) { try { socket.end(undefined); } catch (_) {} socket = null; }
        activeCreds = null;
        qrDataUrl = null;
        qrText = null;
        connection = "disconnected";
      }
    }

    await acquireSocketOwnership();
    const { state, saveCreds } = await createDatabaseAuthState({ database: db, baileys });
    activeCreds = state.creds;
    authConfigured = state.creds?.registered === true;
    socket = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      keepAliveIntervalMs: 20000,
      logger: pino({ level: "silent" }),
      browser: ["FAZ NETWORK", "Chrome", "1.0.0"]
    });
    const socketForEvents = socket;
    connection = "connecting";
    lastError = null;
    qrDataUrl = null;
    qrText = null;

    socketForEvents.ev.on("creds.update", () => {
      saveCreds().catch(error => {
        lastError = "Could not persist WhatsApp credentials to PostgreSQL.";
        console.error("[WhatsApp] Credential persistence failed:", error.message);
      });
    });
    socketForEvents.ev.on("connection.update", async update => {
      // Ignore delayed events from a socket that has already been replaced.
      if (socket !== socketForEvents) return;
      if (update.qr && connection !== "connected") {
        qrText = update.qr;
        try {
          qrDataUrl = await qrcode.toDataURL(update.qr, { margin: 2, width: 280 });
        } catch (error) {
          lastError = "QR generation failed.";
        }
      }
      if (update.connection === "open") {
        reconnectAttempt = 0;
        lastError = null;
        // A successful QR scan can emit creds.update and connection.update in
        // quick succession. Do not assert registration until the initial
        // post-scan credential/key flush has had a 10-second grace window.
        qrDataUrl = null;
        qrText = null;
        const connectedSocket = socketForEvents;
        console.log("[WhatsApp] Handshake open! Connected as:", connectedSocket.user?.id || "(user not populated yet)");

        if (handshakeGraceTimer) {
          clearTimeout(handshakeGraceTimer);
          handshakeGraceTimer = null;
        }

        // A populated Baileys user is authoritative evidence that pairing
        // succeeded. Mark the in-memory auth state registered and synchronously
        // flush the credential snapshot before reporting the device as linked.
        if (connectedSocket.user) {
          state.creds.registered = true;
          try {
            await saveCreds();
            authConfigured = true;
            connection = "connected";
            lastError = null;
            try {
              await persistConnectedAccount(connectedSocket.user);
            } catch (error) {
              console.warn("[WhatsApp] Could not persist connected account metadata:", error.message);
            }
          } catch (error) {
            lastError = "WhatsApp opened, but credential persistence to PostgreSQL failed.";
            connection = "error";
            authConfigured = false;
            console.error("[WhatsApp] Final credential persistence failed:", error.message);
          }
        } else {
          // Keep the handshake alive while Baileys finishes populating user and
          // registration fields. The timer performs strict checks only after
          // the initial post-scan grace period; it does not close the socket.
          connection = "connecting";
          handshakeGraceTimer = setTimeout(async () => {
            handshakeGraceTimer = null;
            if (socket !== connectedSocket || connection === "connected") return;
            if (connectedSocket.user) {
              state.creds.registered = true;
              try {
                await saveCreds();
                authConfigured = true;
                connection = "connected";
                lastError = null;
                try { await persistConnectedAccount(connectedSocket.user); }
                catch (error) {
                  console.warn("[WhatsApp] Could not persist connected account metadata:", error.message);
                }
                return;
              } catch (error) {
                lastError = "WhatsApp opened, but credential persistence to PostgreSQL failed.";
                connection = "error";
                authConfigured = false;
                console.error("[WhatsApp] Grace-period credential persistence failed:", error.message);
                return;
              }
            }
            connection = "reconnect_required";
            lastError = "WhatsApp handshake did not expose a registered user within 15 seconds. Re-link this device using the QR code.";
            console.warn("[WhatsApp] Registration assertion failed after the 15-second initial handshake grace period.");
          }, INITIAL_HANDSHAKE_GRACE_MS);
          if (typeof handshakeGraceTimer.unref === "function") handshakeGraceTimer.unref();
        }
      }
      if (update.connection === "connecting") connection = "connecting";
      if (update.connection === "close") {
        const closedSocket = socket;
        await handleConnectionClose(update, baileys, closedSocket);
      }
    });
    return getStatus();
  })().catch(async error => {
    lastError = String(error.message || error);
    const ownershipConflict = error.code === "WHATSAPP_SOCKET_OWNED_ELSEWHERE";
    connection = ownershipConflict ? "owned_elsewhere" : "error";
    if (!socket) await releaseSocketOwnership();
    // The lease row is the only exclusion primitive now: if another instance
    // holds a fresh lease, retry after a conflict — but never terminate an
    // unknown backend or erase auth rows. The current owner may still be healthy.
    if (ownershipConflict) scheduleReconnect();
    throw error;
  }).finally(() => {
    connectPromise = null;
  });
  return connectPromise;
}

async function restoreSession() {
  const ownershipRetryDelays = [1000, 3000, 10000];
  for (let attempt = 0; attempt <= Math.max(RESTORE_RETRY_DELAYS.length, ownershipRetryDelays.length); attempt += 1) {
    try {
      const stored = await inspectStoredSession();
      if (stored.reason === "missing_creds") {
        console.log("[WhatsApp] PostgreSQL session restore skipped: credentials row is missing.");
        return { restored: false, reason: "missing_creds" };
      }
      if (stored.reason === "unlinked") {
        console.log("[WhatsApp] PostgreSQL credentials exist but are not registered; rows are preserved and manual linking may be required.");
        return { restored: false, reason: "unlinked" };
      }
      console.log("[WhatsApp] Restoring registered session from PostgreSQL.");
      const status = await connect();
      return { restored: true, status };
    } catch (error) {
      lastError = String(error.message || error);
      const ownershipConflict = error.code === "WHATSAPP_SOCKET_OWNED_ELSEWHERE";
      const retryDelays = ownershipConflict ? ownershipRetryDelays : RESTORE_RETRY_DELAYS;
      if (attempt < retryDelays.length) {
        const delay = retryDelays[attempt];
        console.warn(
          ownershipConflict
            ? "[WhatsApp] Another instance currently owns the socket; retrying ownership acquisition."
            : "[WhatsApp] Session restore attempt failed; retrying after transient startup delay.",
          { attempt: attempt + 1, nextDelayMs: delay, error: lastError }
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      if (ownershipConflict) {
        scheduleReconnect();
        console.warn("[WhatsApp] Ownership is still held elsewhere; automatic takeover retries remain scheduled.");
        return { restored: false, reason: "owned_elsewhere", retryScheduled: true };
      }
      console.warn("[WhatsApp] Automatic session restore failed after bounded retries:", lastError);
      return { restored: false, error: lastError };
    }
  }
  return { restored: false, reason: "restore_attempts_exhausted" };
}

function isSocketReady(sock, creds, state = connection) {
  return Boolean(state === "connected" && sock && sock.user && creds?.registered === true);
}

function getStatus() {
  const live = isSocketReady(socket, activeCreds);
  const reportedConnection = live ? "connected" : (connection === "connected" ? "reconnect_required" : connection);
  const user = socket?.user ? { id: socket.user.id || null, name: socket.user.name || null } : null;
  const status = live ? "connected" : (reportedConnection === "connecting" ? "connecting" : "disconnected");
  return {
    connection: reportedConnection,
    connected: live,
    status,
    isLinked: Boolean(live),
    user,
    hasQr: Boolean(qrDataUrl),
    qrDataUrl,
    qrText: Boolean(qrText),
    lastError,
    authConfigured,
    account: accountMetadata ? { ...accountMetadata } : null,
    socketStatus: live ? "Active & Ready" : reportedConnection
  };
}

async function getStatusSnapshot() {
  // Always refresh account details from PostgreSQL instead of depending on a
  // prior Connect response held in this process's memory.
  try {
    await loadConnectedAccount();
  } catch (error) {
    console.warn("[WhatsApp] Could not reload linked-account metadata:", error.message);
  }
  return getStatus();
}

function normalizeWhatsAppJid(value) {
  return normalizePhone(value) + "@s.whatsapp.net";
}

async function sendMessage({ to, message, event = "manual", userType = null } = {}) {
  const history = require("./messageHistoryService");
  let result = null, failure = null;
  const body = String(message || "").slice(0, 4000);
  try {
    if (!socket || connection !== "connected") {
      throw new Error("WhatsApp is not linked. Open Notification Hub and connect the WhatsApp device first.");
    }
    const jid = normalizeWhatsAppJid(to);
    result = await socket.sendMessage(jid, { text: body });
    return { success: true, messageId: result?.key?.id || null };
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    await history.recordMessage({
      channel: "whatsapp", to, message: body, event,
      status: failure ? "failed" : "sent",
      error: failure ? String(failure.message || failure) : null,
      gateway: "baileys",
      providerMessageId: result?.key?.id || null, userType
    });
  }
}

async function clearStoredAuth(database = db) {
  await ensureSessionTable(database);
  await database.query("DELETE FROM whatsapp_sessions");
  accountMetadata = null;
}

async function unlink(options = {}) {
  const database = options.database || db;
  reconnectAllowed = false;
  if (handshakeGraceTimer) {
    clearTimeout(handshakeGraceTimer);
    handshakeGraceTimer = null;
  }
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
  await clearStoredAuth(database);
  await releaseSocketOwnership();
  return getStatus();
}

// Render sends SIGTERM during deploys. Close the socket and release the
// lease row before exiting so the replacement instance can connect promptly.
let shutdownSignalHandled = false;
async function handleShutdownSignal(signal) {
  if (shutdownSignalHandled) return;
  shutdownSignalHandled = true;
  console.log("[WhatsApp] Received " + signal + "; releasing socket ownership.");
  try { await shutdown(); }
  catch (error) { console.warn("[WhatsApp] Graceful shutdown cleanup failed:", error.message); }
  process.exit(0);
}
process.once("SIGTERM", () => { handleShutdownSignal("SIGTERM"); });
process.once("SIGINT", () => { handleShutdownSignal("SIGINT"); });

module.exports = {
  connect,
  restoreSession,
  getStatus,
  getStatusSnapshot,
  sendMessage,
  normalizePhone,
  normalizeWhatsAppJid,
  unlink,
  shutdown,
  extractConnectedAccount,
  createDatabaseAuthState,
  _resetUnregisteredAuthRows: resetUnregisteredAuthRows,
  _resetRegisteredAuthRows: resetRegisteredAuthRows,
  _handleConnectionClose: handleConnectionClose,
  _inspectStoredSession: inspectStoredSession,
  _isSocketReady: isSocketReady,
  _acquireSocketOwnership: acquireSocketOwnership,
  _releaseSocketOwnership: releaseSocketOwnership,
  _heartbeatSocketLease: heartbeatSocketLease,
  _shutdown: shutdown
};
