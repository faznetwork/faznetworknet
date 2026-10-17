"use strict";
const test=require("node:test");const assert=require("node:assert/strict");const mikrotikService=require("../services/mikrotikService");
function mockService(rowsByCommand){const service=Object.create(Object.getPrototypeOf(mikrotikService));service._str=value=>String(value??"");const calls=[];service._withConnection=async(_label,callback)=>callback({async write(command,args=[]){calls.push({command,args});if(command.endsWith("/print"))return rowsByCommand[command]||[];return [];}});return {service,calls};}
test("hard purge removes matching sessions, cookies, hosts, user and only that user's schedulers",async()=>{
 const mac="AA:BB:CC:DD:EE:FF";const {service,calls}=mockService({
 "/ip/hotspot/user/print":[{".id":"*u1",name:mac}],
 "/ip/hotspot/active/print":[{".id":"*a1",user:"stale-name","mac-address":mac,address:"10.5.0.8"}],
 "/ip/hotspot/cookie/print":[{".id":"*c1",user:"other","mac-address":mac}],
 "/ip/hotspot/host/print":[{".id":"*h1","mac-address":mac,address:"10.5.0.8"}],
 "/system/scheduler/print":[{".id":"*s1",name:"EXP_"+mac},{".id":"*s2",name:"faz-exp-"+mac},{".id":"*s3",name:"EXP_OTHER"}]});
 const result=await service.cleanupExpiredHotspotUser(mac,mac);
 assert.equal(result.sessionsRemoved,1);assert.equal(result.cookiesRemoved,1);assert.equal(result.hostsRemoved,1);assert.equal(result.usersRemoved,1);assert.equal(result.schedulersRemoved,2);
 const removals=calls.filter(x=>x.command.endsWith("/remove"));assert.deepEqual(removals.map(x=>x.command),["/ip/hotspot/active/remove","/ip/hotspot/cookie/remove","/ip/hotspot/host/remove","/ip/hotspot/user/remove","/system/scheduler/remove","/system/scheduler/remove"]);assert.ok(!removals.some(x=>x.args[0]==="=.id=*s3"));
});
test("profile sync scheduler cleanup removes legacy EXP_ and faz-exp- schedulers",async()=>{
 const {service,calls}=mockService({"/system/scheduler/print":[{".id":"*1",name:"EXP_old"},{".id":"*2",name:"faz-exp-old"},{".id":"*3",name:"keep-this"}]});
 const result=await service.cleanupHotspotExpirationSchedulers();assert.deepEqual(result,{checked:3,removed:2,failed:0});assert.deepEqual(calls.filter(x=>x.command==="/system/scheduler/remove").map(x=>x.args[0]),["=.id=*1","=.id=*2"]);
});
