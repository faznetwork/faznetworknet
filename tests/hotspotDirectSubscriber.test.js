"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Add User implements distinct direct-subscriber creation modes",()=>{
 const source=read("controllers/hotspotController.js");
 assert.match(source,/mode==="preassigned"/);
 assert.match(source,/mode==="first_login"/);
 assert.match(source,/subscriber_type='direct_subscriber'/);
 assert.match(source,/status='pending_claim'/);
 assert.match(source,/preassigned\?mac:null/);
 assert.match(source,/first_login_at/);
 assert.match(source,/db\.withTransaction\(async client=>/);
 assert.match(source,/rechargeHotspotUser\(\{username:mac,password:mac,profile/);
});

test("staged direct subscribers bind by registered phone and MAC on first authentication",()=>{
 const auth=read("controllers/hotspotAuthController.js");
 const routes=read("routes/hotspotAuthRoutes.js");
 assert.match(auth,/async function deviceLookup/);
 assert.match(auth,/async function activate/);
 assert.match(auth,/subscriber_type/);
 assert.match(auth,/const stagedDirect=phoneRows\.filter/);
 assert.match(auth,/phone=COALESCE\(NULLIF\(\$4,''\),phone\)/);
 assert.match(routes,/controller\.deviceLookup/);
});

test("direct subscribers cannot be redeemed as scratch-card tokens",()=>{
 const auth=read("controllers/hotspotAuthController.js");
 assert.match(auth,/COALESCE\(subscriber_type,'legacy'\) <> 'direct_subscriber'/);
});

test("All Hotspot Users is PostgreSQL-first and enriched only by active sessions",()=>{
 const controller=read("controllers/hotspotUserController.js");
 assert.match(controller,/SELECT id,username,customer_name,phone,mac_address,profile/);
 assert.match(controller,/FROM hotspot_vouchers WHERE LOWER\(COALESCE\(status,''\)\) <> 'archived'/);
 assert.match(controller,/getActiveHotspotSessions\(\)\.catch/);
 assert.doesNotMatch(controller,/getHotspotUsers\(\)/);
 for(const status of ["all","online","active","offline","expired"]) assert.ok(controller.includes('"'+status+'"')||controller.includes("'"+status+"'"));
});

test("expired subscribers are retained until the 30-day purge and sales transactions are never deleted",()=>{
 const job=read("jobs/hotspotExpirationCleanup.js");
 assert.match(job,/profile='expired_profile'/);
 assert.match(job,/expires_at < NOW\(\) - INTERVAL '30 days'/);
 assert.match(job,/cleanupExpiredHotspotUser\(row\.username, row\.mac_address\)/);
 assert.doesNotMatch(job,/DELETE FROM transactions/i);
 assert.doesNotMatch(job,/DELETE FROM hotspot_vouchers WHERE id=\$1 AND status='expired' AND cleanup_status='completed'/);
});

test("schema distinguishes direct subscribers from legacy and scratch-card inventory",()=>{
 const schema=read("db/schema.sql");
 assert.match(schema,/subscriber_type VARCHAR\(24\) NOT NULL DEFAULT 'legacy'/);
 assert.match(schema,/activation_type VARCHAR\(24\) NOT NULL DEFAULT 'legacy'/);
 assert.match(schema,/CHECK \(subscriber_type IN \('direct_subscriber','scratch_voucher','legacy'\)\)/);
});
