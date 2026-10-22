"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const controller=read("controllers/settingsController.js");
const service=read("services/webhookSettingsService.js");
const routes=read("routes/settingsRoutes.js");
const server=read("server.js");
const admin=read("views/admin.ejs");

test("payment and webhook configuration has one transactional app_settings source of truth",()=>{
 assert.match(controller,/async function paymentWebhookSettings/);
 assert.match(controller,/async function savePaymentWebhookSettings/);
 assert.match(controller,/async function regeneratePaymentWebhookSecret/);
 assert.match(service,/db\.withTransaction\(async tx=>/);
 assert.match(service,/ON CONFLICT\(key\) DO UPDATE SET value=EXCLUDED\.value,updated_at=NOW\(\)/);
 for(const key of ["personal_payment_webhook_url","personal_payment_webhook_enabled","personal_payment_webhook_secret","mfs_bkash_number","mfs_nagad_number","mfs_rocket_number","mfs_upay_number","mfs_bkash_sender_ids","mfs_nagad_sender_ids","mfs_rocket_sender_ids","mfs_upay_sender_ids"])assert.ok(service.includes(key),key);
 assert.match(service,/async function getPublic\(\)/);
 assert.match(service,/secretConfigured:Boolean\(c\.secret\)/);
 assert.doesNotMatch(service,/CREATE TABLE IF NOT EXISTS webhook_settings/);
});

test("legacy webhook_settings values migrate transactionally before the duplicate table is removed",()=>{
 assert.match(service,/to_regclass\('public\.webhook_settings'\)/);
 assert.match(service,/SELECT secret_key,sender_ids,recipient_numbers FROM public\.webhook_settings/);
 assert.match(service,/DROP TABLE public\.webhook_settings/);
 assert.match(service,/ON CONFLICT\(key\) DO NOTHING/);
});

test("only the unified payment-webhooks API is writable for payment configuration",()=>{
 assert.match(routes,/router\.get\("\/payment-webhooks",controller\.paymentWebhookSettings\)/);
 assert.match(routes,/router\.put\("\/payment-webhooks",controller\.savePaymentWebhookSettings\)/);
 assert.match(routes,/router\.post\("\/payment-webhooks\/regenerate",controller\.regeneratePaymentWebhookSecret\)/);
 assert.doesNotMatch(routes,/hotspot-webhook|mfs-accounts|webhookSettingsRoutes|saveGeneralSettings/);
 assert.doesNotMatch(server,/app\.use\("\/api\/admin\/webhook-settings"/);
 assert.match(server,/app\.get\("\/admin\/settings\/webhooks".*res\.redirect\(302,"\/admin\/settings\/payment-webhooks"\)/);
});

test("Payment & Webhooks UI contains receiver accounts, sender allowlists, and safe secret controls",()=>{
 for(const id of ["generalMfsBkash","generalMfsNagad","generalMfsRocket","generalMfsUpay","generalWebhookSendersBkash","generalWebhookSendersNagad","generalWebhookSendersRocket","generalWebhookSendersUpay","generalWebhookSecretToggle","generalWebhookSecretRegenerate"])assert.ok(admin.includes('id="'+id+'"'),id);
 assert.match(admin,/\/api\/settings\/payment-webhooks/);
 assert.match(admin,/\/api\/settings\/payment-webhooks\/regenerate/);
 assert.doesNotMatch(admin,/data-settings-nav="webhooks"/);
 assert.doesNotMatch(admin,/id="general-settings-panel-webhooks"/);
 assert.doesNotMatch(admin,/\/api\/admin\/webhook-settings/);
 assert.doesNotMatch(admin,/\/api\/settings\/hotspot-webhook/);
 assert.doesNotMatch(admin,/paymentWebhookSettingsForm/);
 assert.match(admin,/generalWebhookSecretToggle/);
 assert.match(admin,/generalWebhookSecretRegenerate/);
});
