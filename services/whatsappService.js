"use strict";

const db = require("../db");
const deliveryLog = require("./notificationDeliveryLog");

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
let socketLockClient = null;
let socketOwner = false;
let socketHeartbeatTimer = null;
let startupOwnershipResetAttempted = false;
const SOCKET_ADVISORY_LOCK_KEY = 20261017;
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

async function ensureSocketLeaseTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS whatsapp_socket_lease (
      lock_key BIGINT PRIMARY KEY,
      owner_pid INTEGER NOT NULL,
      heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function heartbeatSocketLease(client) {
  try {
    await client.query(
      "UPDATE whatsapp_socket_lease SET heartbeat_at=NOW() WHERE lock_key=$1 AND owner_pid=pg_backend_pid()",
      [SOCKET_ADVISORY_LOCK_KEY]
    );
  } catch (error) {
    console.warn("[WhatsApp] Ownership heartbeat failed:", error.message);
  }
}

// Emergency startup recovery for legacy advisory locks created before lease heartbeats
// existed. This targets only our dedicated WhatsApp advisory-lock key, never auth rows.
async function forceClearLegacySocketLock(client) {
  if (startupOwnershipResetAttempted) return;
  startupOwnershipResetAttempted = true;
  await ensureSocketLeaseTable(client);
  const holders = await client.query(
    `SELECT DISTINCT pid FROM pg_locks
     WHERE locktype='advisory' AND granted=true
       AND classid=0 AND objid=$1::oid AND objsubid=1
       AND pid IS NOT NULL AND pid <> pg_backend_pid()`,
    [SOCKET_ADVISORY_LOCK_KEY]
  );
  for (const row of holders.rows || []) {
    const pid = Number(row.pid);
    if (!Number.isInteger(pid) || pid <= 0) continue;
    console.warn("[WhatsApp] Clearing legacy advisory lock held by previous backend.", { ownerPid: pid });
    await client.query("SELECT pg_terminate_backend($1) WHERE $1 <> pg_backend_pid()", [pid]);
  }
  // A lease row alone is not a lock. Clear only the lease metadata for this
  // dedicated key; preserve whatsapp_sessions and all saved Baileys credentials.
  await client.query("DELETE FROM whatsapp_socket_lease WHERE lock_key=$1", [SOCKET_ADVISORY_LOCK_KEY]);
}

async function acquireSocketOwnership() {
  if (socketLockClient && socketOwner) return;
  const pool = typeof db.getPool === "function" ? db.getPool() : null;
  if (!pool || typeof pool.connect !== "function") return;
  const client = await pool.connect();
  try {
    await forceClearLegacySocketLock(client);
    let result = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [SOCKET_ADVISORY_LOCK_KEY]);
    if (!result.rows?.[0]?.locked) {
      const lease = await client.query(
        "SELECT owner_pid, (EXTRACT(EPOCH FROM (NOW()-heartbeat_at))*1000)::bigint AS age_ms FROM whatsapp_socket_lease WHERE lock_key=$1",
        [SOCKET_ADVISORY_LOCK_KEY]
      );
      const owner = lease.rows?.[0];
      if (owner && Number(owner.age_ms) > SOCKET_LOCK_STALE_MS && Number(owner.owner_pid) !== Number(client.processID)) {
        const oldPid = Number(owner.owner_pid);
        console.warn("[WhatsApp] Stale ownership heartbeat detected; terminating abandoned PostgreSQL lock backend.", { ownerPid: oldPid, staleMs: Number(owner.age_ms) });
        await client.query("SELECT pg_terminate_backend($1) WHERE $1 <> pg_backend_pid()", [oldPid]);
        await client.query("DELETE FROM whatsapp_socket_lease WHERE lock_key=$1 AND owner_pid=$2", [SOCKET_ADVISORY_LOCK_KEY, oldPid]);
        result = await client.query("SELECT pg_try_advisory_lock($1) AS locked", [SOCKET_ADVISORY_LOCK_KEY]);
      }
      if (!result.rows?.[0]?.locked) {
        const error = new Error("WhatsApp socket is owned by another application instance.");
        error.code = "WHATSAPP_SOCKET_OWNED_ELSEWHERE";
        throw error;
      }
    }
    socketLockClient = client;
    socketOwner = true;
    const pidResult = await client.query("SELECT pg_backend_pid() AS pid");
    await client.query(
      `INSERT INTO whatsapp_socket_lease(lock_key, owner_pid, heartbeat_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT(lock_key) DO UPDATE SET owner_pid=EXCLUDED.owner_pid, heartbeat_at=NOW()`,
      [SOCKET_ADVISORY_LOCK_KEY, Number(pidResult.rows[0].pid)]
    );
    if (socketHeartbeatTimer) clearInterval(socketHeartbeatTimer);
    socketHeartbeatTimer = setInterval(() => { heartbeatSocketLease(client); }, SOCKET_HEARTBEAT_MS);
    if (typeof socketHeartbeatTimer.unref === "function") socketHeartbeatTimer.unref();
    if (typeof client.on === "function") {
      client.on("error", error => {
        if (socketLockClient !== client) return;
        socketLockClient = null;
        socketOwner = false;
        if (socketHeartbeatTimer) { clearInterval(socketHeartbeatTimer); socketHeartbeatTimer = null; }
        try { client.release(true); } catch (_) {}
        lastError = "WhatsApp database ownership lock was lost; reconnecting safely.";
        const activeSocket = socket;
        socket = null;
        if (activeSocket) { try { activeSocket.end(undefined); } catch (_) {} }
        connection = "error";
        console.warn("[WhatsApp] Socket ownership lock lost:", error.message);
        scheduleReconnect();
      });
    }
  } catch (error) {
    if (socketLockClient !== client) {
      try { client.release(); } catch (_) {}
    }
    throw error;
  }
}

