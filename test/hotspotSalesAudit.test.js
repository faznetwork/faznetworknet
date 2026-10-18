"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=relative=>fs.readFileSync(path.join(root,relative),"utf8");

test("Hotspot sales origin migration preserves independent transaction history",()=>{
 const sql=read("db/migrations/20261018_hotspot_sales_origin_and_expiry_audit.sql");
 assert.match(sql,/ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sale_type/);
 assert.match(sql,/online_mfs/);
 assert.match(sql,/scratch_card/);
 assert.match(sql,/CREATE INDEX IF NOT EXISTS idx_transactions_sales_type_created/);
 assert.doesNotMatch(sql,/DELETE\s+FROM\s+transactions/i);
});

test("Hotspot expiry retains rows in expired_profile for 30 days and purges only after RouterOS cleanup",()=>{
 const source=read("jobs/hotspotExpirationCleanup.js");
 assert.match(source,/profile='expired_profile'/);
 assert.match(source,/SELECT id,username,mac_address FROM hotspot_vouchers WHERE status='expired' AND COALESCE\(subscriber_type,'legacy'\) <> 'direct_subscriber' AND cleanup_status='completed' AND expires_at < NOW\(\) - INTERVAL '30 days'/);
 assert.match(source,/DELETE FROM hotspot_vouchers WHERE id = ANY\(\$1::bigint\[\]\) AND status='expired' AND COALESCE\(subscriber_type,'legacy'\) <> 'direct_subscriber' AND cleanup_status='completed'/);
 assert.doesNotMatch(source,/DELETE\s+FROM\s+transactions/i);
});

test("Scratch card redemption records a durable scratch_card sale",()=>{
 const source=read("controllers/hotspotAuthController.js");
 assert.match(source,/async function claimVoucher/);
 assert.match(source,/voucher_password/);
 assert.match(source,/sale_type,claimed_at,claimed_by/);
 assert.match(source,/'scratch_card'/);
});

test("Hotspot sales report supports date and sale-type filtering",()=>{
 const controller=read("controllers/reportController.js");
 const view=read("views/reports.ejs");
 assert.match(controller,/req\.query\.from/);
 assert.match(controller,/req\.query\.to/);
 assert.match(controller,/req\.query\.sale_type/);
 assert.match(view,/type="date" id="salesFrom"/);
 assert.match(view,/type="date" id="salesTo"/);
 assert.match(view,/value="scratch_card"/);
});
