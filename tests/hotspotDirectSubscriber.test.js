"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("Admin Add Hotspot User is voucher-first and excludes direct-subscriber provisioning",()=>{
 const source=read("controllers/hotspotController.js");
 const start=source.indexOf("async function createUser(req, res)");
 const end=source.indexOf("async function dashboardMetrics(req,res)",start);
 const createUser=source.slice(start,end);
 assert.match(createUser,/hotspotVoucherGenerator\.generateVoucherBatch/);
 assert.match(createUser,/quantity:\s*1/);
 assert.match(createUser,/status = 'unused'/);
 assert.match(createUser,/subscriber_type = 'admin_voucher'/);
 assert.match(createUser,/activation_type = 'first_login'/);
 assert.doesNotMatch(createUser,/direct_subscriber/);
 assert.doesNotMatch(createUser,/rechargeHotspotUser/);
 assert.match(createUser,/time_limit = NULLIF\(\$6::text, ''\)/);
 assert.match(createUser,/data_limit = NULLIF\(\$7::text, ''\)/);
 assert.match(createUser,/expires_at = \$8::timestamptz/);
 assert.match(createUser,/timeZone: "Asia\/Dhaka"/);
 assert.match(createUser,/event: "hotspot_voucher_created"/);
 assert.doesNotMatch(createUser,/channels: \["sms"\]/);
 assert.match(createUser,/if \(phone\)/);
});

test("Admin Add Hotspot User form omits activation mode, device MAC and manual password fields",()=>{
 const ui=read("views/admin.ejs");
 const start=ui.indexOf("const form = document.getElementById('addHotspotUserForm')");
 const end=ui.indexOf("async function loadHotspotDashboard()",start);
 const formScript=ui.slice(start,end);
 const formMarkup=ui.slice(ui.indexOf('<form id="addHotspotUserForm"'),ui.indexOf("</form>",ui.indexOf('<form id="addHotspotUserForm"'))+7);
 assert.doesNotMatch(formMarkup,/name="activation_type"/);
 assert.doesNotMatch(formMarkup,/id="hsDeviceMac"/);
 assert.doesNotMatch(formMarkup,/id="hsPassword"/);
 assert.match(formMarkup,/name="customer_name"/);
 assert.doesNotMatch(formMarkup,/name="customer_name"[^>]*required/);
 assert.doesNotMatch(formMarkup,/name="phone"[^>]*required/);
 assert.match(formMarkup,/id="hsProfile"[^>]*required/);
 assert.match(formScript,/response\.voucher/);
 assert.match(formScript,/custom_expiry/);
 assert.match(formScript,/Create Voucher/);
});

test("staged direct subscribers remain distinct from redeemable voucher inventory",()=>{
 const auth=read("controllers/hotspotAuthController.js");
 assert.match(auth,/COALESCE\(subscriber_type,'legacy'\) <> 'direct_subscriber'/);
});

test("All Hotspot Users remains PostgreSQL-first and enriched only by active sessions",()=>{
 const controller=read("controllers/hotspotUserController.js");
 assert.match(controller,/SELECT id,username,customer_name,phone,mac_address,profile/);
 assert.ok(controller.includes("FROM hotspot_vouchers WHERE LOWER(COALESCE(status,'')) NOT IN ('archived','deleted')"));
 assert.match(controller,/getActiveHotspotSessions\(\)\.catch/);
 assert.doesNotMatch(controller,/getHotspotUsers\(\)/);
 for(const status of ["all","online","active","offline","expired"]) assert.ok(controller.includes('"'+status+'"')||controller.includes("'"+status+"'"));
});

test("expired subscribers are retained and sales transactions are never deleted",()=>{
 const job=read("jobs/hotspotExpirationCleanup.js");
 assert.doesNotMatch(job,/profile='expired_profile'/);
 assert.match(job,/expires_at < NOW\(\) - INTERVAL '395 days'/);
 assert.match(job,/cleanupExpiredHotspotUser\(row\.username, row\.mac_address\)/);
 assert.doesNotMatch(job,/DELETE FROM transactions/i);
});

test("schema allows the shared scratch voucher type and first-login activation mode",()=>{
 const schema=read("db/schema.sql");
 assert.match(schema,/subscriber_type VARCHAR\(24\) NOT NULL DEFAULT 'legacy'/);
 assert.match(schema,/activation_type VARCHAR\(24\) NOT NULL DEFAULT 'legacy'/);
 assert.match(schema,/CHECK \(subscriber_type IN \('direct_subscriber', 'scratch_voucher', 'admin_voucher', 'mfs', 'legacy', 'reseller_voucher'\)\)/);
});

test("scratch voucher claims reject live MAC conflicts and release stale bindings",()=>{
 const auth=read("controllers/hotspotAuthController.js");
 assert.match(auth,/COALESCE\(subscriber_type,'legacy'\) <> 'direct_subscriber'/);
 assert.match(auth,/liveActive=state==="active"&&\(!deadline\|\|deadline\.getTime\(\)>Date\.now\(\)\)/);
 assert.match(auth,/MAC_ALREADY_BOUND/);
 assert.match(auth,/SET mac_address=NULL/);
});

test("generated scratch vouchers persist batch IDs and can be retrieved for reprinting",()=>{
 const schema=read("db/schema.sql");
 const migration=read("db/migrations/20261018_hotspot_voucher_batch_persistence.sql");
 const controller=read("controllers/hotspotController.js");
 const generator=read("services/hotspotVoucherGenerator.js");
 const routes=read("routes/hotspotRoutes.js");
 const ui=read("views/admin.ejs");
 assert.match(schema,/ADD COLUMN IF NOT EXISTS batch_id VARCHAR\(36\)/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS batch_id VARCHAR\(36\)/);
 assert.match(controller,/hotspotVoucherGenerator\.generateVoucherBatch/);
 assert.match(generator,/subscriber_type,activation_type,server,mac_lock,batch_id,transaction_id/);
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

test("captive portal calls the hosted backend and submits the MikroTik login handshake",()=>{
 const portal=read("public/login.html");
 const auth=read("controllers/hotspotAuthController.js");
 assert.match(portal,/BACKEND_BASE_URL=LOCAL_HOST\?window\.location\.origin/);
 assert.match(portal,/https:\/\/faznetwork\.com/);
 assert.match(portal,/function submitMikrotikLogin\(username,password,redirectUrl\)/);
 assert.match(portal,/form\.action=device\.login/);
 assert.match(portal,/form\.submit\(\)/);
 assert.match(portal,/login_url:device\.login/);
 assert.match(portal,/submitMikrotikLogin\(result\.username,result\.password,result\.redirect_url\)/);
 assert.match(auth,/success:true,message:"Hotspot account activated for this device\."/);
 assert.match(auth,/redirect_url:redirectUrl/);
});
