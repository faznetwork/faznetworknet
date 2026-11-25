"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const whatsappService = require("../services/whatsappService");
const { createDatabaseAuthState, normalizePhone, extractConnectedAccount } = whatsappService;

function fakeBaileys() {
  return {
    BufferJSON: {
      replacer: (_key, value) => Buffer.isBuffer(value)
        ? { type: "Buffer", data: Array.from(value) }
        : value,
      reviver: (_key, value) => value && value.type === "Buffer" && Array.isArray(value.data)
        ? Buffer.from(value.data)
        : value
    },
    initAuthCreds: () => ({ registered: false, noiseKey: { private: Buffer.from([1, 2, 3]) } }),
    proto: { Message: { AppStateSyncKeyData: { fromObject: value => ({ ...value, restoredAsProto: true }) } } }
  };
}

function fakeDatabase() {
  const rows = new Map();
  const queries = [];
  const database = {
    rows, queries, failInsertKey: null,
    async query(sql, params = []) {
      queries.push(sql.trim().replace(/\s+/g, " "));
      if (sql.includes("CREATE TABLE IF NOT EXISTS whatsapp_sessions")) return { rows: [] };
      if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql.trim())) return { rows: [] };
      if (sql.includes("SELECT value FROM whatsapp_sessions WHERE key = $1")) {
        const value = rows.get(params[0]);
        return { rows: value === undefined ? [] : [{ value }] };
      }
      if (sql.includes("SELECT key, value FROM whatsapp_sessions WHERE key = ANY")) {
        return { rows: params[0].filter(key => rows.has(key)).map(key => ({ key, value: rows.get(key) })) };
      }
      if (sql.includes("INSERT INTO whatsapp_sessions")) {
        if (database.failInsertKey && params[0] === database.failInsertKey) throw new Error("simulated insert failure");
        rows.set(params[0], JSON.parse(params[1]));
        return { rows: [] };
      }
      if (sql.includes("DELETE FROM whatsapp_sessions WHERE key = $1 OR key LIKE $2")) {
        for (const key of rows.keys()) {
          if (key === params[0] || (params[1] === "key:%" && key.startsWith("key:"))) rows.delete(key);
        }
        return { rows: [] };
      }
      if (sql.includes("DELETE FROM whatsapp_sessions WHERE key = $1")) {
        rows.delete(params[0]);
        return { rows: [] };
      }
      if (sql.includes("DELETE FROM whatsapp_sessions")) {
        rows.clear();
        return { rows: [] };
      }
      throw new Error("Unexpected query: " + sql);
    },
    async withTransaction(callback) {
      const snapshot = new Map(rows);
      queries.push("BEGIN");
      try {
        const result = await callback({ query: database.query.bind(database) });
        queries.push("COMMIT");
        return result;
      } catch (error) {
        rows.clear();
        for (const [key, value] of snapshot) rows.set(key, value);
        queries.push("ROLLBACK");
        throw error;
      }
    }
  };
  return database;
}

test("database auth adapter persists and restores Baileys credentials and Buffer values", async () => {
  const database = fakeDatabase();
  const baileys = fakeBaileys();
  const first = await createDatabaseAuthState({ database, baileys });
  first.state.creds.registered = true;
  await first.saveCreds();
  await first.state.keys.set({ "session": { "abc": { private: Buffer.from([4, 5, 6]) } } });

  const second = await createDatabaseAuthState({ database, baileys });
  assert.equal(second.state.creds.registered, true);
  assert.deepEqual(second.state.creds.noiseKey.private, Buffer.from([1, 2, 3]));
  const keys = await second.state.keys.get("session", ["abc", "missing"]);
  assert.deepEqual(keys.abc.private, Buffer.from([4, 5, 6]));
  assert.equal(keys.missing, undefined);
});

test("database auth adapter deletes removed Signal keys and restores app-state protobuf values", async () => {
  const database = fakeDatabase();
  const baileys = fakeBaileys();
  const auth = await createDatabaseAuthState({ database, baileys });
  await auth.state.keys.set({ "session": { "remove-me": { key: true } } });
  await auth.state.keys.set({ "session": { "remove-me": null } });
  await auth.state.keys.set({ "app-state-sync-key": { "sync": { keyData: "encoded" } } });

  const sessions = await auth.state.keys.get("session", ["remove-me"]);
  assert.deepEqual(sessions, {});
  const sync = await auth.state.keys.get("app-state-sync-key", ["sync"]);
  assert.equal(sync.sync.restoredAsProto, true);
  assert.equal(sync.sync.keyData, "encoded");
});

