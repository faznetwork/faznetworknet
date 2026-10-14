"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {syncHotspotProfileScripts}=require("../jobs/hotspotProfileScriptSync");

test("startup sync normalizes legacy FAZ profiles and preserves unrelated hooks safely",async()=>{
  const updates=[];
  const oldThirtyDay=':local u $user; :if ([:len $uid] > 0) do={ /ip hotspot user set $uid comment=("FAZ|PROFILE=30-Day|VALIDITY=30d|MAC=" . $loginMac); };';
  const oldHour=':local u $user; /ip hotspot user set $uid comment=("FAZ|EXP=0|PROF=1-Hour|VALIDITY=1h|FIRST_LOGIN=" . [/system clock get time]); :local sched ("faz-exp-" . $u); /system scheduler add name=$sched interval=1h;';
  const customHook=':log info "CUSTOM_PROFILE_HOOK";';
  const deps={
    db:{query:async sql=>{assert.match(sql,/hotspot_profile_metadata/);return {rows:[{value:JSON.stringify({NewPlan:{validityValue:7,validityUnit:"days",price:100}})}]};}},
    mikrotikService:{
      getHotspotProfiles:async()=>[
        {name:"30-Day",sharedUsers:"1",sessionTimeout:"4w2d",raw:{"on-login":oldThirtyDay}},
        {name:"1-Hour",sharedUsers:"1",sessionTimeout:"1h",raw:{"on-login":oldHour}},
        {name:"Office-Manual",sharedUsers:"1",sessionTimeout:"none",raw:{"on-login":customHook}},
        {name:"NewPlan",sharedUsers:"1",sessionTimeout:"1d",raw:{"on-login":customHook}}
      ],
      updateHotspotProfile:async payload=>{updates.push(payload);return {name:payload.name};}
    },
    logger:{log(){},warn(...args){throw new Error(args.join(" "));}}
  };
  const result=await syncHotspotProfileScripts(deps);
  assert.deepEqual(result,{checked:3,updated:3,skipped:1,failed:0});
  assert.equal(updates.length,3);
  assert.deepEqual(updates.map(x=>Object.keys(x).sort()),[["name","onLogin"],["name","onLogin"],["name","onLogin"]]);
  const thirty=updates.find(x=>x.name==="30-Day").onLogin;
  const hour=updates.find(x=>x.name==="1-Hour").onLogin;
  const custom=updates.find(x=>x.name==="NewPlan").onLogin;
  assert.match(thirty,/interval=30d/);
  assert.match(hour,/interval=1h/);
  assert.doesNotMatch(thirty,/FAZ\\|PROFILE=|comment=/);
  assert.doesNotMatch(hour,/FAZ\\|EXP=|FIRST_LOGIN=|comment=/);
  assert.match(custom,/interval=7d/);
  assert.match(custom,/FAZ_CUSTOM_ON_LOGIN_HOOK_START/);
  assert.match(custom,/CUSTOM_PROFILE_HOOK/);
  for(const update of updates){
    assert.equal(Object.keys(update).includes("sessionTimeout"),false);
    assert.equal(Object.keys(update).includes("rateLimit"),false);
  }
});
