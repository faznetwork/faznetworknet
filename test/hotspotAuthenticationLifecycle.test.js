"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const mikrotik=require("../services/mikrotikService");

test("renewal writes an exact-second expiry comment and replaces EXP scheduler immediately",async()=>{
  const original=mikrotik._withConnection;
  const calls=[];
  const user={".id":"*1",name:"AA:BB:CC:DD:EE:FF","mac-address":"AA:BB:CC:DD:EE:FF",comment:"Exp: 2026-10-18 12:00:00",profile:"1-Hour",password:"01712345678"};
  mikrotik._withConnection=async(_label,callback)=>callback({write:async(command,params)=>{
    calls.push({command,params});
    if(command==="/ip/hotspot/user/print")return [{...user}];
    if(command==="/system/scheduler/print")return [{".id":"*9",name:"EXP_AA:BB:CC:DD:EE:FF"}];
    if(command==="/ip/hotspot/user/set") {
      for(const param of params){if(param.startsWith("=comment="))user.comment=param.slice(9);if(param.startsWith("=profile="))user.profile=param.slice(9);if(param.startsWith("=password="))user.password=param.slice(10);}
      return [];
    }
    if(command==="/system/scheduler/remove"||command==="/system/scheduler/add"||command==="/ip/hotspot/active/remove")return [];
    if(command==="/ip/hotspot/user/profile/print")return [{name:"1-Hour"}];
    return [];
  }});
  try{
    const result=await mikrotik.rechargeHotspotUser({
      username:"AA:BB:CC:DD:EE:FF",password:"01712345678",profile:"1-Hour",validity:"1h",
      comment:"Exp: 2030-01-02 03:04:05",macAddress:"AA:BB:CC:DD:EE:FF"
    });
    assert.equal(result.created,false);
    assert.equal(user.comment,"Exp: 2030-01-02 03:04:05");
    const remove=calls.find(c=>c.command==="/system/scheduler/remove");
    const add=calls.find(c=>c.command==="/system/scheduler/add");
    assert.ok(remove,"old expiry scheduler must be removed on renewal");
    assert.ok(add,"new expiry scheduler must be created before returning");
    assert.ok(add.params.includes("=name=EXP_AA:BB:CC:DD:EE:FF"));
    assert.ok(add.params.includes("=start-date=jan/02/2030"));
    assert.ok(add.params.includes("=start-time=03:04:05"));
    assert.ok(add.params.some(p=>p.startsWith("=on-event=")&&p.includes("/ip hotspot active remove")&&p.includes("/ip hotspot cookie remove")&&p.includes("/ip hotspot host remove")&&p.includes("/ip hotspot user remove")));
  }finally{mikrotik._withConnection=original;}
});

test("expiry cleanup uses persisted MAC to remove orphaned cookies and host entries",async()=>{
  const original=mikrotik._withConnection;
  const calls=[];
  mikrotik._withConnection=async(_label,callback)=>callback({write:async(command,params)=>{
    calls.push({command,params});
    if(command==="/ip/hotspot/user/print"||command==="/ip/hotspot/active/print"||command==="/system/scheduler/print")return [];
    if(command==="/ip/hotspot/cookie/print")return [{".id":"*2",user:"OLD-USERNAME","mac-address":"AA:BB:CC:DD:EE:FF"}];
    if(command==="/ip/hotspot/host/print")return [{".id":"*3",address:"10.0.0.2","mac-address":"AA:BB:CC:DD:EE:FF"}];
    return [];
  }});
  try{
    const result=await mikrotik.cleanupExpiredHotspotUser("OLD-USERNAME","AA:BB:CC:DD:EE:FF");
    assert.equal(result.cookiesRemoved,1);
    assert.equal(result.hostsRemoved,1);
    assert.ok(calls.some(c=>c.command==="/ip/hotspot/cookie/remove"&&c.params.includes("=.id=*2")));
    assert.ok(calls.some(c=>c.command==="/ip/hotspot/host/remove"&&c.params.includes("=.id=*3")));
  }finally{mikrotik._withConnection=original;}
});
