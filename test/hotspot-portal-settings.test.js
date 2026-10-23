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

test("public portal configuration exposes only saved, enabled, priced Hotspot profiles and current branding",()=>{
 assert.match(controller,/async function publicPortalPayload\\(\\)/);
 assert.match(controller,/display_mode:s\\.display_mode/);
 assert.match(controller,/logoUrl:s\\.portal_logo_url\\|\\|null/);
 assert.match(controller,/bannerUrl:s\\.banner_url\\|\\|null/);
 assert.match(controller,/features:\\{online_payment:s\\.enable_online_payment!==false,voucher_pin:s\\.enable_voucher_pin!==false,qr_scan:s\\.enable_qr_scan!==false\\}/);
 assert.match(controller,/return \\{profileId:name,profile:name,name,price,validity:/);
 assert.match(controller,/status\\(503\\)\\.json\\(\\{success:false,error:/);
});

test("hotspot login page uses one script, verified voucher credentials, RouterOS CHAP and the public config contract",()=>{
 const scripts=[...login.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)];
 assert.equal(scripts.length,1,"legacy competing script flows should be consolidated");
 assert.doesNotThrow(()=>new vm.Script(scripts[0][1],{filename:"public/login.html script"}));
 assert.match(login,/id="voucher_pin"/);
 assert.match(login,/id="voucher_password"/);
 assert.match(login,/claim-voucher/);
 assert.doesNotMatch(login,/api\\/hotspot\\/verify-voucher/);
 assert.doesNotMatch(login,/member_username|m-btn-member|btn-master-action/);
 assert.match(login,/display_mode\\|\\|?'default'/);
 assert.match(login,/features\\.online_payment/);
 assert.match(login,/features\\.voucher_pin/);
 assert.match(login,/chapIdentifierByte/);
 assert.match(login,/decodeChapChallenge/);
 assert.match(login,/qr-scanner-modal/);
 assert.match(login,/config\\.packages\\|\\|\\[\\]/);
 assert.match(login,/showStatus\\(error\\.message/);
});

test("voucher and payment connection only follow successful verification responses",()=>{
 const script=[...login.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)][0][1];
 const voucher=script.slice(script.indexOf("async function handleVoucherLogin"),script.indexOf("document.addEventListener('DOMContentLoaded'"));
 const payment=script.slice(script.indexOf("async function handleVerification"),script.indexOf("function parseQrCredentials"));
 assert.ok(voucher.indexOf("await requestJson")<voucher.indexOf("submitMikrotikLogin"));
 assert.match(voucher,/if\\(!result\\.username\\|\\|!result\\.password\\)/);
 assert.ok(payment.indexOf("await requestJson")<payment.indexOf("submitMikrotikLogin"));
 assert.match(payment,/profile_id:selectedPackage\\.profile/);
});
