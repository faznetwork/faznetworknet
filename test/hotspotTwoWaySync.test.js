"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const controller=require("../controllers/hotspotController");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");

const MAC_A="AA:BB:CC:DD:EE:01";
const MAC_B="AA:BB:CC:DD:EE:02";
const MAC_C="AA:BB:CC:DD:EE:03";
const MAC_D="AA:BB:CC:DD:EE:04";
function response(){
  return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}

test("Import sync never overwrites Panel rows and never resurrects terminal rows",async()=>{
  const originalQuery=db.query,originalTransaction=db.withTransaction,originalGetUsers=mikrotik.getHotspotUsers;
  const queries=[];
  db.query=async(sql,params=[])=>{
    queries.push({sql,params,scope:"pool"});
    throw new Error("Unexpected pool database query: "+sql);
  };
  db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
    queries.push({sql,params,scope:"transaction"});
    if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
    if(sql.startsWith("SELECT id,status FROM hotspot_vouchers"))return {rows:String(params[0]).toLowerCase()===MAC_A.toLowerCase()?[{id:17,status:"active"}]:[]};
    if(sql.startsWith("INSERT INTO hotspot_vouchers"))return {rows:[{id:22}]};
    throw new Error("Unexpected transactional database query: "+sql);
  }});
  mikrotik.getHotspotUsers=async()=>[
    {username:MAC_A.toLowerCase(),password:MAC_A,profile:"Gold",comment:"Exp: 2030-01-02 03:04:05"},
    {username:MAC_B,password:MAC_B,profile:"Silver",comment:"Exp: 2030-01-03 04:05:06"},
    {username:"legacy-random-user",password:"pin",profile:"Gold",comment:"legacy"}
  ];
  try{
    const res=response();
    await controller.importFromMikrotik({},res);
    assert.equal(res.statusCode,200);
    assert.deepEqual(res.body,{success:true,imported:1,skipped:1,skippedExisting:1});
    const locks=queries.filter(q=>q.sql.startsWith("SELECT pg_advisory_xact_lock"));
    assert.equal(locks.length,2,"valid MAC imports should serialize per identity");
    const lookups=queries.filter(q=>q.sql.startsWith("SELECT id,status FROM hotspot_vouchers"));
    assert.equal(lookups.length,2);
    assert.ok(lookups.every(q=>q.sql.includes("LOWER(mac_address)=LOWER($1)")&&q.sql.includes("LOWER(username)=LOWER($1)")));
    // Panel is the master: the existing row is left untouched — no UPDATE
    // may run for it, so its profile/expiry/status cannot be overwritten
    // and an expired/deleted/archived row cannot be resurrected.
    assert.equal(queries.some(q=>q.sql.startsWith("UPDATE hotspot_vouchers")),false,"import must never update an existing panel row");
    const insert=queries.find(q=>q.sql.startsWith("INSERT INTO hotspot_vouchers"));
    assert.ok(insert,"new MAC identity should be inserted");
    assert.equal(insert.params[0],MAC_B);
    assert.equal(insert.params[1],MAC_B);
    assert.equal(insert.params[2],"Silver");
    assert.equal(insert.params[4],"Unlinked");
    assert.equal(insert.params[5],"all");
    assert.equal(insert.params[7],MAC_B);
    assert.match(insert.sql,/Imported Subscriber/);
    assert.doesNotMatch(insert.sql,/ON CONFLICT/i,"import must not assume a username unique constraint");
  }finally{
    db.query=originalQuery;
    db.withTransaction=originalTransaction;
    mikrotik.getHotspotUsers=originalGetUsers;
  }
});

test("Import sync leaves a terminal row untouched after a concurrent unique-key race",async()=>{
  const originalQuery=db.query,originalTransaction=db.withTransaction,originalGetUsers=mikrotik.getHotspotUsers;
  const queries=[];
  db.withTransaction=async callback=>callback({query:async(sql,params=[])=>{
    queries.push({sql,params,scope:"transaction"});
    if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
    if(sql.startsWith("SELECT id,status FROM hotspot_vouchers"))return {rows:[]};
    if(sql.startsWith("INSERT INTO hotspot_vouchers")){const error=new Error("duplicate key");error.code="23505";throw error;}
    throw new Error("Unexpected transactional database query: "+sql);
  }});
  db.query=async(sql,params=[])=>{
    queries.push({sql,params,scope:"pool"});
    if(sql.startsWith("SELECT id,status FROM hotspot_vouchers"))return {rows:[{id:99,status:"expired"}]};
    throw new Error("Unexpected pool database query: "+sql);
  };
  mikrotik.getHotspotUsers=async()=>[{username:MAC_A,profile:"Gold",comment:"Exp: 2030-01-02 03:04:05"}];
  try{
    const res=response();
    await controller.importFromMikrotik({},res);
    assert.equal(res.statusCode,200);
    assert.deepEqual(res.body,{success:true,imported:0,skipped:0,skippedExisting:1});
    assert.ok(queries.some(q=>q.scope==="pool"&&q.sql.startsWith("SELECT id,status FROM hotspot_vouchers")));
    assert.equal(queries.some(q=>q.sql.startsWith("UPDATE hotspot_vouchers")),false,"the raced terminal row must not be reactivated");
  }finally{
    db.query=originalQuery;
    db.withTransaction=originalTransaction;
    mikrotik.getHotspotUsers=originalGetUsers;
  }
});