async function releaseSocketOwnership() {
  const client = socketLockClient;
  socketLockClient = null;
  socketOwner = false;
  if (socketHeartbeatTimer) { clearInterval(socketHeartbeatTimer); socketHeartbeatTimer = null; }
  if (!client) return;
  try { await client.query("DELETE FROM whatsapp_socket_lease WHERE lock_key=$1 AND owner_pid=pg_backend_pid()", [SOCKET_ADVISORY_LOCK_KEY]); } catch (_) {}
  try { await client.query("SELECT pg_advisory_unlock($1)", [SOCKET_ADVISORY_LOCK_KEY]); } catch (_) {}
  try { client.release(); } catch (_) {}
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
  if (code === baileys.DisconnectReason?.loggedOut && reconnectAllowed) {
    connection = "reconnect_required";
    lastError = "WhatsApp session was logged out remotely. PostgreSQL auth rows were preserved; reconnect or explicitly unlink from Notification Hub.";
    authConfigured = false;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    console.warn("[WhatsApp] Session requires re-linking; preserving PostgreSQL auth rows.");
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
    // against the same PostgreSQL auth state.
    if (socket && connection !== "connected") {
      const staleSocket = socket;
      socket = null;
      try { staleSocket.end(undefined); } catch (_) {}
      qrDataUrl = null;
      qrText = null;
      connection = "disconnected";
      await releaseSocketOwnership();
    }

    if (options.freshQr === true) {
      // Manual pairing is a clean path only for unregistered/missing credentials.
      // Registered sessions are preserved and must reconnect silently.
      const reset = await resetUnregisteredAuthRows(db, baileys);
      if (reset.reason === "registered") {
        console.log("[WhatsApp] Fresh-QR request found registered credentials; preserving auth and restoring existing session.");
      } else {
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

    socketForEvents.ev.on("messages.update", updates => {
      if (socket !== socketForEvents || !Array.isArray(updates)) return;
      for (const item of updates) {
        const ack = Number(item?.update?.status);
        if (item?.key?.id && ack >= 3) {
          deliveryLog.markDeliveredByProviderMessageId(item.key.id).catch(() => {});
        }
      }
    });
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
    // PostgreSQL releases a session-level advisory lock when its owning
    // connection dies. Retry after a conflict, but never terminate an unknown
    // backend or erase auth rows: the current owner may still be healthy.
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

async function sendMessage({ to, message, transactionId, variables = {} } = {}) {
  const jid = normalizeWhatsAppJid(to);
  const body = String(message || "").slice(0, 4000);
  const attemptId = await deliveryLog.createAttempt({
    channel: "whatsapp",
    provider: "WhatsApp",
    recipient: String(to || "").slice(0, 40),
    message: body,
    transactionId: transactionId || variables.transaction_id || variables.trx_id || null
  });
  try {
    if (!socket || connection !== "connected") {
      throw new Error("WhatsApp is not linked. Open Notification Hub and connect the WhatsApp device first.");
    }
    const result = await socket.sendMessage(jid, { text: body });
    const messageId = result?.key?.id || null;
    await deliveryLog.finishAttempt(attemptId, { status: "sent", providerMessageId: messageId });
    return { success: true, messageId };
  } catch (error) {
    await deliveryLog.finishAttempt(attemptId, { status: "failed", error: error?.message || error });
    throw error;
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

// Render sends SIGTERM during deploys. Close the socket and release the PostgreSQL
// advisory lock/lease before exiting so the replacement instance can connect promptly.
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
  _handleConnectionClose: handleConnectionClose,
  _inspectStoredSession: inspectStoredSession,
  _isSocketReady: isSocketReady,
  _acquireSocketOwnership: acquireSocketOwnership,
  _releaseSocketOwnership: releaseSocketOwnership,
  _shutdown: shutdown
};