test("WhatsApp phone normalization remains Bangladesh-specific", () => {
  assert.equal(normalizePhone("01712345678"), "8801712345678");
  assert.equal(normalizePhone("+8801712345678"), "8801712345678");
  assert.throws(() => normalizePhone("12345"), /valid Bangladesh mobile number/);
});


test("extracts the linked WhatsApp phone, push name, and link timestamp", () => {
  const linkedSince = "2026-10-16T08:00:00.000Z";
  assert.deepEqual(
    extractConnectedAccount({ id: "8801712345678:12@s.whatsapp.net", name: "FAZ Admin" }, linkedSince),
    { phone: "+8801712345678", name: "FAZ Admin", linkedSince }
  );
});

test("does not invent a phone number when the connected JID is not a BD mobile", () => {
  const account = extractConnectedAccount({ id: "123456789:4@s.whatsapp.net", name: "Device" }, "2026-10-16T08:00:00.000Z");
  assert.equal(account.phone, null);
  assert.equal(account.name, "Device");
});


test("loggedOut disconnect preserves PostgreSQL session rows and requests re-linking", async () => {
  const { _handleConnectionClose } = require("../services/whatsappService");
  const database = fakeDatabase();
  database.rows.set("creds", { registered: true, token: "preserve-me" });
  database.rows.set("key:session:abc", { key: "preserve-me-too" });
  const before = new Map(database.rows);
  const status = await _handleConnectionClose(
    { lastDisconnect: { error: { output: { statusCode: 401 } } } },
    { DisconnectReason: { loggedOut: 401 } },
    { end() {} }
  );
  assert.equal(status.connection, "reconnect_required");
  assert.equal(database.queries.length, 0, "loggedOut handling must not query/delete session rows");
  assert.deepEqual([...database.rows], [...before]);
});

test("Notification Hub manual unlink endpoint delegates to unlink and deletes stored session rows", async () => {
  const whatsappService = require("../services/whatsappService");
  const settingsController = require("../controllers/settingsController");
  const database = fakeDatabase();
  database.rows.set("creds", { registered: true });
  database.rows.set("key:session:abc", { key: true });
  const originalUnlink = whatsappService.unlink;
  let response;
  whatsappService.unlink = () => originalUnlink({ database });
  try {
    const res = {
      set() { return this; },
      json(body) { response = body; return this; },
      status(code) { this.statusCode = code; return this; }
    };
    await settingsController.whatsappUnlink({}, res);
    assert.equal(response.success, true);
    assert.equal(database.rows.size, 0);
    assert.ok(database.queries.some(sql => sql.includes("DELETE FROM whatsapp_sessions")));
  } finally {
    whatsappService.unlink = originalUnlink;
  }
});

test("Signal key batches use BEGIN/COMMIT and roll back all changes on failure", async () => {
  const database = fakeDatabase();
  const auth = await createDatabaseAuthState({ database, baileys: fakeBaileys() });
  await auth.state.keys.set({ session: { existing: { old: true } } });
  database.queries.length = 0;
  database.failInsertKey = "key:session:explode";
  await assert.rejects(
    auth.state.keys.set({ session: { existing: null, explode: { new: true } } }),
    /simulated insert failure/
  );
  assert.ok(database.queries.includes("BEGIN"));
  assert.ok(database.queries.includes("ROLLBACK"));
  assert.ok(!database.queries.includes("COMMIT"));
  assert.deepEqual(await auth.state.keys.get("session", ["existing"]), { existing: { old: true } });
});


test("credential snapshots are taken inside the write queue and persist registered=true", async () => {
  const database = fakeDatabase();
  const auth = await createDatabaseAuthState({ database, baileys: fakeBaileys() });
  auth.state.creds.registered = false;
  const firstWrite = auth.saveCreds();
  auth.state.creds.registered = true;
  const secondWrite = auth.saveCreds();
  await Promise.all([firstWrite, secondWrite]);
  assert.equal(database.rows.get("creds").registered, true);
  const restored = await createDatabaseAuthState({ database, baileys: fakeBaileys() });
  assert.equal(restored.state.creds.registered, true);
});