test("Push endpoint pushes only live active vouchers, including PIN vouchers without a MAC",async()=>{
  const originalQuery=db.query,originalSync=mikrotik.syncHotspotUsers;
  let selectedSql="",sent=[];
  db.query=async(sql)=>{
    if(String(sql).includes("SELECT value FROM app_settings"))return {rows:[{value:"{}"}]};
    selectedSql=sql;return {rows:[
    {id:1,username:MAC_A,password:MAC_A,profile:"Gold",validity:"1d",status:"active",server:"all",mac_address:MAC_A,data_limit:null,time_limit:null,expires_at:new Date("2030-01-02T03:04:05+06:00"),created_at:new Date("2030-01-01T03:04:05+06:00")},
    {id:2,username:"PIN1234",password:"PINPASS",profile:"Gold",validity:"1d",status:"active",server:"all",mac_address:null,data_limit:null,time_limit:null,expires_at:new Date("2030-01-02T03:04:05+06:00"),created_at:new Date("2030-01-01T03:04:05+06:00")},
    {id:3,username:MAC_B,password:MAC_B,profile:"Gold",validity:"1d",status:"active",server:"all",mac_address:MAC_B,data_limit:null,time_limit:null,expires_at:new Date("2020-01-02T03:04:05+06:00"),created_at:new Date("2020-01-01T03:04:05+06:00")},
    {id:4,username:MAC_C,password:MAC_C,profile:"Gold",validity:"1d",status:"unused",server:"all",mac_address:MAC_C,data_limit:null,time_limit:null,expires_at:new Date("2030-01-02T03:04:05+06:00"),created_at:new Date("2030-01-01T03:04:05+06:00")}
  ]};};
  mikrotik.syncHotspotUsers=async(vouchers)=>{sent=vouchers;return {provisioned:2,refreshed:0,skipped:0,disconnected:0,failed:[]};};
  try{
    const res=response();
    await controller.pushToMikrotik({},res);
    assert.equal(res.statusCode,200);
    assert.match(selectedSql,/status='active'/);
    assert.doesNotMatch(selectedSql,/'unused'/);
    assert.doesNotMatch(selectedSql,/mac_address IS NOT NULL/);
    assert.equal(sent.length,2);
    assert.equal(sent[0].username,MAC_A);
    assert.equal(sent[0].macAddress,MAC_A);
    assert.equal(sent[0].comment,"Exp: 2030-01-02 03:04:05");
    assert.equal(sent[1].username,"PIN1234");
    assert.equal(sent[1].password,"PINPASS");
    assert.equal(sent[1].macAddress,"");
    assert.equal(sent[1].comment,"Exp: 2030-01-02 03:04:05");
    assert.deepEqual(res.body,{success:true,provisioned:2,refreshed:0,skipped:2,failed:[],disconnected:0});
  }finally{
    db.query=originalQuery;
    mikrotik.syncHotspotUsers=originalSync;
  }
});

