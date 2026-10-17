"use strict";
const test=require("node:test"); const assert=require("node:assert/strict");
const {deleteHotspotUser}=require("../controllers/hotspotController");
function fixture({purgeResult={alreadyAbsent:false},purgeError=null}={}) {
 const calls=[],logs=[];
 const database={async query(sql,params=[]){calls.push({type:"db",sql,params});if(sql.startsWith("SELECT id,username,mac_address"))return {rows:[{id:12,username:"AA:BB:CC:DD:EE:FF",mac_address:"AA:BB:CC:DD:EE:FF"}]};if(sql.startsWith("DELETE FROM hotspot_vouchers"))return {rowCount:1,rows:[]};throw new Error("Unexpected SQL: "+sql);}};
 const router={async cleanupExpiredHotspotUser(username,mac){calls.push({type:"router",username,mac});if(purgeError)throw purgeError;return purgeResult;}};
 const logger={info:(...args)=>logs.push(["info",...args]),error:(...args)=>logs.push(["error",...args])};
 return {calls,logs,database,router,logger};
}
test("fetches PostgreSQL identity, purges RouterOS, then deletes the database row",async()=>{
 const f=fixture();const result=await deleteHotspotUser({username:"AA:BB:CC:DD:EE:FF",database:f.database,router:f.router,logger:f.logger});
 assert.equal(result.deleted,true);assert.deepEqual(f.calls.map(x=>x.type),["db","router","db"]);assert.equal(f.calls[1].mac,"AA:BB:CC:DD:EE:FF");assert.match(f.calls[2].sql,/^DELETE FROM hotspot_vouchers/);
});
test("already-absent RouterOS users do not block PostgreSQL deletion",async()=>{
 const f=fixture({purgeResult:{alreadyAbsent:true,usersRemoved:0}});const result=await deleteHotspotUser({username:"AA:BB:CC:DD:EE:FF",database:f.database,router:f.router,logger:f.logger});
 assert.equal(result.deleted,true);assert.equal(f.calls.filter(x=>x.type==="db"&&x.sql.startsWith("DELETE")).length,1);assert.ok(f.logs.some(x=>x[0]==="info"));
});
test("logs RouterOS API failure and preserves PostgreSQL identity for retry",async()=>{
 const f=fixture({purgeError:new Error("Router API timeout")});
 await assert.rejects(deleteHotspotUser({username:"AA:BB:CC:DD:EE:FF",database:f.database,router:f.router,logger:f.logger}),e=>e.code==="HOTSPOT_ROUTER_PURGE_FAILED"&&e.statusCode===502);
 assert.equal(f.calls.filter(x=>x.type==="db"&&x.sql.startsWith("DELETE")).length,0);assert.ok(f.logs.some(x=>x[0]==="error"));
});