test("live WhatsApp readiness requires an open socket user and registered credentials", () => {
  const { _isSocketReady } = require("../services/whatsappService");
  const sock = { user: { id: "8801712345678@s.whatsapp.net" } };
  assert.equal(_isSocketReady(sock, { registered: true }, "connected"), true);
  assert.equal(_isSocketReady(sock, { registered: false }, "connected"), false);
  assert.equal(_isSocketReady(null, { registered: true }, "connected"), false);
  assert.equal(_isSocketReady({ user: null }, { registered: true }, "connected"), false);
  assert.equal(_isSocketReady(sock, { registered: true }, "disconnected"), false);
});


test("fresh QR reset purges only unregistered auth rows and preserves account metadata", async () => {
  const { _resetUnregisteredAuthRows } = require("../services/whatsappService");
  const database = fakeDatabase();
  database.rows.set("creds", { registered: false, stale: true });
  database.rows.set("key:pre-key:old", { key: "stale" });
  database.rows.set("metadata", { phone: "+8801712345678" });
  const result = await _resetUnregisteredAuthRows(database, fakeBaileys());
  assert.deepEqual(result, { reset: true, reason: "unregistered" });
  assert.equal(database.rows.has("creds"), false);
  assert.equal(database.rows.has("key:pre-key:old"), false);
  assert.deepEqual(database.rows.get("metadata"), { phone: "+8801712345678" });
  assert.ok(database.queries.includes("BEGIN"));
  assert.ok(database.queries.includes("COMMIT"));
});

test("fresh QR reset never purges a registered PostgreSQL session", async () => {
  const { _resetUnregisteredAuthRows } = require("../services/whatsappService");
  const database = fakeDatabase();
  database.rows.set("creds", { registered: true, token: "keep" });
  database.rows.set("key:session:abc", { key: "keep" });
  const before = [...database.rows];
  const result = await _resetUnregisteredAuthRows(database, fakeBaileys());
  assert.deepEqual(result, { reset: false, reason: "registered" });
  assert.deepEqual([...database.rows], before);
});


/* Socket-ownership tests: the lease row (owner_token + heartbeat) is the
 * ONLY exclusion primitive. Session-level advisory locks are meaningless
 * under the Supabase transaction pooler — the backend behind a client can
 * be recycled silently, dropping the lock while the process still believes
 * it owns the socket — so both instances connected with the same creds and
 * WhatsApp kicked each one in turn (connectionReplaced, every ~4s). The
 * atomic INSERT ... ON CONFLICT ... WHERE heartbeat-stale below is what
 * actually serializes the PC and Render instances. */

function fakeLeaseDb(script = {}) {
  const queries = [];
  let row = script.row ? { ...script.row } : null; // { owner_token, age_ms }
  const database = {
    queries,
    get leaseRow() { return row; },
    setLeaseRow(next) { row = next ? { ...next } : null; },
    async query(sql, params = []) {
      const flat = sql.trim().replace(/\s+/g, " ");
      queries.push({ sql: flat, params });
      if (flat.startsWith("CREATE TABLE IF NOT EXISTS whatsapp_socket_lease")) return { rows: [] };
      if (flat.startsWith("ALTER TABLE whatsapp_socket_lease")) return { rows: [] };
      if (flat.startsWith("SELECT owner_token,")) {
        return { rows: row ? [{ owner_token: row.owner_token, age_ms: row.age_ms }] : [] };
      }
      if (flat.startsWith("INSERT INTO whatsapp_socket_lease")) {
        const token = params[2];
        const stale = !row || row.age_ms > 90000;
        if (!stale) return { rows: [] };
        row = { owner_token: token, age_ms: 0 };
        return { rows: [{ owner_token: token }], rowCount: 1 };
      }
      if (flat.startsWith("UPDATE whatsapp_socket_lease SET heartbeat_at")) {
        if (row && row.owner_token === params[1]) { row.age_ms = 0; return { rowCount: 1, rows: [] }; }
        return { rowCount: 0, rows: [] };
      }
      if (flat.startsWith("DELETE FROM whatsapp_socket_lease WHERE lock_key=$1 AND owner_token=$2")) {
        if (row && row.owner_token === params[1]) row = null;
        return { rows: [], rowCount: 1 };
      }
      throw new Error("Unexpected lease query: " + flat);
    }
  };
  return database;
}

