"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const {deleteHotspotUser}=require("../controllers/hotspotController");

function fixture({purgeResult={verified:true,alreadyAbsent:false,sessionsRemoved:1,cookiesRemoved:1,hostsRemoved:1,usersRemoved:1},purgeError=null}={}) {
 const calls=[],logs=[];
 const database={async query(sql,params=[]){
  calls.push({type:"db",sql,params});
  if(sql.startsWith("SELECT id,username,mac_address,last_known_mac,status FROM hotspot_vouchers"))
   return {rows:[{id:12,username:"AA:BB:CC:DD:EE:FF",mac_address:"AA:BB:CC:DD:EE:FF",last_known_mac:null,status:"active"}]};
  if(sql.startsWith("UPDATE hotspot_vouchers AS v SET status='deleted'"))
   return {rowCount:1,rows:[{id:12,username:"AA:BB:CC:DD:EE:FF",status:"deleted",last_known_mac:"AA:BB:CC:DD:EE:FF",mac_address:null}]};
  throw new Error("Unexpected SQL: "+sql);
 }};
 const router={async cleanupExpiredHotspotUser(username,mac){calls.push({type:"router",username,mac});if(purgeError)throw purgeError;return purgeResult;}};
 const logger={info:(...args)=>logs.push(["info",...args]),error:(...args)=>logs.push(["error",...args])};
 return {calls,logs,database,router,logger};
}

test("verified four-layer purge precedes soft delete and preserves MAC audit",async()=>{
 const f=fixture();
 const result=await deleteHotspotUser({username:"AA:BB:CC:DD:EE:FF",database:f.database,router:f.router,logger:f.logger});
 assert.equal(result.softDeleted,true);
 assert.deepEqual(f.calls.map(x=>x.type),["db","router","db"]);
 assert.match(f.calls[2].sql,/SET status='deleted'/);
 assert.match(f.calls[2].sql,/last_known_mac=COALESCE/);
 assert.match(f.calls[2].sql,/mac_address=NULL/);
 assert.doesNotMatch(f.calls[2].sql,/^\\s*DELETE\\s+FROM/i);
});

test("RouterOS outage retains database status and MAC binding for retry",async()=>{
 const f=fixture({purgeError:new Error("Router API timeout")});
 await assert.rejects(deleteHotspotUser({username:"AA:BB:CC:DD:EE:FF",database:f.database,router:f.router,logger:f.logger}),e=>e.code==="HOTSPOT_ROUTER_PURGE_FAILED"&&e.statusCode===502);
 assert.equal(f.calls.filter(x=>x.type==="db"&&x.sql.startsWith("UPDATE")).length,0);
 assert.ok(f.logs.some(x=>x[0]==="error"));
});

test("unverified purge cannot change subscriber state",async()=>{
 const f=fixture({purgeResult:{verified:false}});
 await assert.rejects(deleteHotspotUser({username:"AA:BB:CC:DD:EE:FF",database:f.database,router:f.router,logger:f.logger}),e=>e.code==="HOTSPOT_PURGE_NOT_VERIFIED");
 assert.equal(f.calls.filter(x=>x.type==="db"&&x.sql.startsWith("UPDATE")).length,0);
});