test("Push endpoint pushes a data voucher with FAZ|DATA_ONLY and its byte quota, never an expiry",async()=>{
  const originalQuery=db.query,originalSync=mikrotik.syncHotspotUsers;
  let sent=[];
  db.query=async(sql)=>{
    if(String(sql).includes("SELECT value FROM app_settings"))return {rows:[{value:JSON.stringify({"1GB":{price:10,validityValue:1,validityUnit:"gb",validityLabel:"1 GB",limitBytesTotal:1073741824}})}]};
    return {rows:[
    {id:5,username:MAC_C,password:MAC_C,profile:"1GB",validity:"Data / quota package",status:"active",server:"all",mac_address:MAC_C,data_limit:null,time_limit:null,expires_at:null,created_at:new Date("2030-01-01T03:04:05+06:00")},
    {id:6,username:MAC_D,password:MAC_D,profile:"1GB",validity:"",status:"active",server:"all",mac_address:MAC_D,data_limit:"2147483648",time_limit:null,expires_at:null,created_at:new Date("2030-01-01T03:04:05+06:00")},
    {id:7,username:"PIN9999",password:"PINPASS",profile:"1GB",validity:"",status:"active",server:"all",mac_address:null,data_limit:null,time_limit:null,expires_at:null,created_at:new Date("2030-01-01T03:04:05+06:00")}
  ]};};
  mikrotik.syncHotspotUsers=async(vouchers)=>{sent=vouchers;return {provisioned:3,refreshed:0,skipped:0,disconnected:0,failed:[]};};
  try{
    const res=response();
    await controller.pushToMikrotik({},res);
    assert.equal(res.statusCode,200);
    assert.equal(sent.length,3);
    assert.equal(sent[0].comment,"FAZ|DATA_ONLY");
    assert.equal(sent[0].limitBytesTotal,1073741824);
    assert.equal(sent[0].expired,false);
    assert.equal(sent[1].comment,"FAZ|DATA_ONLY");
    assert.equal(sent[1].limitBytesTotal,2147483648);
    // A PIN voucher with no row quota still gets its quota from core metadata.
    assert.equal(sent[2].username,"PIN9999");
    assert.equal(sent[2].limitBytesTotal,1073741824);
    assert.deepEqual(res.body,{success:true,provisioned:3,refreshed:0,skipped:0,failed:[],disconnected:0});
  }finally{
    db.query=originalQuery;
    mikrotik.syncHotspotUsers=originalSync;
  }
});

test("RouterOS push never re-creates an expired user, sets data quotas, and keeps going after one failure",async()=>{
  const routerRuntime = new (require('../services/mikrotikService').MikroTikService)();
  const originalWithConnection=routerRuntime._withConnection;
  const calls=[];
  routerRuntime._withConnection=async function(_label,callback){
    const connection={write:async(command,params=[])=>{
      calls.push({command,params});
      if(command==="/ip/hotspot/user/print")return [{".id":"*1",name:MAC_A,profile:"Old",comment:"Exp: 2029-01-01 00:00:00"}];
      if(command==="/ip/hotspot/user/add"&&params.includes("=name="+MAC_D))throw new Error("RouterOS rejected user");
      return [];
    }};
    return callback(connection);
  };
  try{
    const result=await routerRuntime.syncHotspotUsers([
      {username:MAC_A,password:MAC_A,macAddress:MAC_A,profile:"Gold",comment:"Exp: 2030-01-02 03:04:05",expired:false,limitBytesTotal:0},
      {username:MAC_B,password:MAC_B,macAddress:MAC_B,profile:"Silver",comment:"Exp: 2020-01-02 03:04:05",expired:true,limitBytesTotal:0},
      {username:MAC_C,password:MAC_C,macAddress:MAC_C,profile:"1GB",comment:"FAZ|DATA_ONLY",expired:false,limitBytesTotal:1073741824},
      {username:MAC_D,password:MAC_D,macAddress:MAC_D,profile:"Gold",comment:"Exp: 2030-01-02 03:04:05",expired:false,limitBytesTotal:0}
    ]);
    assert.deepEqual(result,{provisioned:1,refreshed:1,skipped:1,disconnected:0,failed:[{username:MAC_D,error:"RouterOS rejected user"}]});
    const set=calls.find(c=>c.command==="/ip/hotspot/user/set");
    assert.ok(set);
    assert.ok(set.params.includes("=.id=*1"));
    assert.ok(set.params.includes("=profile=Gold"));
    assert.ok(set.params.includes("=comment=Exp: 2030-01-02 03:04:05"));
    assert.ok(set.params.includes("=limit-bytes-total="),"a time-only refresh must clear any stale data quota");
    assert.ok(!set.params.some(p=>p.startsWith("=password=")),"refresh must not reset credentials or session");
    const adds=calls.filter(c=>c.command==="/ip/hotspot/user/add");
    assert.equal(adds.length,2,"the data user and the failing user are both attempted");
    const dataAdd=adds.find(c=>c.params.includes("=name="+MAC_C));
    assert.ok(dataAdd);
    assert.ok(dataAdd.params.includes("=password="+MAC_C));
    assert.ok(dataAdd.params.includes("=mac-address="+MAC_C));
    assert.ok(dataAdd.params.includes("=limit-bytes-total=1073741824"));
    assert.ok(!adds.some(c=>c.params.includes("=name="+MAC_B)),"an expired user must never be re-created");
    assert.ok(!calls.some(c=>c.command==="/ip/hotspot/active/remove"),"push must not disconnect sessions");
    assert.ok(!calls.some(c=>c.command==="/ip/hotspot/user/reset-counters"));
  }finally{routerRuntime._withConnection=originalWithConnection;}
});
