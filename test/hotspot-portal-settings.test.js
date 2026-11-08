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
 assert.match(controller,/packages/);
 assert.match(login,/config\.packages/);
 assert.ok(controller.includes("if(!Number.isFinite(price)||price<=0)return null;"));
});

test("admin hotspot portal settings reports configuration-store failures",()=>{
 assert.match(controller,/async function getSettings\(_q,res\)\{try\{let settings=\{\.\.\.defaults\}/);
 assert.match(controller,/Dedicated settings store unavailable; using safe defaults/);
 assert.match(controller,/Public config unavailable; retaining safe settings/);
 assert.match(controller,/GET handler failed; returning empty settings/);
 assert.match(controller,/return res\.status\(200\)\.json\(\{success:true,settings:\{\}\}\)/);
 assert.match(controller,/async function readPublicConfig\(\).*Unable to read hotspot portal configuration/);
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

test("public portal config exposes saved branding, feature flags and only enabled priced profiles",async()=>{
 const db=require("../db");
 const portal=require("../controllers/hotspotPortalSettingsController");
 const originalQuery=db.query;
 db.query=async(sql)=>{
  if(sql.startsWith("INSERT INTO hotspot_portal_settings"))return {rows:[]};
  if(sql.includes("SELECT * FROM hotspot_portal_settings"))return {rows:[{display_mode:"banner",portal_logo_url:"/uploads/branding/logo.png",banner_url:"/uploads/branding/banner.png",brand_title:"FAZ Test Portal",enable_online_payment:false,enable_voucher_pin:true,enable_qr_scan:false}]};
  if(sql.includes("hotspot_public_portal_config"))return {rows:[{value:JSON.stringify({portalTitle:"FAZ Test Portal",enabledProfiles:["Pack 525","Free"],mfs:[{enabled:true,number:"01711111111"},{enabled:false,number:"01822222222"}]})}]};
  if(sql.includes("hotspot_profile_metadata"))return {rows:[{value:JSON.stringify({"Pack 525":{price:525,validityLabel:"30 days",limitBytesTotal:0},Hidden:{price:650,validityLabel:"30 days"},Free:{price:0,validityLabel:"1 day"}})}]};
  throw new Error("Unexpected portal-config query: "+sql);
 };
 const response={headers:{},payload:null,set(key,value){this.headers[key]=value;return this;},status(code){this.statusCode=code;return this;},json(payload){this.payload=payload;return this;}};
 try {
  await portal.publicPortalConfig({},response);
  assert.equal(response.statusCode,undefined);
  assert.equal(response.payload.success,true);
  assert.equal(response.payload.display_mode,"banner");
  assert.equal(response.payload.logoUrl,"/uploads/branding/logo.png");
  assert.equal(response.payload.bannerUrl,"/uploads/branding/banner.png");
  assert.deepEqual(response.payload.features,{online_payment:false,voucher_pin:true,qr_scan:false,enable_online_purchase:false,enable_voucher_login:true,enable_qr_scanner:false});
  assert.deepEqual(response.payload.packages.map(item=>item.profileId),["Pack 525"]);
  assert.equal(response.payload.packages[0].price,525);
  assert.equal(response.payload.packages[0].validity,"30 days");
  assert.equal(response.payload.packages[0].enabled,true);
  assert.equal(response.payload.packages[0].isPublic,true);
  assert.deepEqual(response.payload.mfs,[{enabled:true,number:"01711111111"}]);
 } finally {
  db.query=originalQuery;
 }
});
test("hotspot login page uses one script and preserves verified voucher, payment and RouterOS CHAP flows",()=>{
 const scripts=[...login.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
 assert.equal(scripts.length,1,"legacy competing script flows should be consolidated");
 assert.doesNotThrow(()=>new vm.Script(scripts[0][1],{filename:"public/login.html script"}));
 assert.match(login,/id="voucher_pin"/);
 assert.match(login,/id="voucher_password"/);
 assert.match(login,/claim-voucher/);
 assert.doesNotMatch(login,/api\/hotspot\/verify-voucher/);
 assert.doesNotMatch(login,/member_username|m-btn-member|btn-master-action/);
 assert.ok(login.includes("config.display_mode||'default'"));
 assert.match(login,/portalSettingEnabled\(features,config,\['online_payment','enable_online_purchase','enable_online_payment'\]\)/);
 assert.match(login,/portalSettingEnabled\(features,config,\['voucher_pin','enable_voucher_login','enable_voucher_pin'\]\)/);
 assert.match(login,/portalSettingEnabled\(features,config,\['qr_scan','enable_qr_scanner','enable_qr_scan'\]\)/);
 assert.match(login,/\.filter\(p=>p&&\(p\.enabled===true\|\|p\.isPublic===true\)\)/);
 assert.match(login,/window\.location\.hostname/);
 assert.match(login,/Payment settings unavailable/);
 assert.match(login,/chapIdentifierByte/);
 assert.match(login,/decodeChapChallenge/);
 assert.match(login,/qr-scanner-modal/);
 assert.match(login,/config\.packages\|\|\[\]/);
 assert.match(login,/showStatus\(error\.message/);
});

test("voucher and payment connection only follow successful verification responses",()=>{
 const script=[...login.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)][0][1];
 const voucher=script.slice(script.indexOf("async function handleVoucherLogin"),script.indexOf("document.addEventListener('DOMContentLoaded'"));
 const payment=script.slice(script.indexOf("async function handleVerification"),script.indexOf("function parseQrCredentials"));
 assert.ok(voucher.indexOf("await requestJson")<voucher.indexOf("submitMikrotikLogin"));
 assert.match(voucher,/if\(!result\.username\|\|!result\.password\)/);
 assert.ok(payment.indexOf("await requestJson")<payment.indexOf("submitMikrotikLogin"));
 assert.match(payment,/profile_id:selectedPackage\.profile/);
});
