"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const db=require("../db");
const cleanup=require("../jobs/notificationHistoryCleanup");
test("notification retention is 60 days and only targets delivery history and terminal email jobs",async()=>{
 const original=db.query,calls=[];
 db.query=async(sql,params)=>{calls.push({sql,params});return {rowCount:0,rows:[]};};
 try{
  const result=await cleanup.runNotificationHistoryCleanup();
  assert.equal(cleanup.RETENTION_DAYS,60);
  assert.equal(result.historyDeleted,0);
  assert.equal(result.terminalEmailJobsDeleted,0);
  assert.equal(calls.length,2);
  assert.match(calls[0].sql,/DELETE FROM sms_delivery_logs/);
  assert.match(calls[0].sql,/created_at < NOW\(\) - \(\$1::int \* INTERVAL '1 day'\)/);
  assert.match(calls[1].sql,/DELETE FROM email_outbox/);
  assert.match(calls[1].sql,/status IN \('sent','failed'\)/);
  assert.deepEqual(calls.map(c=>c.params),[[60],[60]]);
 }finally{db.query=original;}
});
test("notification retention rejects any table outside the allowlist",async()=>{
 await assert.rejects(()=>cleanup.deleteInBatches("customers"),/Unsupported notification retention table/);
});
