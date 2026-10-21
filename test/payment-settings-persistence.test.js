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
 assert.match(service,/FROM app_settings WHERE key=ANY/);
 assert.match(service,/personal_payment_webhook_secret/);
 assert.match(service,/numberKey=k=>"mfs_\\"\+k\+"_number"/);
 assert.match(service,/senderKey=k=>"mfs_\\"\+k\+"_sender_ids"/);
 for(const key of ["mfs_bkash_sender_ids","mfs_nagad_sender_ids","mfs_rocket_sender_ids","mfs_upay_sender_ids"])assert.ok(fs.readFileSync(path.join(__dirname,"..","db","schema.sql"),"utf8").includes(key));
 assert.match(service,/db\.withTransaction\(async tx=>/);
 assert.match(service,/ON CONFLICT\(key\) DO UPDATE SET value=EXCLUDED\.value/);
 assert.match(service,/DROP TABLE webhook_settings/);
 assert.doesNotMatch(controller,/async function saveHotspotWebhookSettings/);
 assert.doesNotMatch(controller,/async function saveGeneralSettings/);
 assert.doesNotMatch(controller,/async function saveMfsAccounts/);
 assert.doesNotMatch(routes,/hotspot-webhook|mfs-accounts|controller\.website|saveGeneralSettings/);
});

test("admin exposes one Payment and Webhooks module with secret visibility and regeneration controls",()=>{
 assert.match(admin,/id="general-settings-panel-payments"/);
 assert.match(admin,/id="whSecretToggle"/);
 assert.match(admin,/id="whSecretRegenerate"/);
 assert.match(admin,/id="webhookApiSettingsForm"/);
 assert.doesNotMatch(admin,/data-settings-nav="webhooks"/);
 assert.doesNotMatch(admin,/id="general-settings-panel-webhooks"/);
 assert.doesNotMatch(admin,/id="general-settings-panel-webhook"/);
 assert.doesNotMatch(admin,/id="general-settings-panel-mfs"/);
 assert.doesNotMatch(admin,/loadHotspotWebhookSettings/);
 assert.match(admin,//api/admin/webhook-settings/);
 assert.match(server,/payment-webhooks\|sms-alerts\|hotspot-portal\)/);
});
