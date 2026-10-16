"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ejs=require("ejs");
const templates=["views/admin.ejs","views/index.ejs","views/customer-dashboard.ejs","views/portal.ejs","views/customer-profile.ejs","views/reports.ejs"];
test("all updated EJS templates compile after branding and settings changes",()=>{
 for(const file of templates){
  const source=fs.readFileSync(path.join(__dirname,"..",file),"utf8");
  assert.doesNotThrow(()=>ejs.compile(source,{filename:file}),file+" should compile");
 }
});


test("admin notification hub has no orphaned JavaScript member chains",()=>{
 const source=fs.readFileSync(path.join(__dirname,"..","views/admin.ejs"),"utf8");
 assert.doesNotMatch(source,/^\s*\.(?:forEach|map|then|catch|addEventListener)\b/m,
  "a standalone member chain is a JavaScript syntax error that prevents the admin script from initializing");
 assert.match(source,/function setNotificationTab\(tab\)/);
 assert.match(source,/data-notify-tab="sms"/);
});

test("decommissioned notification channels have no frontend DOM references",()=>{
 for(const file of ["views/admin.ejs","public/js/admin.js","public/js/main.js","public/js/rbac-sidebar.js"]){
  const source=fs.readFileSync(path.join(__dirname,"..",file),"utf8");
  assert.doesNotMatch(source,/telegram|messenger|bot_token|chat_id|page_access_token|sendTestTelegram|sendTestMessenger/i,file+" should not reference removed channels");
 }
});


test("database schema INSERT blocks do not leave a trailing comma before ON CONFLICT",()=>{
 const schema=fs.readFileSync(path.join(__dirname,"..","db/schema.sql"),"utf8");
 assert.doesNotMatch(schema,/,(?:\\s*\\r?\\n\\s*)ON CONFLICT/i,
  "PostgreSQL rejects a trailing comma before ON CONFLICT");
});
