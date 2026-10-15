"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {syncHotspotProfileScripts}=require("../jobs/hotspotProfileScriptSync");
const mikrotikService=require("../services/mikrotikService");

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
        {name:"Manual-1h",sharedUsers:"1",sessionTimeout:"1h",raw:{"on-login":customHook}},
        {name:"NewPlan",sharedUsers:"1",sessionTimeout:"1d",raw:{"on-login":customHook}}
      ],
      updateHotspotProfile:async payload=>{updates.push(payload);return {name:payload.name};}
    },
    logger:{log(){},warn(...args){throw new Error(args.join(" "));}}
  };
  const result=await syncHotspotProfileScripts(deps);
  assert.deepEqual(result,{checked:4,updated:4,skipped:1,failed:0,serverAuth:{checked:0,updated:0,skipped:0,failed:0}});
  assert.equal(updates.length,4);
  assert.deepEqual(updates.map(x=>Object.keys(x).sort()),[["name","onLogin"],["name","onLogin"],["name","onLogin"],["name","onLogin"]]);
  const thirty=updates.find(x=>x.name==="30-Day").onLogin;
  const hour=updates.find(x=>x.name==="1-Hour").onLogin;
  const custom=updates.find(x=>x.name==="NewPlan").onLogin;
  const manual=updates.find(x=>x.name==="Manual-1h").onLogin;
  assert.match(thirty,/interval=30d/);
  assert.match(hour,/interval=1h/);
  assert.doesNotMatch(thirty,/FAZ\\|PROFILE=|comment=/);
  assert.doesNotMatch(hour,/FAZ\\|EXP=|FIRST_LOGIN=|comment=/);
  assert.match(custom,/interval=7d/);
  assert.match(manual,/interval=1h/);
  assert.match(manual,/CUSTOM_PROFILE_HOOK/);
  assert.match(custom,/FAZ_CUSTOM_ON_LOGIN_HOOK_START/);
  assert.match(custom,/CUSTOM_PROFILE_HOOK/);
  for(const update of updates){
    assert.equal(Object.keys(update).includes("sessionTimeout"),false);
    assert.equal(Object.keys(update).includes("rateLimit"),false);
  }
});

test("startup sync enforces auth settings on active Hotspot server profiles", async () => {
  const checked = [];
  const deps = {
    db: { query: async () => ({ rows: [{ value: "{}" }] }) },
    mikrotikService: {
      getHotspotProfiles: async () => [],
      getHotspotServers: async () => [
        { name: "hotspot1", profile: "hsprof1" },
        { name: "hotspot2", profile: "hsprof1" },
        { name: "hotspot3", profile: "guest-profile" }
      ],
      ensureHotspotServerProfileAuth: async name => {
        checked.push(name);
        return { name, updated: name === "hsprof1" };
      }
    },
    logger: { log() {}, warn(...args) { throw new Error(args.join(" ")); } }
  };
  const result = await syncHotspotProfileScripts(deps);
  assert.deepEqual(checked, ["hsprof1", "guest-profile"], "each active server profile is synced once");
  assert.deepEqual(result, { checked: 0, updated: 0, skipped: 0, failed: 0, serverAuth: { checked: 0, updated: 0, skipped: 0, failed: 0 } });
});

test("RouterOS server-profile auth writes and verifies MAC/PAP/CHAP with MAC-as-username", async () => {
  const originalWithConnection = mikrotikService._withConnection;
  const state = { ".id": "*1", name: "hsprof1", "login-by": "http-chap", "mac-auth-mode": "mac-as-username-and-password" };
  const calls = [];
  mikrotikService._withConnection = async (_label, callback) => callback({
    async write(command, params) {
      calls.push({ command, params });
      if (command === "/ip/hotspot/profile/print") return [{ ...state }];
      if (command === "/ip/hotspot/profile/set") {
        for (const param of params) {
          if (param.startsWith("=login-by=")) state["login-by"] = param.slice("=login-by=".length);
          if (param.startsWith("=mac-auth-mode=")) state["mac-auth-mode"] = param.slice("=mac-auth-mode=".length);
        }
        return [];
      }
      throw new Error("Unexpected RouterOS command: " + command);
    }
  });
  try {
    const result = await mikrotikService.ensureHotspotServerProfileAuth("hsprof1");
    assert.equal(result.updated, true);
    assert.equal(result.loginBy, "mac,http-pap,http-chap");
    assert.equal(result.macAuthMode, "mac-as-username");
    const setCall = calls.find(call => call.command === "/ip/hotspot/profile/set");
    assert.ok(setCall);
    assert.ok(setCall.params.includes("=login-by=mac,http-pap,http-chap"));
    assert.ok(setCall.params.includes("=mac-auth-mode=mac-as-username"));
    assert.equal(calls.filter(call => call.command === "/ip/hotspot/profile/print").length, 2,
      "the RouterOS settings must be read back after the write");
  } finally {
    mikrotikService._withConnection = originalWithConnection;
  }
});

test("sync result reports server-profile authentication failures separately", async () => {
  const deps = {
    db: { query: async () => ({ rows: [{ value: "{}" }] }) },
    mikrotikService: {
      getHotspotProfiles: async () => [],
      getHotspotServers: async () => [{ name: "hs1", profile: "hsprof1" }],
      ensureHotspotServerProfileAuth: async () => { throw new Error("router write rejected"); }
    },
    logger: { log() {}, warn() {} }
  };
  const result = await syncHotspotProfileScripts(deps);
  assert.equal(result.failed, 1);
  assert.deepEqual(result.serverAuth, { checked: 1, updated: 0, skipped: 0, failed: 1 });
});
