"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const portal=fs.readFileSync(path.join(__dirname,"..","public","login.html"),"utf8");
const script=[...portal.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)][0]?.[1]||"";

test("captive portal exposes a responsive two-option login design",()=>{
 assert.match(portal,/tab-switcher/);
 assert.match(portal,/id="tab-voucher-btn"/);
 assert.match(portal,/id="tab-recharge-btn"/);
 assert.match(portal,/prefers-reduced-motion/);
 assert.match(portal,/voucher-credential-row/);
 assert.match(portal,/qr-scan-button/);
 assert.doesNotMatch(portal,/m-btn-member|member_username|member_password/);
 assert.doesNotMatch(portal,/Mobile-first FAZ NETWORK captive portal refresh/);
});

test("RouterOS CHAP/PAP submission helper is retained for the verified credentials returned by backend",()=>{
 assert.match(script,/function submitMikrotikLogin\(username,password,redirectUrl\)/);
 assert.match(script,/device\.chapChallenge\?md5Hex\(String\.fromCharCode\(chapIdentifierByte\(device\.chapId\)\)\+rawPassword\+decodeChapChallenge\(device\.chapChallenge\)\):rawPassword/);
 assert.match(script,/form\.submit\(\)/);
 assert.match(script,/id="member_username"/);
});

test("voucher inputs require username and password without remember-member legacy controls",()=>{
 assert.match(portal,/id="voucher_pin"/);
 assert.match(portal,/id="voucher_password"/);
 assert.match(script,/voucher_code:username/);
 assert.match(portal,/autocomplete="username"/);
 assert.match(portal,/autocomplete="current-password"/);
 assert.doesNotMatch(portal,/remember-voucher|remember-member|id="router-error"/);
 assert.match(portal,/\$\(link-login-only\)/);
 assert.match(portal,/\$\(link-orig\)/);
});

test("portal keeps verified payment, voucher claim and QR scanning contracts",()=>{
 assert.match(script,/\/api\/public\/payment\/confirm/);
 assert.match(script,/\/api\/hotspot-auth\/claim-voucher/);
 assert.match(script,/function openQrScanner\(\)/);
 assert.match(script,/submitMikrotikLogin\(result\.username,result\.password,result\.redirect_url\)/);
 assert.match(script,/submitMikrotikLogin\(result\.username\|\|device\.mac,result\.password\|\|device\.mac,result\.redirect_url\)/);
 assert.doesNotThrow(()=>new vm.Script(script,{filename:"public/login.html"}));
});
