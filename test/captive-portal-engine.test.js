"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"..","public","login.html"),"utf8");
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
const script=scripts[0]?.[1]||"";

test("captive portal preserves RouterOS redirect context and the canonical login form",()=>{
 assert.equal(scripts.length,1);
 assert.match(html,/link-login-only/);
 assert.match(html,/link-orig/);
 assert.match(html,/name="username"/);
 assert.match(html,/name="password"/);
 assert.match(script,/login:params\.get\('link-login-only'\)/);
 assert.match(script,/form\.action=device\.login/);
 assert.match(script,/form\.submit\(\)/);
 assert.match(script,/normalizeMac/);
 assert.match(script,/decodeChapChallenge/);
 assert.doesNotThrow(()=>new vm.Script(script,{filename:"public/login.html"}));
});

test("captive portal consumes public settings and never calls protected admin APIs",()=>{
 assert.match(script,/\/api\/public\/portal-config/);
 assert.match(script,/\/api\/public\/payment\/settings/);
 assert.match(script,/display_mode/);
 assert.match(script,/logoUrl/);
 assert.match(script,/bannerUrl/);
 assert.match(script,/features\.online_payment/);
 assert.match(script,/features\.voucher_pin/);
 assert.doesNotMatch(script,/\/api\/settings\/general/);
 assert.doesNotMatch(script,/\/api\/packages-admin/);
 assert.doesNotMatch(script,/\/api\/admin\/hotspot-portal-settings/);
});

test("captive portal exposes only voucher and online recharge choices",()=>{
 assert.equal((html.match(/id="tab-recharge-btn"/g)||[]).length,1);
 assert.equal((html.match(/id="tab-voucher-btn"/g)||[]).length,1);
 assert.match(html,/id="voucher_pin"/);
 assert.match(html,/id="voucher_password"/);
 assert.doesNotMatch(html,/member_username|member_password|m-btn-member|btn-master-action/);
 assert.doesNotMatch(script,/\/api\/hotspot-auth\/activate/);
 assert.doesNotMatch(script,/\/api\/hotspot-auth\/device-lookup/);
});

test("voucher login sends username, password and router context to the existing claim endpoint",()=>{
 assert.match(script,/\/api\/hotspot-auth\/claim-voucher/);
 assert.match(script,/voucher_code:username/);
 assert.match(script,/voucher_password:password/);
 assert.match(script,/mac:device\.mac,ip:device\.ip,login_url:device\.login/);
 assert.match(script,/if\(!result\.username\|\|!result\.password\)/);
 assert.match(script,/submitMikrotikLogin\(result\.username,result\.password,result\.redirect_url\)/);
});

test("online recharge verifies payment through the existing public API before RouterOS login",()=>{
 assert.match(script,/\/api\/public\/payment\/confirm/);
 assert.match(script,/service_type:'hotspot'/);
 assert.match(script,/profile_id:selectedPackage\.profile/);
 assert.match(script,/payload\.senderPhoneNumber=phone/);
 assert.match(script,/payload\.trxId=trx/);
 assert.match(script,/submitMikrotikLogin\(result\.username\|\|device\.mac,result\.password\|\|device\.mac,result\.redirect_url\)/);
});

test("QR scanner handles credentials and stops camera resources on completion or cancellation",()=>{
 assert.match(script,/function parseQrCredentials/);
 assert.match(script,/BarcodeDetector/);
 assert.match(script,/getUserMedia/);
 assert.match(script,/function stopQrScanner/);
 assert.match(script,/track\.stop\(\)/);
 assert.match(script,/function closeQrScanner/);
 assert.match(html,/id="qr-scanner-modal"/);
 assert.match(html,/id="qr-scan-button"/);
});

test("online TrxID checkout does not require a customer phone when sender-phone verification is not configured",()=>{
 const start=script.indexOf("async function handleVerification()");
 const end=script.indexOf("function parseQrCredentials",start);
 const handler=script.slice(start,end);
 assert.ok(start>=0&&end>start,"online checkout handler must exist");
 assert.match(handler,/verificationMethod==='senderPhoneNumber'/);
 assert.match(handler,/trx\.length<4/);
 assert.doesNotMatch(handler,/direct_subscriber_phone/);
 assert.doesNotMatch(handler,/INVALID_ACCOUNT_PHONE/);
});
