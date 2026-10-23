"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const html=fs.readFileSync(path.join(__dirname,"../public/login.html"),"utf8");

test("RouterOS captive portal parses CHAP and redirect query parameters",()=>{
  assert.match(html,/params\.get\('mac'\)/);
  assert.match(html,/params\.get\('ip'\)/);
  assert.match(html,/params\.get\('link-login-only'\)/);
  assert.match(html,/params\.get\('chap-id'\)/);
  assert.match(html,/params\.get\('chap-challenge'\)/);
  assert.match(html,/name="chap-id"/);
  assert.match(html,/name="chap-challenge"/);
  assert.match(html,/device\.chapChallenge\?md5Hex\(/);
  assert.match(html,/decodeChapChallenge\(device\.chapChallenge\)/);
  assert.match(html,/form\.submit\(\)/);
});

test("embedded MD5 and RouterOS CHAP byte decoding match known vectors",()=>{
  const start=html.indexOf("function chapIdentifierByte(value){");
  const end=html.indexOf("function submitMikrotikLogin(username,password,redirectUrl){",start);
  assert.ok(start>=0&&end>start,"self-contained CHAP helper functions must exist");
  const helperSource=html.slice(start,end);
  const context={};
  vm.runInNewContext(helperSource+";globalThis.md5Hex=md5Hex;globalThis.chapIdentifierByte=chapIdentifierByte;globalThis.decodeChapChallenge=decodeChapChallenge;",context);
  assert.equal(context.md5Hex(""),"d41d8cd98f00b204e9800998ecf8427e");
  assert.equal(context.md5Hex("abc"),"900150983cd24fb0d6963f7d28e17f72");
  assert.equal(context.md5Hex(String.fromCharCode(0)+"passwordchallenge"),"37f46edfac1bf2d324dac8d245baba18");
  assert.equal(context.chapIdentifierByte(String.fromCharCode(92)+"371"),249);
  const octal=context.decodeChapChallenge(String.fromCharCode(92)+"357"+String.fromCharCode(92)+"015");
  assert.equal(octal,String.fromCharCode(239,13));
  assert.equal(context.decodeChapChallenge("ef0d"),String.fromCharCode(239,13));
});

test("Force Provision checks the applicable RouterOS login-by profile and clears only matching sessions/cookies",()=>{
  const service=fs.readFileSync(path.join(__dirname,"../services/mikrotikService.js"),"utf8");
  const start=service.indexOf("async forceProvisionHotspotUser(data)");
  const end=service.indexOf("async rechargeHotspotUser(data)",start);
  assert.ok(start>=0&&end>start,"force provision method must exist");
  const source=service.slice(start,end);
  assert.match(source,/\/ip\/hotspot\/active\/print/);
  assert.match(source,/\/ip\/hotspot\/active\/remove/);
  assert.match(source,/\/ip\/hotspot\/cookie\/print/);
  assert.match(source,/\/ip\/hotspot\/cookie\/remove/);
  assert.match(source,/includes\("mac"\)/);
  assert.match(source,/macAuthEnabled/);
});
