"use strict";
// Phase 3 (H1/F10): renewal retry-window fix. The old cleanup failed a
// pending op 60s after creation although its first retry was only due
// after 5 minutes. Now staleness is past-due only, failRenewal backs off
// (5/10/15/20 min, capped at 30) and is terminal at 5 attempts.
const test=require("node:test");
const assert=require("node:assert/strict");
const ops=require("../services/hotspotRenewalOperationService");
const {createHotspotRenewalReconciliation}=require("../jobs/hotspotRenewalReconciliation");

// ---- fake db that interprets the two renewal UPDATEs faithfully ----
let now=new Date("2026-11-21T23:30:00+06:00");
function fakeRenewalDb(rows){
  const seen=[];
  return {seen,rows,
    async query(sql,params=[]){
      seen.push({sql,params});
      if(sql.includes("UPDATE hotspot_renewal_operations SET router_applied=true")){
        const row=rows.find(r=>r.id===params[0]);
        if(!row||row.status!=="pending")return {rows:[],rowCount:0};
        row.router_applied=true;row.attempts+=1;row.last_error=null;
        return {rows:[{id:row.id}],rowCount:1};
      }
      if(sql.includes("UPDATE hotspot_renewal_operations SET status='failed',last_error=COALESCE")){
        // cleanupStaleRenewals: past-due only; attempts>=5 only once past due.
        const ageSeconds=Number(params[0]);
        const cutoff=new Date(now.getTime()-ageSeconds*1000);
        let count=0;
        for(const row of rows){
          if(row.status!=="pending")continue;
          const pastDue=row.next_attempt_at<=now;
          const stalePastDue=row.next_attempt_at<=cutoff;
          if(stalePastDue||(row.attempts>=5&&pastDue)){row.status="failed";count++;}
        }
        return {rows:[],rowCount:count};
      }
      if(sql.includes("UPDATE hotspot_renewal_operations SET status=CASE WHEN attempts+1>=5")){
        const row=rows.find(r=>r.id===params[0]);
        if(!row||row.status!=="pending")return {rows:[],rowCount:0};
        const nextAttempts=row.attempts+1;
        row.attempts=nextAttempts;
        if(nextAttempts>=5){row.status="failed";row.next_attempt_at=null;}
        else{row.status="pending";row.next_attempt_at=new Date(now.getTime()+Math.min(5*nextAttempts,30)*60*1000);}
        row.last_error=params[1];
        return {rows:[{id:row.id}],rowCount:1};
      }
      throw new Error("Unexpected renewal query: "+sql);
    },
    async withTransaction(callback){
      const client={query:async(sql,params=[])=>{
        seen.push({sql,params,scope:"transaction"});
        if(sql.startsWith("SELECT id,payload,router_applied FROM hotspot_renewal_operations")){
          const due=rows.filter(r=>r.status==="pending"&&r.attempts<5&&r.next_attempt_at<=now).sort((a,b)=>a.created_at-b.created_at).slice(0,10);
          return {rows:due.map(r=>({id:r.id,payload:r.payload,router_applied:r.router_applied}))};
        }
        if(sql.startsWith("SELECT id FROM hotspot_vouchers WHERE id=$1 FOR UPDATE")){
          return {rows:[{id:101}]};
        }
        if(sql.startsWith("UPDATE hotspot_renewal_operations SET next_attempt_at=NOW()+INTERVAL '5 minutes'")){
          const row=rows.find(r=>r.id===params[0]); if(row)row.next_attempt_at=new Date(now.getTime()+5*60*1000);
          return {rows:[],rowCount:1};
        }
        throw new Error("Unexpected renewal transaction query: "+sql);
      }};
      return callback(client);
    }
  };
}

test("H1: cleanup never fails an op whose next attempt is still in the future",async()=>{
  now=new Date("2026-11-21T23:30:00+06:00");
  const rows=[
    {id:"op-future",status:"pending",attempts:0,next_attempt_at:new Date(now.getTime()+4*60*1000),created_at:new Date(now.getTime()-70*1000)},
    {id:"op-due",status:"pending",attempts:0,next_attempt_at:new Date(now.getTime()-1000),created_at:new Date(now.getTime()-70*1000)}
  ];
  const fakeDb=fakeRenewalDb(rows);
  const cleaned=await ops.cleanupStaleRenewals(fakeDb,1800);
  assert.equal(cleaned.rowCount,0,"a 70-second-old op with a future next attempt is not stale");
  assert.equal(rows[0].status,"pending");
  assert.equal(rows[1].status,"pending","an op that is merely due (not 30 min past due) is not stale either");
  assert.match(fakeDb.seen[0].sql,/next_attempt_at<=NOW\(\)-\(\$1::text\|\|' seconds'\)::interval/);
  assert.doesNotMatch(fakeDb.seen[0].sql,/created_at<=NOW\(\)/,"staleness must not be computed from created_at");
});

