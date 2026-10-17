"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),mikrotik=require("../services/mikrotikService");
const MAC="AA:BB:CC:DD:EE:FF";
function findParam(calls,command,prefix){const call=calls.find(x=>x.command===command);assert.ok(call,"missing "+command);return call.params.find(x=>x.startsWith(prefix));}
test("createHotspotUser uses normalized MAC for name/password/mac-address and no scheduler",async()=>{
 const old=mikrotik._withConnection,calls=[];mikrotik._withConnection=async(_l,fn)=>fn({write:async(command,params)=>{calls.push({command,params});return [];}});
 try{const result=await mikrotik.createHotspotUser({username:"aa-bb-cc-dd-ee-ff",password:"01712345678",profile:"Gold",macAddress:"aa-bb-cc-dd-ee-ff",validity:"1h"});assert.equal(result.username,MAC);assert.equal(result.password,MAC);assert.equal(findParam(calls,"/ip/hotspot/user/add","=name="),"=name="+MAC);assert.equal(findParam(calls,"/ip/hotspot/user/add","=password="),"=password="+MAC);assert.equal(findParam(calls,"/ip/hotspot/user/add","=mac-address="),"=mac-address="+MAC);assert.ok(!calls.some(c=>c.command.startsWith("/system/scheduler/")));}finally{mikrotik._withConnection=old;}
});
test("rechargeHotspotUser ignores supplied phone password and never schedules expiry",async()=>{
 const old=mikrotik._withConnection,calls=[];mikrotik._withConnection=async(_l,fn)=>fn({write:async(command,params)=>{calls.push({command,params});if(command==="/ip/hotspot/user/print")return [{".id":"*1",name:MAC}];return [];}});
 try{await mikrotik.rechargeHotspotUser({username:MAC,password:"01712345678",profile:"Gold",validity:"1h",macAddress:MAC});assert.equal(findParam(calls,"/ip/hotspot/user/set","=name="),"=name="+MAC);assert.equal(findParam(calls,"/ip/hotspot/user/set","=password="),"=password="+MAC);assert.equal(findParam(calls,"/ip/hotspot/user/set","=mac-address="),"=mac-address="+MAC);assert.ok(!calls.some(c=>c.command.startsWith("/system/scheduler/")));}finally{mikrotik._withConnection=old;}
});
test("updateHotspotUser forces MAC password even when caller passes phone",async()=>{
 const old=mikrotik._withConnection,calls=[];mikrotik._withConnection=async(_l,fn)=>fn({write:async(command,params)=>{calls.push({command,params});if(command==="/ip/hotspot/user/print")return [{".id":"*1",name:MAC,comment:"Exp: 2030-01-02 03:04:05"}];if(command==="/ip/hotspot/user/profile/print")return [{name:"Gold"}];return [];}});
 try{await mikrotik.updateHotspotUser(MAC,"Gold","Exp: 2030-01-02 03:04:05","01712345678",MAC);assert.equal(findParam(calls,"/ip/hotspot/user/set","=name="),"=name="+MAC);assert.equal(findParam(calls,"/ip/hotspot/user/set","=password="),"=password="+MAC);assert.equal(findParam(calls,"/ip/hotspot/user/set","=mac-address="),"=mac-address="+MAC);assert.ok(!calls.some(c=>c.command.startsWith("/system/scheduler/")));}finally{mikrotik._withConnection=old;}
});
test("non-MAC identities cannot be provisioned",async()=>{await assert.rejects(()=>mikrotik.createHotspotUser({username:"FAZ-123456",password:"123456",profile:"Gold"}),/valid device MAC address/);await assert.rejects(()=>mikrotik.rechargeHotspotUser({username:"PENDING-01712345678",password:"01712345678",profile:"Gold",validity:"1h"}),/valid device MAC/);});

test("server-profile sync always enforces MAC, PAP, CHAP and MAC-cookie login",async()=>{
 const old=mikrotik._withConnection,calls=[],profile={".id":"*1",name:"hotspot1","login-by":"http-pap,http-chap"};
 mikrotik._withConnection=async(_l,fn)=>fn({write:async(command,params)=>{
  calls.push({command,params});
  if(command==="/ip/hotspot/profile/print")return [{...profile}];
  if(command==="/ip/hotspot/profile/set"){const p=params.find(x=>x.startsWith("=login-by="));if(p)profile["login-by"]=p.slice("=login-by=".length);return [];}
  return [];
 }});
 try{const result=await mikrotik.ensureHotspotServerProfileAuth("hotspot1","credentials");assert.equal(result.loginBy,"mac,http-pap,http-chap,mac-cookie");assert.ok(calls.some(c=>c.command==="/ip/hotspot/profile/set"&&c.params.includes("=login-by=mac,http-pap,http-chap,mac-cookie")));}finally{mikrotik._withConnection=old;}
});
