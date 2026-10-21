"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");

test("notification delivery history schema includes channel/provider/status and transaction search fields", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname,"..","services","notificationDeliveryLog.js"),"utf8");
  for (const field of ["notification_delivery_logs","channel VARCHAR(30)","provider VARCHAR(100)","recipient VARCHAR(40)","message_body TEXT","transaction_id VARCHAR(160)","provider_message_id VARCHAR(200)","delivered_at TIMESTAMPTZ"]) {
    assert.ok(source.includes(field), "missing delivery history field: " + field);
  }
  assert.match(source,/recipient ILIKE/);
  assert.match(source,/transaction_id/);
});

test("notification history endpoint validates filters and uses bounded page size", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname,"..","controllers","notificationDeliveryHistoryController.js"),"utf8");
  assert.match(source,/CHANNELS/);
  assert.match(source,/STATUSES/);
  assert.match(source,/limit:100/);
  assert.match(source,/Cache-Control/);
});