function leaseQueryTexts(database, prefix) {
  return database.queries.filter(q => q.sql.startsWith(prefix)).map(q => q.sql);
}

test("socket ownership: free lease is claimed with a token-based lease row and never terminates a backend", async () => {
  const database = fakeLeaseDb();
  await whatsappService._acquireSocketOwnership(database);
  const inserts = database.queries.filter(q => q.sql.startsWith("INSERT INTO whatsapp_socket_lease"));
  assert.equal(inserts.length, 1);
  assert.equal(inserts[0].params.length, 3);
  assert.match(inserts[0].params[2], /^[0-9a-f-]{36}$/);
  assert.equal(database.leaseRow.owner_token, inserts[0].params[2]);
  assert.equal(leaseQueryTexts(database, "SELECT pg_terminate_backend").length, 0);
  assert.equal(leaseQueryTexts(database, "pg_try_advisory_lock").length, 0);
  assert.equal(leaseQueryTexts(database, "pg_advisory_unlock").length, 0);
  await whatsappService._releaseSocketOwnership(database);
  assert.equal(database.leaseRow, null);
});

test("socket ownership conflict never touches saved auth rows and never terminates", async () => {
  const database = fakeLeaseDb({ row: { owner_token: "other-instance", age_ms: 5000 } });
  await assert.rejects(
    () => whatsappService._acquireSocketOwnership(database),
    error => error.code === "WHATSAPP_SOCKET_OWNED_ELSEWHERE"
  );
  assert.equal(database.leaseRow.owner_token, "other-instance", "a live owner's lease row must be untouched");
  assert.equal(leaseQueryTexts(database, "SELECT pg_terminate_backend").length, 0);
  await whatsappService._releaseSocketOwnership(database);
});

test("socket ownership: stale lease row is taken over atomically", async () => {
  const database = fakeLeaseDb({ row: { owner_token: "dead-instance", age_ms: 120000 } });
  await whatsappService._acquireSocketOwnership(database);
  const inserts = database.queries.filter(q => q.sql.startsWith("INSERT INTO whatsapp_socket_lease"));
  assert.equal(inserts.length, 1);
  assert.match(inserts[0].sql, /WHERE whatsapp_socket_lease\.heartbeat_at < NOW\(\) - INTERVAL '90 seconds'/);
  assert.equal(database.leaseRow.owner_token, inserts[0].params[2]);
  assert.equal(leaseQueryTexts(database, "SELECT pg_terminate_backend").length, 0);
  await whatsappService._releaseSocketOwnership(database);
  assert.equal(database.leaseRow, null);
});

test("socket ownership: a second acquire re-validates instead of trusting memory", async () => {
  const database = fakeLeaseDb();
  await whatsappService._acquireSocketOwnership(database);
  await whatsappService._acquireSocketOwnership(database);
  assert.equal(
    database.queries.filter(q => q.sql.startsWith("INSERT INTO whatsapp_socket_lease")).length, 1,
    "re-validation must early-return while our lease row is still fresh"
  );
  // The lease is stolen out from under us (the other instance took it over):
  // the next acquire must notice and refuse instead of connecting anyway.
  database.setLeaseRow({ owner_token: "stolen-by-render", age_ms: 1000 });
  await assert.rejects(
    () => whatsappService._acquireSocketOwnership(database),
    error => error.code === "WHATSAPP_SOCKET_OWNED_ELSEWHERE"
  );
  assert.equal(
    database.queries.filter(q => q.sql.startsWith("INSERT INTO whatsapp_socket_lease")).length, 2,
    "a lost lease must trigger a fresh claim attempt, not a blind early return"
  );
  await whatsappService._releaseSocketOwnership(database);
});

