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
 assert.ok(source.includes("SELECT id,username,mac_address FROM hotspot_vouchers WHERE status='expired' AND cleanup_status='completed' AND expires_at < NOW() - INTERVAL '395 days'"));
 assert.ok(source.includes("UPDATE hotspot_vouchers AS v SET status='archived'"));
 assert.ok(source.includes("last_known_mac=COALESCE(NULLIF(v.mac_address,''),NULLIF(v.last_known_mac,''))"));
 assert.equal(["DELETE FROM hotspot_vouchers","DELETE FROM hotspot_voucher_payments","DELETE FROM transactions"].some(sql => source.toLowerCase().includes(sql.toLowerCase())),false);
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
 assert.match(view,/value="scratch_voucher"/);
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


test("Admin manual sales use a dedicated ADM-MANUAL transaction prefix",()=>{
 const source=read("controllers/hotspotAuthController.js");
 assert.match(source,/ADM-MANUAL-/);
 assert.doesNotMatch(source,/\?"ADMIN-":"SCRATCH-"/);
});
test("Voucher sales history applies server-side category filtering and returns recalculated totals",()=>{
 const source=read("controllers/hotspotController.js");
 assert.match(source,/allowedCategories=new Set\(\["all","mfs","scratch_voucher","admin_voucher"\]\)/);
 assert.match(source,/subscriber_type = \$/);
 assert.match(source,/totalVouchersSold:/);
 assert.match(source,/totalAmount:/);
 const view=read("views/admin.ejs");
 assert.match(view,/id="hsSalesCategory"/);
 assert.match(view,/params\.set\('category',category\)/);
});
test("Hotspot revenue report supports canonical category filtering and Admin Manual metrics",()=>{
 const controller=read("controllers/reportController.js");
 const view=read("views/reports.ejs");
 assert.match(controller,/req\.query\.category\|\|req\.query\.sale_type/);
 const resolver=read("services/hotspotSalesCategory.js");
 assert.match(resolver,/admin_voucher/);
 assert.match(controller,/admin_manual_sales/);
 assert.match(view,/value="mfs"/);
 assert.match(view,/value="scratch_voucher"/);
 assert.match(view,/value="admin_voucher"/);
});
test("Hotspot sales archive persists explicit origin for new archives and leaves historical rows untouched",()=>{
 const schema=read("db/schema.sql");
 const migration=read("db/migrations/20261025_hotspot_sales_category_metadata.sql");
 const job=read("jobs/hotspotExpirationCleanup.js");
 assert.match(schema,/subscriber_type VARCHAR\(32\)/);
 assert.match(migration,/ADD COLUMN IF NOT EXISTS subscriber_type VARCHAR\(32\)/);
 assert.match(job,/voucher_count,sale_type,subscriber_type/);
 assert.match(job,/MAX\(v\.subscriber_type\)/);
 assert.doesNotMatch(migration,/UPDATE hotspot_voucher_sales_archive/i);
});

test("Collection Report separates payment method from sales origin",()=>{
 const controller=read("controllers/reportController.js");
 const view=read("views/reports.ejs");
 assert.match(controller,/normalizeSalesCategory\(req\.query\.category/);
 assert.match(controller,/transactionCategorySql\("t"\)/);
 assert.match(view,/id="method"/);
 assert.match(view,/id="category"/);
 assert.match(view,/Payment method/);
 assert.match(view,/Sales origin/);
});
