"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const state = require("../services/emailNotificationState");

test("email notification state reads the persisted flag and interprets only explicit true values as enabled", async () => {
  const originalQuery = db.query;
  const calls = [];
  try {
    db.query = async (sql, params) => {
      calls.push({ sql, params });
      return { rows: [{ value: "true" }] };
    };
    assert.equal(await state.isEnabled(), true);
    assert.match(calls[0].sql, /notification_channel_email_enabled|key = \$1/);
    assert.deepEqual(calls[0].params, ["notification_channel_email_enabled"]);

    db.query = async () => ({ rows: [{ value: "false" }] });
    assert.equal(await state.isEnabled(), false);
    db.query = async () => ({ rows: [] });
    assert.equal(await state.isEnabled(), false);
    db.query = async () => ({ rows: [{ value: "unexpected" }] });
    assert.equal(await state.isEnabled(), false);
    db.query = async () => { throw new Error("database unavailable"); };
    await assert.rejects(state.isEnabled(), /database unavailable/);
  } finally {
    db.query = originalQuery;
  }
});

test("email worker control and queue gates use the persisted setting, not the legacy env toggle", () => {
  const fs = require("node:fs");
  const worker = fs.readFileSync(require.resolve("../services/emailWorker"), "utf8");
  const outbox = fs.readFileSync(require.resolve("../services/emailOutboxService"), "utf8");
  assert.match(worker, /emailNotificationState\.isEnabled\(\)/);
  assert.match(worker, /Disabled by the persisted Notification Hub setting/);
  assert.doesNotMatch(worker, /process\.env\.EMAIL_WORKER_ENABLED/);
  assert.match(outbox, /await emailNotificationState\.isEnabled\(client\)/);
  assert.doesNotMatch(outbox, /process\.env\.EMAIL_WORKER_ENABLED/);
});
