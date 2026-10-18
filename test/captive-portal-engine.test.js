"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const html=fs.readFileSync(path.join(__dirname,"..","public","login.html"),"utf8");
const script=(html.match(/<script>\s*\(function\(\)\{[\s\S]*?<\/script>/)||[])[0]||"";

test("captive portal parses RouterOS redirect context and submits the canonical MAC login form",()=>{
 assert.match(html,/link-login-only/);
 assert.match(html,/link-orig/);
 assert.match(html,/name="username"/);
 assert.match(html,/name="password"/);
 assert.match(script,/form\.action=device\.login/);
 assert.match(script,/form\.submit\(\)/);
 assert.match(script,/normalizeMac/);
});

test("captive portal uses public branding and settings endpoints without exposing admin endpoints",()=>{
 assert.match(script,/\/api\/hotspot\/public-branding/);
 assert.match(script,/\/api\/settings\/public/);
 assert.match(script,/data\.display_mode==='banner'/);
 assert.match(script,/data\.display_mode==='custom_code'/);
 assert.match(script,/addNoticeTicker/);
 assert.match(script,/applyFeatures/);
 assert.doesNotMatch(script,/\/api\/settings\/general/);
 assert.doesNotMatch(script,/\/api\/packages-admin/);
});

test("captive portal has one master action and routes payment, PIN and QR through the existing backend APIs",()=>{
 assert.equal((html.match(/id="btn-master-action"/g)||[]).length,1);
 assert.match(script,/\/api\/verify-trx/);
 assert.match(script,/\/api\/hotspot-auth\/activate/);
 assert.match(script,/\/api\/hotspot-auth\/claim-voucher/);
 assert.match(script,/\/api\/hotspot-auth\/device-lookup/);
 assert.match(script,/function handleMasterAction/);
 assert.match(script,/function startQrScanner/);
 assert.match(script,/facingMode:'environment'/);
});

test("captive portal includes eight cyclic package palettes and never requires a phone for MAC-bound quick connect",()=>{
 assert.equal((script.match(/\{bg:'rgba\(/g)||[]).length,8);
 assert.match(script,/PALETTES\[index%PALETTES\.length\]/);
 assert.match(script,/body:JSON\.stringify\(\{mac:device\.mac,ip:device\.ip\}\)/);
 assert.match(script,/if\(!pin\)/);
 assert.doesNotMatch(html,/name="phone"[^>]+required/);
});

test("captive portal avoids duplicate inline and listener master-button handlers",()=>{
 assert.doesNotMatch(html,/onclick="handleMasterAction\(\)"/);
 assert.match(script,/byId\('btn-master-action'\)\.addEventListener\('click',handleMasterAction\)/);
});

test("captive portal inline JavaScript parses without syntax errors",()=>{
 const inline=Array.from(html.matchAll(/<script>([\\s\\S]*?)<\\/script>/g)).map(match=>match[1]).find(source=>source.includes("const BACKEND_BASE_URL"));
 assert.ok(inline,"main captive portal script must exist");
 assert.doesNotThrow(()=>new vm.Script(inline,{filename:"public/login.html"}));
});
