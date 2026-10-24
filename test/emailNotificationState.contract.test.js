"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

test("email worker and queue use the persisted Notification Hub setting, not the legacy env toggle", async () => {
  const fs = require("node:fs");
  const worker = fs.readFileSync(require.resolve("../services/emailWorker"), "utf8");
  const outbox = fs.readFileSync(require.resolve("../services/emailOutboxService"), "utf8");
  assert.match(worker, /emailNotificationState\.isEnabled\(\)/);
  assert.match(worker, /Disabled by the persisted Notification Hub setting/);
  assert.doesNotMatch(worker, /process\.env\.EMAIL_WORKER_ENABLED/);
  assert.match(outbox, /await emailNotificationState\.isEnabled\(\)/);
  assert.doesNotMatch(outbox, /process\.env\.EMAIL_WORKER_ENABLED/);
});

test("email notification state reads only the persisted channel flag and fails closed on missing value", async () => {
  const fs = require("node:fs");
  const state = fs.readFileSync(require.resolve("../services/emailNotificationState"), "utf8");
  assert.match(state, /notification_channel_email_enabled/);
  assert.match(state, /value === "true" \|\| value === "1"/);
  assert.match(state, /await db\.query/);
});
