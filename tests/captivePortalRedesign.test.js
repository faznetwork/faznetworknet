"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const portal=fs.readFileSync(path.join(__dirname,"..","public","login.html"),"utf8");

test("captive portal exposes mobile-first login modes and fast responsive styling",()=>{
 assert.match(portal,/Mobile-first FAZ NETWORK captive portal refresh/);
 assert.match(portal,/id="m-btn-pin"/);
 assert.match(portal,/id="m-btn-member"/);
 assert.match(portal,/id="m-btn-online"/);
 assert.match(portal,/prefers-reduced-motion/);
 assert.match(portal,/Connected to Fast Network/);
});

test("member login preserves RouterOS PAP and CHAP login handling",()=>{
 assert.doesNotMatch(portal,/function submitMemberLogin\(\)/);
 assert.match(portal,/device\.chapChallenge\?md5Hex\(String\.fromCharCode\(chapIdentifierByte\(device\.chapId\)\)\+verified\.password\+decodeChapChallenge\(device\.chapChallenge\)\):verified\.password/);
 assert.doesNotMatch(portal,/api\/hotspot-auth\/direct-login/);
 assert.match(portal,/form\.submit\(\)/);
 assert.doesNotMatch(portal,/id="member_username"/);
 assert.doesNotMatch(portal,/id="member_password"/);
 assert.match(portal,/toggle-member-password/);
});

test("voucher and transaction inputs normalize values and respect opt-in remember controls",()=>{
 assert.match(portal,/voucher_pin.*toUpperCase/s);
 assert.match(portal,/remember-voucher/);
 assert.match(portal,/remember-member/);
 assert.match(portal,/id="router-error"/);
 assert.match(portal,/\$\(link-login-only\)/);
 assert.match(portal,/\$\(link-orig\)/);
});

test("portal keeps existing payment, voucher claim, and QR flows",()=>{
 assert.match(portal,/\/api\/verify-trx/);
 assert.match(portal,/\/api\/hotspot-auth\/claim-voucher/);
 assert.match(portal,/function startQrScanner\(\)/);
 assert.match(portal,/submitMikrotikLogin\(result\.username\|\|device\.mac,result\.redirect_url\)/);
});
