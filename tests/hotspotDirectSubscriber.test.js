"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Add User implements distinct direct-subscriber creation modes",()=>{
 const source=read("controllers/hotspotController.js");
 assert.match(source,/\["preassigned","first_login"\]\.includes\(mode\)/);
 assert.match(source,/activation_type/);
 assert.match(source,/subscriber_type='direct_subscriber'/);
 assert.match(source,/preassigned\?"active":"pending_claim"/);
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

test("scratch voucher claim releases only stale MAC bindings and rejects live conflicts",()=>{
 const auth=read("controllers/hotspotAuthController.js");
 assert.match(auth,/SELECT id,status,expires_at,comment FROM hotspot_vouchers WHERE id<>\$2 AND LOWER\(COALESCE\(mac_address,''\)\)=LOWER\(\$1\) FOR UPDATE/);
 assert.match(auth,/liveActive=state==="active"&&\(!deadline\|\|deadline\.getTime\(\)>Date\.now\(\)\)/);
 assert.match(auth,/SET mac_address=NULL,status=CASE WHEN LOWER\(COALESCE\(status,''\)\)='active' THEN 'expired'/);
 assert.match(auth,/MAC_ALREADY_BOUND/);
});

test("voucher MAC uniqueness is limited to active records and historical bindings are released",()=>{
 const schema=read("db/schema.sql");
 const migration=read("db/migrations/20261018_hotspot_voucher_active_mac_unique.sql");
 const auth=read("controllers/hotspotAuthController.js");
 assert.match(schema,/DROP INDEX IF EXISTS uq_hotspot_vouchers_mac_address_ci/);
 assert.match(schema,/CREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_vouchers_active_mac_ci ON hotspot_vouchers \(LOWER\(mac_address\)\) WHERE status = 'active' AND mac_address IS NOT NULL/);
 assert.match(migration,/DROP INDEX IF EXISTS uq_hotspot_vouchers_mac_address_ci/);
 assert.match(migration,/WHERE status = 'active' AND mac_address IS NOT NULL/);
 assert.match(auth,/liveActive=state==="active"&&\(!deadline\|\|deadline\.getTime\(\)>Date\.now\(\)\)/);
 assert.match(auth,/SET mac_address=NULL/);
});

test("generated scratch vouchers persist batch IDs and can be retrieved for reprinting",()=>{
 const schema=read("db/schema.sql");
 const migration=read("db/migrations/20261018_hotspot_voucher_batch_persistence.sql");
 const controller=read("controllers/hotspotController.js");
 const routes=read("routes/hotspotRoutes.js");
 const ui=read("views/admin.ejs");
 assert.match(schema,/ADD COLUMN IF NOT EXISTS batch_id VARCHAR\(36\)/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS batch_id VARCHAR\(36\)/);
 assert.match(controller,/const batchId=crypto\.randomUUID\(\)/);
 assert.match(controller,/subscriber_type,activation_type,server,mac_lock,batch_id\)/);
 assert.match(controller,/async function voucherBatches\(req,res\)/);
 assert.match(controller,/async function voucherBatch\(req,res\)/);
 assert.match(routes,/router\.get\("\/vouchers\/batches",controller\.voucherBatches\)/);
 assert.match(routes,/router\.get\("\/vouchers\/batches\/:batchId",controller\.voucherBatch\)/);
 assert.match(ui,/Unused Voucher Batches/);
 assert.match(ui,/window\.openSavedVoucherBatch/);
});
test("unused scratch cards show PIN and password rather than a MAC in the voucher ledger",()=>{
 const controller=read("controllers/hotspotController.js");
 const ui=read("views/admin.ejs");
 assert.match(controller,/is_scratch_unused:scratchUnused/);
 assert.match(ui,/Voucher PIN \/ Username/);
 assert.match(ui,/scratchUnused\?\(v\.password\|\|'—'\):'—'/);
 assert.match(ui,/scratchUnused\?'—':\(v\.mac_address\|\|'—'\)/);
 assert.match(ui,/Voucher PIN:/);
 assert.match(ui,/Password:/);
});

test("expiration cleanup differentiates direct subscribers from ephemeral vouchers",()=>{
 const job=read("jobs/hotspotExpirationCleanup.js");
 const service=read("services/mikrotikService.js");
 const auth=read("controllers/hotspotAuthController.js");
 assert.match(job,/subscriber_type/);
 assert.match(job,/disableExpiredDirectHotspotUser/);
 assert.match(job,/removeExpiredVoucherHotspotUser/);
 assert.match(job,/COALESCE\(subscriber_type,\x27legacy\x27\) <> \x27direct_subscriber\x27/);
 assert.match(service,/=disabled=yes/);
 assert.match(service,/\/ip\/hotspot\/active\/remove/);
 assert.match(service,/\/ip\/hotspot\/cookie\/remove/);
 assert.match(service,/\/ip\/hotspot\/user\/remove/);
 assert.match(auth,/can_recharge:Boolean\(expired\)/);
 const portal=read("public/login.html");
 assert.match(portal,/if\(lookup\.expired\)\{showStatus/);
 assert.match(service,/disabled:false/);
});