test("socket ownership: heartbeat that matches zero rows drops ownership", async () => {
  const database = fakeLeaseDb();
  try {
    await whatsappService._acquireSocketOwnership(database);
    const ownToken = database.leaseRow.owner_token;
    database.setLeaseRow({ owner_token: "stolen-by-render", age_ms: 1000 });
    await whatsappService._heartbeatSocketLease(database);
    assert.equal(
      database.queries.filter(q => q.sql.startsWith("UPDATE whatsapp_socket_lease SET heartbeat_at")).length, 1
    );
    // Ownership is gone: the next acquire must attempt a fresh claim instead
    // of trusting the in-memory flag.
    await assert.rejects(
      () => whatsappService._acquireSocketOwnership(database),
      error => error.code === "WHATSAPP_SOCKET_OWNED_ELSEWHERE"
    );
    assert.notEqual(database.leaseRow.owner_token, ownToken);
  } finally {
    // The lost-lease path schedules a reconnect timer; cancel it so the
    // suite does not keep retrying against the real database afterwards.
    await whatsappService._shutdown();
  }
  await whatsappService._releaseSocketOwnership(database);
});

test("connectionReplaced close is logged with its reason and never wipes auth rows", async () => {
  const { _handleConnectionClose } = require("../services/whatsappService");
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => { warnings.push(args.map(String).join(" ")); };
  try {
    const status = await _handleConnectionClose(
      { lastDisconnect: { error: { output: { statusCode: 440 } } } },
      { DisconnectReason: { loggedOut: 401, connectionReplaced: 440 } },
      { end() {} }
    );
    assert.equal(status.connection, "disconnected");
    assert.ok(
      warnings.some(line => line.includes("connectionReplaced") && line.includes("440")),
      "every close must log its Baileys reason; got: " + warnings.join(" | ")
    );
  } finally {
    console.warn = originalWarn;
    // A non-loggedOut close schedules a reconnect timer; cancel it so the
    // suite does not keep retrying against the real database afterwards.
    await whatsappService._shutdown();
  }
});
test("resetRegisteredAuthRows purges dead creds, Signal keys and metadata", async () => {
  const database = fakeDatabase();
  const baileys = fakeBaileys();
  const auth = await createDatabaseAuthState({ database, baileys });
  auth.state.creds.registered = true;
  await auth.saveCreds();
  await auth.state.keys.set({ "session": { "abc": { private: Buffer.from([4, 5, 6]) } } });
  database.rows.set("metadata", { phone: "+8801712345678" });
  assert.equal(database.rows.has("creds"), true);
  assert.equal(database.rows.has("metadata"), true);
  const result = await whatsappService._resetRegisteredAuthRows(database);
  assert.equal(result.reset, true);
  assert.equal(database.rows.has("creds"), false);
  assert.equal(database.rows.has("key:session:abc"), false);
  assert.equal(database.rows.has("metadata"), false);
});

/* Permanent-fix guard: a transient close (408 timeout, 500 restart, or any
 * non-401 failure) must NEVER wipe the saved login. Only a confirmed
 * WhatsApp-reported loggedOut (401) or an explicit Unlink may delete auth
 * rows. The Nov 26 wipe happened while the socket was connected and no
 * loggedOut was ever logged, so the wipe paths must stay narrow. */

test("transient closes (408 timeout, 500 restart) never wipe saved auth rows", async () => {
  const { _handleConnectionClose } = require("../services/whatsappService");
  const database = fakeDatabase();
  database.rows.set("creds", { registered: true, token: "keep-me" });
  database.rows.set("key:session:abc", { key: "keep-me-too" });
  database.rows.set("metadata", { phone: "+8801712345678" });
  const before = [...database.rows];
  try {
    for (const code of [408, 500]) {
      const status = await _handleConnectionClose(
        { lastDisconnect: { error: { output: { statusCode: code } } } },
        { DisconnectReason: { loggedOut: 401, connectionReplaced: 440 } },
        { end() {} }
      );
      assert.equal(status.connection, "disconnected", `close ${code} must schedule a reconnect, not demand a re-link`);
      assert.deepEqual([...database.rows], before, `close ${code} must preserve every auth row`);
      assert.equal(
        database.queries.some(sql => sql.includes("DELETE FROM whatsapp_sessions")),
        false,
        `close ${code} must not issue any auth-row delete`
      );
    }
  } finally {
    // A transient close schedules a reconnect timer; cancel it so the suite
    // does not keep retrying against the real database afterwards.
    await whatsappService._shutdown();
  }
});
