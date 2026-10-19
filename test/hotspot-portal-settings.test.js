"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","public","js","hotspot-portal-settings.js"),"utf8");

test("hotspot portal settings script parses and does not depend on removed URL/default-profile controls",()=>{
 assert.doesNotThrow(()=>new vm.Script(source,{filename:"hotspot-portal-settings.js"}));
 assert.doesNotMatch(source, /\$\('portalLogoUrl'\)|\$\('portalBannerUrl'\)|\$\('portalDefaultProfile'\)/);
 assert.match(source,/async function loadProfiles\(\)/);
 assert.match(source,/Retry profile loading/);
 assert.match(source,/renderPackageRows\(savedPackages/);
});

test("public sale packages are serialized with checkbox state and safe defaults",()=>{
 assert.match(source,/enabled:tr\.querySelector\('\.portal-package-enabled'\)\.checked/);
 assert.match(source,/profileId:tr\.dataset\.profileId/);
 assert.match(source,/Number\(tr\.querySelector\('\.portal-package-price'\)\.value\)\|\|0/);
 assert.match(source,/Array\.isArray\(d\.profiles\)\?d\.profiles/);
});
