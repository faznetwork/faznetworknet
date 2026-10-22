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
 assert.doesNotMatch(controller,/tenant_id/);
 const schema=fs.readFileSync(path.join(__dirname,"..","db","schema.sql"),"utf8");
 const migration=fs.readFileSync(path.join(__dirname,"..","migrations","20261018_hotspot_portal_settings.sql"),"utf8");
 assert.doesNotMatch(schema,/CREATE TABLE IF NOT EXISTS hotspot_portal_settings .*tenant_id/);
 assert.doesNotMatch(migration,/CREATE TABLE IF NOT EXISTS hotspot_portal_settings .*tenant_id/);
 assert.match(controller,/INSERT INTO hotspot_portal_settings\(id\) VALUES\(1\)/);
 assert.match(controller,/WHERE id=1/);
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


test("captive portal uses the premium responsive green-and-white UI without changing login contracts",()=>{
 assert.match(login,/<style id="faz-premium-login-ui">/);
 assert.match(login,/--brand-primary:#0a3d2e/);
 assert.match(login,/\.rgb-wrapper\{/);
 assert.match(login,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(login,/@media\(max-width:380px\)/);
 assert.match(login,/prefers-reduced-motion:reduce/);
 assert.match(login,/portal-trust-line/);
 assert.match(login,/api\/hotspot-auth\/claim-voucher/);
 assert.match(login,/api\/hotspot-auth\/direct-login/);
 assert.match(login,/mikrotik-auto-login/);
});

test("captive portal uses server branding and all configured packages, with a premium responsive theme and visible retry on API failure",()=>{
 assert.match(login,/api\/public\/portal-config/);
 assert.match(login,/p\.profileId/);
 assert.match(login,/data\.logoUrl/);
 assert.match(login,/data\.bannerUrl/);
 assert.match(login,/portal-package-error/);
 assert.match(login,/portal-retry-button/);
 assert.match(login,/faz-premium-portal-v2/);
 assert.match(login,/--portal-forest:#082f27/);
 assert.match(login,/grid-template-columns:repeat\(auto-fit,minmax\(132px,1fr\)\)/);
 assert.match(login,/প্যাকেজ লোড করা যায়নি/);
 assert.match(login,/api\/hotspot-auth\/claim-voucher/);
});
