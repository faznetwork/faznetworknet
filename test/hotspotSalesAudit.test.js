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

test("Hotspot retention archives vouchers after verified RouterOS cleanup and never deletes financial or voucher rows",()=>{
 const source=read("jobs/hotspotExpirationCleanup.js");
 assert.doesNotMatch(source,/profile='expired_profile'/);
 assert.match(source,/SELECT id,username,mac_address FROM hotspot_vouchers WHERE status='expired' AND cleanup_status='completed' AND expires_at < NOW\\(\\) - INTERVAL '395 days'/);
 assert.match(source,/UPDATE hotspot_vouchers SET status='archived'/);
 assert.match(source,/last_known_mac=COALESCE\\(NULLIF\\(last_known_mac,''\\),NULLIF\\(mac_address,''\\)\\)/);
 assert.doesNotMatch(source,/DELETE\\s+FROM\\s+(?:hotspot_vouchers|hotspot_voucher_payments|transactions)/i);
});
test("Scratch card redemption records a durable scratch_card sale",()=>{
 const source=read("controllers/hotspotAuthController.js");
 assert.match(source,/async function claimVoucher/);
 assert.match(source,/voucher_password/);
 assert.match(source,/sale_type,claimed_at,claimed_by/);
 assert.match(source,/const saleType=claimed\.subscriberType==="admin_voucher"\?"manual":"scratch_card"/);
 assert.match(source,/saleType\+":"\+claimed\.id/);
 assert.match(source,/claimed\.profile,saleType\]\);/);
 assert.match(source,/claimed\.subscriberType/);
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

test("Voucher sales archive stores verified voucher counts and leaves legacy counts unknown",()=>{
 const schema=read("db/schema.sql");
 const migration=read("db/migrations/20261025_hotspot_sales_archive_voucher_count.sql");
 const job=read("jobs/hotspotExpirationCleanup.js");
 const controller=read("controllers/hotspotController.js");
 assert.match(schema,/voucher_count INTEGER CHECK \(voucher_count IS NULL OR voucher_count >= 0\)/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS voucher_count INTEGER/);
 assert.match(job,/created_at,voucher_count/);
 assert.match(job,/COUNT\(DISTINCT v\.id\)::integer/);
 assert.match(controller,/AS total_vouchers_sold/);
 assert.match(controller,/AS matched_transactions/);
 assert.match(controller,/AS total_amount/);
 assert.match(controller,/a\.voucher_count IS NOT NULL/);
 assert.match(controller,/totalVouchersSold:/);
 assert.match(controller,/matchedTransactions:/);
 assert.match(controller,/voucherCountComplete:/);
});
