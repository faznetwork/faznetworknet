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

test("SMS and WhatsApp send paths persist outgoing delivery attempts", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const sms = fs.readFileSync(path.join(__dirname,"..","services","smsService.js"),"utf8");
  const whatsapp = fs.readFileSync(path.join(__dirname,"..","services","whatsappService.js"),"utf8");
  assert.match(sms,/deliveryLog\.createAttempt/);
  assert.match(sms,/status:"failed"/);
  assert.match(whatsapp,/deliveryLog\.createAttempt/);
  assert.match(whatsapp,/markDeliveredByProviderMessageId/);
});

test("SMS Alerts UI includes searchable channel, provider and status filters", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const view = fs.readFileSync(path.join(__dirname,"..","views","admin.ejs"),"utf8");
  const client = fs.readFileSync(path.join(__dirname,"..","public","js","notification-history.js"),"utf8");
  for (const id of ["notificationHistorySearch","notificationHistoryChannel","notificationHistoryProvider","notificationHistoryStatus","notificationHistoryRows"]) {
    assert.ok(view.includes('id="' + id + '"'), "missing history UI control: " + id);
  }
  assert.match(view,/data-notify-tab="history"/);
  assert.match(client,/\/api\/notifications\/delivery-history/);
});

test("delivery status finalization updates pending attempts to sent and retries failed database updates", async () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const source = fs.readFileSync(path.join(__dirname,"..","services","notificationDeliveryLog.js"),"utf8");
  assert.match(source,/RETURNING id,status/);
  assert.match(source,/for \(let attempt = 1; attempt <= 2; attempt \+= 1\)/);
  assert.match(source,/targetStatus: nextStatus/);
  assert.match(source,/status='delivered'[\s\S]*WHEN \$2='delivered'/);
});
