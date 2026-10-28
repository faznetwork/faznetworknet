"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
test("expired subscribers are never reported online and remain available in Expired", async () => {
 const db=require("../db");
 const mikrotik=require("../services/mikrotikService");
 const controller=require("../controllers/hotspotUserController");
 const originalQuery=db.query, originalSessions=mikrotik.getActiveHotspotSessions;
 const now=Date.now();
 const expiredRow={id:9001,username:"expired-fixture",customer_name:"Expired fixture",phone:"01700000000",mac_address:"AA:BB:CC:DD:EE:01",profile:"Pack 525",profile_id:"Pack 525",expires_at:new Date(now-86400000).toISOString(),status:"active",server:"all"};
 const activeRow={id:9002,username:"active-fixture",customer_name:"Active fixture",phone:"01700000001",mac_address:"AA:BB:CC:DD:EE:02",profile:"Pack 525",profile_id:"Pack 525",expires_at:new Date(now+86400000).toISOString(),status:"active",server:"all"};
 db.query=async()=>({rows:[expiredRow,activeRow]});
 mikrotik.getActiveHotspotSessions=async()=>[
  {user:"expired-fixture",address:"10.0.0.90",macAddress:"AA:BB:CC:DD:EE:01"},
  {user:"active-fixture",address:"10.0.0.91",macAddress:"AA:BB:CC:DD:EE:02"}
 ];
 async function invoke(filter){
  const res={statusCode:200,headers:{},payload:null,set(k,v){this.headers[k]=v;return this;},status(code){this.statusCode=code;return this;},json(payload){this.payload=payload;return this;}};
  await controller.list({query:{filter}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.payload.success,true);
  return res.payload;
 }
 try {
  const all=await invoke("all");
  const expired=all.users.find(user=>user.id===9001);
  assert.equal(expired.is_online,false);
  assert.equal(expired.status,"expired");
  const expiredFilter=await invoke("expired");
  assert.deepEqual(expiredFilter.users.map(user=>user.id),[9001]);
  const onlineFilter=await invoke("online");
  assert.deepEqual(onlineFilter.users.map(user=>user.id),[9002]);
  const activeFilter=await invoke("active");
  assert.deepEqual(activeFilter.users.map(user=>user.id),[]);
 } finally {
  db.query=originalQuery;
  mikrotik.getActiveHotspotSessions=originalSessions;
 }
});
test("expiry cleanup retains financial and voucher rows while unbinding MAC after verified purge",()=>{
 const source=fs.readFileSync(require.resolve("../jobs/hotspotExpirationCleanup"),"utf8");
 assert.doesNotMatch(source,/DELETE\s+FROM\s+(?:transactions|hotspot_voucher_payments|hotspot_vouchers)/i);
 assert.match(source,/last_known_mac=COALESCE/); assert.match(source,/mac_address=NULL/);
});
