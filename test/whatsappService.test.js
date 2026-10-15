"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createDatabaseAuthState, normalizePhone } = require("../services/whatsappService");

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
  return {
    rows,
    async query(sql, params = []) {
      if (sql.includes("CREATE TABLE IF NOT EXISTS whatsapp_sessions")) return { rows: [] };
      if (sql.includes("SELECT value FROM whatsapp_sessions WHERE key = $1")) {
        const value = rows.get(params[0]);
        return { rows: value === undefined ? [] : [{ value }] };
      }
      if (sql.includes("SELECT key, value FROM whatsapp_sessions WHERE key = ANY")) {
        return { rows: params[0].filter(key => rows.has(key)).map(key => ({ key, value: rows.get(key) })) };
      }
      if (sql.includes("INSERT INTO whatsapp_sessions")) {
        rows.set(params[0], JSON.parse(params[1]));
        return { rows: [] };
      }
      if (sql.includes("DELETE FROM whatsapp_sessions WHERE key = $1")) {
        rows.delete(params[0]);
        return { rows: [] };
      }
      throw new Error("Unexpected query: " + sql);
    }
  };
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
