"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const js=fs.readFileSync(path.join(__dirname,"..","public","js","hotspot-portal-settings.js"),"utf8");
const controller=fs.readFileSync(path.join(__dirname,"..","controllers","hotspotPortalSettingsController.js"),"utf8");
const login=fs.readFileSync(path.join(__dirname,"..","public","login.html"),"utf8");

test("hotspot portal package selector is read-only and safely handles API failure",()=>{
 assert.doesNotThrow(()=>new vm.Script(js,{filename:"hotspot-portal-settings.js"}));
 assert.doesNotMatch(js,/portal-package-name|portal-package-price" type="number|portal-package-validity" maxlength/);
 assert.match(js,/Profile Name/);
 assert.match(js,/Price \(৳\)/);
 assert.match(js,/Validity/);
 assert.match(js,/Show on Portal/);
 assert.match(js,/async function loadProfiles\(\)/);
 assert.match(js,/Retry profile loading/);
 assert.match(js,/Could not load MikroTik profiles/);
 assert.match(js,/renderPackageRows\(savedPackages/);
});

test("settings save only enabled profile names, and public config resolves existing metadata",()=>{
 assert.match(js,/enabledProfiles:readEnabledProfiles\(\)/);
 assert.match(js,/function readEnabledProfiles\(\)/);
 assert.doesNotMatch(js,/packages:readPackages\(\)/);
 assert.match(controller,/enabledProfiles/);
 assert.match(controller,/hotspot_profile_metadata/);
 assert.match(controller,/packages:await enabledPortalPackages\(config\)/);
 assert.match(login,/config\.packages/);
 assert.match(login,/Number\.isFinite\(p\.price\)&&p\.price>0/);
});

test("admin hotspot portal settings safely falls back when either settings store is unavailable",()=>{
 assert.match(controller,/async function getSettings\(_q,res\)\{try\{let settings=\{\.\.\.defaults\}/);
 assert.match(controller,/Dedicated settings store unavailable; using safe defaults/);
 assert.match(controller,/Public config unavailable; retaining safe settings/);
 assert.match(controller,/GET handler failed; returning empty settings/);
 assert.match(controller,/return res\.status\(200\)\.json\(\{success:true,settings:\{\}\}\)/);
 assert.match(controller,/function readPublicConfig\(\).*catch\(_\)\{return \{\};\}/);
 assert.doesNotMatch(controller,/DELETE FROM (?:app_settings|hotspot_portal_settings)/i);
});

test("dashboard live traffic retries interface discovery after transient router/API failures",()=>{
 const admin=fs.readFileSync(path.join(__dirname,"..","views","admin.ejs"),"utf8");
 assert.match(admin,/async function retryLoadTrafficInterfaces\(\)/);
 assert.match(admin,/trafficInterfaceLoadInFlight/);
 assert.match(admin,/trafficInterfaceRetryTimer = setInterval/);
 assert.match(admin,/dataset\.nocOptionsLoaded !== '1'/);
 assert.match(admin,/textContent = 'LIVE'/);
 assert.match(admin,/nocTrafficHistory\.push\(\{ rx: downloadMbps, tx: uploadMbps \}\)/);
});

test("single-tenant hotspot settings schema does not require tenant_id",()=>{
 const schema=fs.readFileSync(path.join(__dirname,"..","db","schema.sql"),"utf8");
 assert.match(schema,/CREATE TABLE IF NOT EXISTS hotspot_portal_settings/);
 assert.match(schema,/INSERT INTO hotspot_portal_settings\(id\) VALUES\(1\)/);
 assert.doesNotMatch(schema,/tenant_id/);
 assert.doesNotMatch(controller,/tenant_id/);
 assert.match(controller,/WHERE id=1/);
});