test("H1: cleanup fails an op that is past due by more than 30 minutes",async()=>{
  now=new Date("2026-11-21T23:30:00+06:00");
  const rows=[
    {id:"op-stale",status:"pending",attempts:0,next_attempt_at:new Date(now.getTime()-31*60*1000),created_at:new Date(now.getTime()-40*60*1000)}
  ];
  const fakeDb=fakeRenewalDb(rows);
  const cleaned=await ops.cleanupStaleRenewals(fakeDb,1800);
  assert.equal(cleaned.rowCount,1);
  assert.equal(rows[0].status,"failed");
});

test("H1: failRenewal backs off 5/10/15/20 minutes and is terminal at 5 attempts",async()=>{
  now=new Date("2026-11-21T23:30:00+06:00");
  const rows=[{id:"op-retry",status:"pending",attempts:0,next_attempt_at:new Date(now.getTime()+5*60*1000),created_at:now}];
  const fakeDb=fakeRenewalDb(rows);
  const expectedMinutes=[5,10,15,20];
  for(let i=0;i<4;i++){
    await ops.failRenewal(fakeDb,"op-retry",new Error("router down"));
    assert.equal(rows[0].status,"pending");
    assert.equal(rows[0].attempts,i+1);
    assert.equal(rows[0].next_attempt_at.getTime(),now.getTime()+expectedMinutes[i]*60*1000,"backoff must grow: 5, 10, 15, 20 minutes");
  }
  await ops.failRenewal(fakeDb,"op-retry",new Error("router down"));
  assert.equal(rows[0].attempts,5);
  assert.equal(rows[0].status,"failed");
  assert.equal(rows[0].next_attempt_at,null,"the 5th failure is terminal — no further retries");
  const sql=fakeDb.seen.find(s=>s.sql.includes("CASE WHEN attempts+1>=5")).sql;
  assert.match(sql,/LEAST\(5\*\(attempts\+1\),30\)/);
  assert.match(sql,/next_attempt_at=CASE WHEN attempts\+1>=5 THEN NULL/);
});

test("F10: reconciliation router-applies a due op and finalizes it; an already-applied op skips the router call",async()=>{
  now=new Date("2026-11-21T23:30:00+06:00");
  const payload={voucherId:"101",mac:"AA:BB:CC:DD:EE:01",profile:"30-Day",validity:"30d"};
  const rows=[
    {id:"op-new",status:"pending",attempts:0,router_applied:false,payload,next_attempt_at:new Date(now.getTime()-1000),created_at:new Date(now.getTime()-6*60*1000)},
    {id:"op-applied",status:"pending",attempts:1,router_applied:true,payload,next_attempt_at:new Date(now.getTime()-1000),created_at:new Date(now.getTime()-6*60*1000)}
  ];
  const fakeDb=fakeRenewalDb(rows);
  const calls={applied:[],finalized:[],cleaned:[],failed:[]};
  const operations={
    async cleanupStaleRenewals(database,seconds){calls.cleaned.push(seconds);return ops.cleanupStaleRenewals(database,seconds);},
    async applyRouterRenewal(p){calls.applied.push(p);},
    async finalizeRenewal(client,id,p){calls.finalized.push(id);},
    async failRenewal(database,id,error){calls.failed.push(id);return ops.failRenewal(database,id,error);}
  };
  const job=createHotspotRenewalReconciliation({db:fakeDb,operations,logger:{log(){},warn(){},error(){}}});
  const result=await job.runOnce();
  assert.deepEqual(calls.cleaned,[1800],"reconciliation cleans up with the 30-minute past-due threshold");
  assert.equal(result.checked,2);
  assert.equal(result.reconciled,2);
  assert.equal(result.failed,0);
  assert.deepEqual(calls.applied,[payload],"only the not-yet-applied op gets a router call");
  assert.deepEqual(calls.finalized,["op-new","op-applied"]);
});

test("F10: manualRenew still returns 409 while a pending op exists",async()=>{
  const controller=require("../controllers/hotspotController");
  const db=require("../db");
  const originalQuery=db.query,originalTransaction=db.withTransaction;
  db.query=async()=>{throw new Error("manualRenew must not touch the pool before the pending check");};
  db.withTransaction=async(callback)=>callback({query:async(sql)=>{
    if(sql.startsWith("SELECT pg_advisory_xact_lock"))return {rows:[]};
    if(sql.startsWith("SELECT * FROM hotspot_vouchers"))return {rows:[{id:101,username:"AA:BB:CC:DD:EE:01",mac_address:"AA:BB:CC:DD:EE:01",phone:"01712345678",expires_at:new Date(Date.now()+24*3600*1000)}]};
    if(sql.startsWith("SELECT id FROM hotspot_renewal_operations"))return {rows:[{id:"op-pending"}]};
    throw new Error("Unexpected manualRenew query: "+sql);
  }});
  const res={statusCode:200,body:null,status(code){this.statusCode=code;return this;},json(body){this.body=body;return this;}};
  try{
    await controller.manualRenew({params:{id:"101"},body:{voucherId:"101",profile_id:"30-Day"}},res);
    assert.equal(res.statusCode,409);
    assert.match(res.body.message||"",/still being synchronized/);
  }finally{db.query=originalQuery;db.withTransaction=originalTransaction;}
});
