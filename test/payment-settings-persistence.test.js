"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const controller=fs.readFileSync(path.join(__dirname,"..","controllers","settingsController.js"),"utf8");
const service=fs.readFileSync(path.join(__dirname,"..","services","webhookSettingsService.js"),"utf8");
const routes=fs.readFileSync(path.join(__dirname,"..","routes","settingsRoutes.js"),"utf8");
const admin=fs.readFileSync(path.join(__dirname,"..","views","admin.ejs"),"utf8");
const server=fs.readFileSync(path.join(__dirname,"..","server.js"),"utf8");

test("payment, sender IDs, and webhook/API secret share app_settings as the canonical store",()=>{
 assert.ok(service.includes("FROM app_settings WHERE key=ANY"));
 assert.ok(service.includes("personal_payment_webhook_secret"));
 assert.ok(service.includes('nk=k=>"mfs_"+k+"_number"'));
 assert.ok(service.includes('sk=k=>"mfs_"+k+"_sender_ids"'));
 assert.ok(service.includes("db.withTransaction(async tx=>"));
 assert.ok(service.includes("ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value"));
 assert.ok(service.includes("DROP TABLE webhook_settings"));
 assert.doesNotMatch(controller,/async function saveHotspotWebhookSettings/);
 assert.doesNotMatch(controller,/async function saveGeneralSettings/);
 assert.doesNotMatch(controller,/async function saveMfsAccounts/);
 assert.doesNotMatch(routes,/hotspot-webhook|mfs-accounts|controller\.website|saveGeneralSettings/);
});

test("admin exposes one Payment and Webhooks module with secret visibility and regeneration controls",()=>{
 assert.ok(admin.includes('id="general-settings-panel-payments"'));
 assert.ok(admin.includes('id="whSecretToggle"'));
 assert.ok(admin.includes('id="whSecretRegenerate"'));
 assert.ok(admin.includes('id="webhookApiSettingsForm"'));
 assert.doesNotMatch(admin,/data-settings-nav="webhooks"/);
 assert.doesNotMatch(admin,/id="general-settings-panel-webhooks"/);
 assert.doesNotMatch(admin,/id="general-settings-panel-webhook"/);
 assert.doesNotMatch(admin,/id="general-settings-panel-mfs"/);
 assert.doesNotMatch(admin,/loadHotspotWebhookSettings/);
 assert.ok(admin.includes("/api/admin/webhook-settings"));
 assert.match(server,/payment-webhooks\|sms-alerts\|hotspot-portal\|webhooks\)/);
});
