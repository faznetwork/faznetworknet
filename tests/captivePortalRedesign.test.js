"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const portal=fs.readFileSync(path.join(__dirname,"..","public","login.html"),"utf8");

test("captive portal removes public credential login and keeps supported purchase flows",()=>{
 assert.doesNotMatch(portal,/function submitMemberLogin/);
 assert.doesNotMatch(portal,/api\/hotspot-auth\/direct-login/);
 assert.doesNotMatch(portal,/id="member_username"/);
 assert.doesNotMatch(portal,/id="member_password"/);
 assert.doesNotMatch(portal,/id="m-btn-member"/);
 assert.doesNotMatch(portal,/remember-member/);
 assert.match(portal,/faz-package-selection-colors/);
 assert.match(portal,/linear-gradient\(145deg,#fff4c7 0%,#ffe18a 100%\)/);
 assert.match(portal,/api\/verify-trx/);
 assert.match(portal,/api\/hotspot-auth\/claim-voucher/);
 assert.match(portal,/function startQrScanner\(\)/);
 assert.match(portal,/function submitMikrotikLogin\(mac,redirectUrl\)/);
 assert.match(portal,/form\.submit\(\)/);
 assert.match(portal,/prefers-reduced-motion/);
});
