"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {getPackageDuration}=require("../controllers/hotspotAuthController");
const {resolveHotspotPackage}=require("../services/hotspotProfileConfig");
const {MikroTikService}=require("../services/mikrotikService");

const GB_1=1073741824;
const GB_300=322122547200;
const MAC="AA:BB:CC:DD:EE:01";

test("F5: a 1GB package ignores the router session-timeout and keeps duration zero",()=>{
  // Historical 1GB rows gained expires_at = first_login + 24h/48h because
  // getPackageDuration fell back to the router profile's session-timeout.
  const result=getPackageDuration(
    {validity:"1 gb",data_limit:null,time_limit:null},
    {validityValue:1,validityUnit:"gb",validityLabel:"1 GB",limitBytesTotal:GB_1},
    {name:"1GB",sessionTimeout:"2d"}
  );
  assert.deepEqual(result,{validity:"",duration:0,quota:GB_1});
});

test("F5: a voucher row quota alone declares data-only, even with a router timeout",()=>{
  const result=getPackageDuration(
    {validity:"",data_limit:"2147483648",time_limit:null},
    {},
    {name:"2GB",sessionTimeout:"1d"}
  );
  assert.deepEqual(result,{validity:"",duration:0,quota:2147483648});
});

test("a 30-Day package still resolves to a 30-day duration with no quota",()=>{
  const result=getPackageDuration(
    {validity:"30d",data_limit:null,time_limit:null},
    {validityValue:30,validityUnit:"days",validityLabel:"30 Days",limitBytesTotal:0},
    {name:"30-Day",sessionTimeout:"30d"}
  );
  assert.equal(result.duration,30*24*60*60*1000);
  assert.equal(result.quota,0);
  assert.equal(result.validity,"30d");
});

test("a pure time package with no configured validity still falls back to the router timeout",()=>{
  const result=getPackageDuration(
    {validity:"",data_limit:null,time_limit:null},
    {},
    {name:"Legacy",sessionTimeout:"1d"}
  );
  assert.equal(result.duration,24*60*60*1000);
  assert.equal(result.quota,0);
});

test("300GB metadata resolves to DATA_ONLY with no expiry",()=>{
  const result=resolveHotspotPackage(
    {},
    {validityValue:300,validityUnit:"gb",validityLabel:"300 GB",limitBytesTotal:GB_300}
  );
  assert.equal(result.type,"DATA_ONLY");
  assert.equal(result.durationMs,0);
  assert.equal(result.limitBytesTotal,GB_300);
  assert.equal(result.expiresAt,null);
  assert.equal(result.comment,"FAZ|DATA_ONLY");
});

test("1GB metadata resolves to DATA_ONLY with no expiry",()=>{
  const result=resolveHotspotPackage(
    {},
    {validityValue:1,validityUnit:"gb",validityLabel:"1 GB",limitBytesTotal:GB_1}
  );
  assert.equal(result.type,"DATA_ONLY");
  assert.equal(result.durationMs,0);
  assert.equal(result.limitBytesTotal,GB_1);
  assert.equal(result.expiresAt,null);
});

test("createHotspotUser sends limit-bytes-total for a data user",async()=>{
  const runtime=new MikroTikService();
  const originalWithConnection=runtime._withConnection;
  const calls=[];
  runtime._withConnection=async function(_label,callback){
    const connection={write:async(command,params=[])=>{calls.push({command,params});return [];}};
    return callback(connection);
  };
  try{
    await runtime.createHotspotUser({username:MAC,profile:"1GB",limitBytesTotal:GB_1,comment:"FAZ|DATA_ONLY",server:"all",macAddress:MAC});
    const add=calls.find(c=>c.command==="/ip/hotspot/user/add");
    assert.ok(add);
    assert.ok(add.params.includes("=name="+MAC));
    assert.ok(add.params.includes("=password="+MAC));
    assert.ok(add.params.includes("=profile=1GB"));
    assert.ok(add.params.includes("=comment=FAZ|DATA_ONLY"));
    assert.ok(add.params.includes("=mac-address="+MAC));
    assert.ok(add.params.includes("=limit-bytes-total="+GB_1));
  }finally{runtime._withConnection=originalWithConnection;}
});
