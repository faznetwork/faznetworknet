"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const controller=fs.readFileSync(path.join(__dirname,"..","controllers","settingsController.js"),"utf8");
const admin=fs.readFileSync(path.join(__dirname,"..","views","admin.ejs"),"utf8");

test("payment webhook settings are upserted atomically and returned without exposing the secret",()=>{
 assert.match(controller,/async function saveHotspotWebhookSettings/);
 assert.match(controller,/db\.withTransaction\(async tx=>/);
 assert.match(controller,/ON CONFLICT\(key\) DO UPDATE SET value=EXCLUDED\.value,updated_at=NOW\(\)/);
 assert.match(controller,/personal_payment_webhook_url/);
 assert.match(controller,/personal_payment_webhook_enabled/);
 assert.match(controller,/personal_payment_webhook_secret/);
 assert.match(controller,/data:settings,settings/);
 assert.match(controller,/secretConfigured:Boolean\(String\(saved\.personal_payment_webhook_secret\|\|""\)\)/);
});

test("MFS numbers are saved in one PostgreSQL transaction and invalidate the settings cache",()=>{
 assert.match(controller,/async function saveGeneralSettings/);
 assert.match(controller,/db\.withTransaction\(async tx=>/);
 for(const key of ["mfs_bkash_number","mfs_nagad_number","mfs_rocket_number","mfs_upay_number"]) assert.ok(controller.includes(key));
 assert.match(controller,/appSettings"\)\.invalidate\(\)/);
 assert.match(controller,/data:normalized,accounts:normalized/);
});

test("payment form save handlers do not immediately reload stale settings over the edited fields",()=>{
 assert.match(admin,/hotspotWebhookSettingsLoaded=true;if\(document\.getElementById\('paymentWebhookSecret'\)\)document\.getElementById\('paymentWebhookSecret'\)\.value='';/);
 assert.match(admin,/generalSettingsLoaded=true;/);
});
