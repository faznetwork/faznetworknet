"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const controller=require("../controllers/hotspotController");
const db=require("../db");
const mikrotik=require("../services/mikrotikService");

const MAC_A="AA:BB:CC:DD:EE:01";
const MAC_B="AA:BB:CC:DD:EE:02";
function response(){
  return {statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
}

test("Import sync updates router-owned fields only and preserves existing subscriber metadata",async()=>{
  const originalQuery=db.query,originalGetUsers=mikrotik.getHotspotUsers;
  const queries=[];
  db.query=async(sql,params=[])=>{
    queries.push({sql,params});
    if(sql.startsWith("SELECT id FROM hotspot_vouchers")) {
      return {rows:String(params[0]).toLowerCase()===MAC_A.toLowerCase()?[{id:17}]:[]};
    }
    if(sql.startsWith("UPDATE hotspot_vouchers SET profile="))return {rowCount:1,rows:[]};
    if(sql.startsWith("INSERT INTO hotspot_vouchers"))return {rows:[{id:22}]};
    throw new Error("Unexpected database query: "+sql);
  };
  mikrotik.getHotspotUsers=async()=>[
    {username:MAC_A.toLowerCase(),password:MAC_A,profile:"Gold",comment:"Exp: 2030-01-02 03:04:05"},
    {username:MAC_B,password:MAC_B,profile:"Silver",comment:"Exp: 2030-01-03 04:05:06"},
    {username:"legacy-random-user",password:"pin",profile:"Gold",comment:"legacy"}
  ];
  try{
    const res=response();
    await controller.importFromMikrotik({},res);
    assert.equal(res.statusCode,200);
    assert.deepEqual(res.body,{success:true,imported:1,updated:1,skipped:1});
    const update=queries.find(q=>q.sql.startsWith("UPDATE hotspot_vouchers SET profile="));
    assert.ok(update,"existing identity should be updated");
    assert.match(update.sql,/profile=/);
    assert.match(update.sql,/expires_at=COALESCE/);
    assert.match(update.sql,/status='active'/);
    for(const protectedColumn of ["customer_name","phone","note","created_at"])assert.ok(!update.sql.includes(protectedColumn),"must not overwrite "+protectedColumn);
    assert.equal(update.params[0],17);
    assert.equal(update.params[1],"Gold");
    assert.ok(update.params[2] instanceof Date);
    const insert=queries.find(q=>q.sql.startsWith("INSERT INTO hotspot_vouchers"));
    assert.ok(insert,"new MAC identity should be inserted");
    assert.equal(insert.params[0],MAC_B);
    assert.equal(insert.params[1],MAC_B);
    assert.equal(insert.params[2],"Silver");
    assert.equal(insert.params[4],"Unlinked");
    assert.equal(insert.params[5],"all");
    assert.equal(insert.params[7],MAC_B);
    assert.match(insert.sql,/Imported Subscriber/);
    assert.match(insert.sql,/ON CONFLICT\(username\) DO NOTHING/);
  }finally{
    db.query=originalQuery;
    mikrotik.getHotspotUsers=originalGetUsers;
  }
});

test("Push endpoint selects only active/unused voucher candidates and formats RouterOS expiry",async()=>{
  const originalQuery=db.query,originalSync=mikrotik.syncHotspotUsers;
  let selectedSql="",sent=[];
  db.query=async(sql)=>{selectedSql=sql;return {rows:[
    {id:1,username:MAC_A,profile:"Gold",validity:"1d",status:"active",server:"all",mac_address:MAC_A,expires_at:new Date("2030-01-02T03:04:05+06:00"),created_at:new Date("2030-01-01T03:04:05+06:00")},
    {id:2,username:"bad",profile:"Gold",validity:"1d",status:"unused",server:"all",mac_address:"not-a-mac",expires_at:null,created_at:new Date("2030-01-01T03:04:05+06:00")}
  ]};};
  mikrotik.syncHotspotUsers=async(vouchers)=>{sent=vouchers;return {provisioned:1,refreshed:0,skipped:0,disconnected:0};};
  try{
    const res=response();
    await controller.pushToMikrotik({},res);
    assert.equal(res.statusCode,200);
    assert.match(selectedSql,/status IN \('active','unused'\)/);
    assert.match(selectedSql,/mac_address IS NOT NULL/);
    assert.equal(sent.length,1);
    assert.equal(sent[0].macAddress,MAC_A);
    assert.equal(sent[0].comment,"Exp: 2030-01-02 03:04:05");
    assert.equal(res.body.provisioned,1);
    assert.equal(res.body.skipped,1);
  }finally{
    db.query=originalQuery;
    mikrotik.syncHotspotUsers=originalSync;
  }
});

test("RouterOS push adds MAC credentials and preserves existing sessions unless expired",async()=>{
  const originalWithConnection=mikrotik._withConnection;
  const calls=[];
  mikrotik._withConnection=async function(_label,callback){
    const connection={write:async(command,params=[])=>{
      calls.push({command,params});
      if(command==="/ip/hotspot/user/print")return [{".id":"*1",name:MAC_A,profile:"Old",comment:"Exp: 2029-01-01 00:00:00"}];
      if(command==="/ip/hotspot/active/print")return [{".id":"*a",user:MAC_A},{".id":"*b",user:MAC_B}];
      return [];
    }};
    return callback(connection);
  };
  try{
    const result=await mikrotik.syncHotspotUsers([
      {macAddress:MAC_A,profile:"Gold",comment:"Exp: 2030-01-02 03:04:05",expired:false},
      {macAddress:MAC_B,profile:"Silver",comment:"Exp: 2020-01-02 03:04:05",expired:true}
    ]);
    assert.deepEqual(result,{provisioned:1,refreshed:1,skipped:0,disconnected:1});
    const set=calls.find(c=>c.command==="/ip/hotspot/user/set");
    assert.ok(set);
    assert.ok(set.params.includes("=.id=*1"));
    assert.ok(set.params.includes("=profile=Gold"));
    assert.ok(set.params.includes("=comment=Exp: 2030-01-02 03:04:05"));
    assert.ok(!set.params.some(p=>p.startsWith("=password=")),"refresh must not reset credentials or session");
    const add=calls.find(c=>c.command==="/ip/hotspot/user/add");
    assert.ok(add);
    assert.ok(add.params.includes("=name="+MAC_B));
    assert.ok(add.params.includes("=password="+MAC_B));
    assert.ok(add.params.includes("=mac-address="+MAC_B));
    const removals=calls.filter(c=>c.command==="/ip/hotspot/active/remove");
    assert.deepEqual(removals,[{command:"/ip/hotspot/active/remove",params:["=.id=*b"]}]);
    assert.ok(!calls.some(c=>c.command==="/ip/hotspot/user/reset-counters"));
  }finally{mikrotik._withConnection=originalWithConnection;}
});
