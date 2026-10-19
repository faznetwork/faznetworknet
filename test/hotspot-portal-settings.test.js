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
