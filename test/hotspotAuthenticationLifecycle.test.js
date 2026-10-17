"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),mikrotik=require("../services/mikrotikService");
const MAC="AA:BB:CC:DD:EE:FF";
test("recharge enforces MAC credentials and never creates expiry schedulers",async()=>{
 const original=mikrotik._withConnection,calls=[],user={".id":"*1",name:MAC,"mac-address":MAC,comment:"Exp: 2026-10-18 12:00:00",profile:"1-Hour",password:"01712345678"};
 mikrotik._withConnection=async(_label,fn)=>fn({write:async(command,params)=>{calls.push({command,params});if(command==="/ip/hotspot/user/print")return [{...user}];if(command==="/ip/hotspot/user/set"){for(const p of params){if(p.startsWith("=comment="))user.comment=p.slice(9);if(p.startsWith("=password="))user.password=p.slice(10);}return [];}if(command==="/ip/hotspot/active/print")return [];return [];}});
 try{await mikrotik.rechargeHotspotUser({username:MAC,password:"01712345678",profile:"1-Hour",validity:"1h",comment:"Exp: 2030-01-02 03:04:05",macAddress:MAC});const set=calls.find(c=>c.command==="/ip/hotspot/user/set");assert.ok(set.params.includes("=name="+MAC));assert.ok(set.params.includes("=password="+MAC));assert.ok(set.params.includes("=mac-address="+MAC));assert.equal(user.password,MAC);assert.ok(!calls.some(c=>c.command.startsWith("/system/scheduler/")));}finally{mikrotik._withConnection=original;}
});
test("expiry cleanup removes orphaned cookies and host entries using persisted MAC",async()=>{
 const original=mikrotik._withConnection,calls=[];mikrotik._withConnection=async(_label,fn)=>fn({write:async(command,params)=>{calls.push({command,params});if(command==="/ip/hotspot/user/print"||command==="/ip/hotspot/active/print"||command==="/system/scheduler/print")return [];if(command==="/ip/hotspot/cookie/print")return [{".id":"*2",user:"OLD-USERNAME","mac-address":MAC}];if(command==="/ip/hotspot/host/print")return [{".id":"*3",address:"10.0.0.2","mac-address":MAC}];return [];}});
 try{const result=await mikrotik.cleanupExpiredHotspotUser("OLD-USERNAME",MAC);assert.equal(result.cookiesRemoved,1);assert.equal(result.hostsRemoved,1);assert.ok(calls.some(c=>c.command==="/ip/hotspot/cookie/remove"&&c.params.includes("=.id=*2")));assert.ok(calls.some(c=>c.command==="/ip/hotspot/host/remove"&&c.params.includes("=.id=*3")));}finally{mikrotik._withConnection=original;}
});
