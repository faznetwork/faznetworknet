"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {createHotspotAutoHeal}=require("../jobs/hotspotAutoHeal");

const MAC_A="AA:BB:CC:DD:EE:01";
const MAC_B="AA:BB:CC:DD:EE:02";
const MAC_C="AA:BB:CC:DD:EE:03";

function buildDeps({profiles, users, vouchers, metadata}) {
  const statements=[];
  const calls={profiles:[],users:[]};
  const db={
    async query(sql){
      statements.push(sql);
      if(String(sql).includes("app_settings"))return {rows:[{value:JSON.stringify(metadata)}]};
      if(String(sql).includes("FROM hotspot_vouchers"))return {rows:vouchers};
      throw new Error("Auto-heal must never write to the database: "+sql);
    }
  };
  const mikrotikService={
    async getHotspotProfiles(){return profiles;},
    async getHotspotUsers(){return users;},
    async createHotspotProfile(data){calls.profiles.push(data);return {name:data.name};},
    async createHotspotUser(data){calls.users.push(data);return {username:data.username||data.macAddress};},
  };
  const logger={log(){},warn(){},error(){}};
  return {db,mikrotikService,logger,statements,calls};
}

const METADATA={
  "30-Day":{price:150,validityValue:30,validityUnit:"days",validityLabel:"30 Days",limitBytesTotal:0},
  "1GB":{price:10,validityValue:1,validityUnit:"gb",validityLabel:"1 GB",limitBytesTotal:1073741824},
  "300GB (Unlimited)":{price:250,validityValue:300,validityUnit:"gb",validityLabel:"300 GB",limitBytesTotal:322122547200}
};

test("auto-heal re-creates missing panel profiles and missing active users, and nothing else",async()=>{
  const deps=buildDeps({
    profiles:[{name:"30-Day",sessionTimeout:"30d"}],
    users:[],
    vouchers:[
      {id:1,username:MAC_A,profile:"30-Day",server:"all",mac_address:MAC_A,data_limit:null,expires_at:new Date("2030-01-02T03:04:05+06:00")},
      {id:2,username:MAC_B,profile:"1GB",server:"all",mac_address:MAC_B,data_limit:"1073741824",expires_at:null},
      {id:3,username:MAC_C,profile:"30-Day",server:"all",mac_address:MAC_C,data_limit:null,expires_at:new Date("2020-01-02T03:04:05+06:00")},
      {id:4,username:"PIN7777",profile:"1GB",server:"all",mac_address:null,data_limit:"1073741824",expires_at:null}
    ],
    metadata:METADATA
  });
  const heal=createHotspotAutoHeal(deps);
  const result=await heal.run();
  assert.deepEqual(result,{profilesChecked:2,profilesCreated:2,profilesFailed:0,usersChecked:4,usersHealed:2,usersSkipped:2,usersFailed:0});
  assert.equal(deps.statements.some(sql=>/^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql)),false,"auto-heal must never write to the database");
  const createdProfiles=deps.calls.profiles.map(call=>call.name);
  assert.deepEqual(createdProfiles,["1GB","300GB (Unlimited)"]);
  const oneGb=deps.calls.profiles.find(call=>call.name==="1GB");
  assert.equal(oneGb.clearSessionTimeout,true,"a GB profile must not carry a session-timeout");
  assert.equal(oneGb.sessionTimeout,"");
  assert.match(oneGb.onLogin,/FAZ_HOTSPOT_SESSION_BINDING_V4/);
  const threeHundredGb=deps.calls.profiles.find(call=>call.name==="300GB (Unlimited)");
  assert.equal(threeHundredGb.clearSessionTimeout,true);
  assert.equal(deps.calls.users.length,2);
  const timeUser=deps.calls.users.find(call=>call.macAddress===MAC_A);
  assert.ok(timeUser);
  assert.equal(timeUser.profile,"30-Day");
  assert.equal(timeUser.comment,"Exp: 2030-01-02 03:04:05");
  assert.equal(timeUser.limitBytesTotal,undefined);
  const dataUser=deps.calls.users.find(call=>call.macAddress===MAC_B);
  assert.ok(dataUser);
  assert.equal(dataUser.profile,"1GB");
  assert.equal(dataUser.limitBytesTotal,1073741824);
  assert.equal(dataUser.comment,"FAZ|DATA_ONLY");
  assert.equal(deps.calls.users.some(call=>call.macAddress===MAC_C),false,"an expired voucher is never healed");
  assert.equal(deps.calls.users.some(call=>String(call.username||"").includes("PIN7777")),false,"a PIN voucher with no bound MAC has no router user to heal");
});

test("auto-heal leaves everything alone when the router already matches the panel",async()=>{
  const deps=buildDeps({
    profiles:[{name:"30-Day"},{name:"1GB"},{name:"300GB (Unlimited)"}],
    users:[{username:MAC_A},{username:MAC_B}],
    vouchers:[
      {id:1,username:MAC_A,profile:"30-Day",server:"all",mac_address:MAC_A,data_limit:null,expires_at:new Date("2030-01-02T03:04:05+06:00")},
      {id:2,username:MAC_B,profile:"1GB",server:"all",mac_address:MAC_B,data_limit:"1073741824",expires_at:null}
    ],
    metadata:METADATA
  });
  const heal=createHotspotAutoHeal(deps);
  const result=await heal.run();
  assert.deepEqual(result,{profilesChecked:0,profilesCreated:0,profilesFailed:0,usersChecked:2,usersHealed:0,usersSkipped:0,usersFailed:0});
  assert.equal(deps.calls.profiles.length,0);
  assert.equal(deps.calls.users.length,0);
});

test("auto-heal records a failed profile and keeps healing the rest",async()=>{
  const deps=buildDeps({
    profiles:[],
    users:[],
    vouchers:[],
    metadata:METADATA
  });
  deps.mikrotikService.createHotspotProfile=async(data)=>{
    if(data.name==="1GB")throw new Error("RouterOS rejected profile");
    deps.calls.profiles.push(data);
    return {name:data.name};
  };
  const heal=createHotspotAutoHeal(deps);
  const result=await heal.run();
  assert.equal(result.profilesChecked,3);
  assert.equal(result.profilesCreated,2);
  assert.equal(result.profilesFailed,1);
});
