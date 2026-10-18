"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=relative=>fs.readFileSync(path.join(__dirname,"..",relative),"utf8");

test("Hotspot voucher writes always supply a non-null phone to payment association rows",()=>{
 const payment=read("controllers/paymentController.js");
 const auth=read("controllers/hotspotAuthController.js");
 const schema=read("db/schema.sql");
 assert.match(schema,/CREATE TABLE IF NOT EXISTS hotspot_voucher_payments[\\s\\S]*?phone VARCHAR\\(40\\) NOT NULL/);
 assert.ok(payment.includes("COALESCE(NULLIF($3::text,''),'Unlinked'),$4::numeric,$5::text,'online_mfs')"),"online MFS association must normalize an empty phone");
 assert.ok(payment.includes("phone=COALESCE(NULLIF($6::text,''),NULLIF(phone,''),'Unlinked')"),"force provision update must not preserve a blank/null phone");
 assert.ok(payment.includes("COALESCE(NULLIF($6::text,''),'Unlinked'),'all'"),"force provision insert must normalize an empty phone");
 assert.ok(auth.includes("COALESCE(NULLIF($3::text,''),'Unlinked'),$4::numeric,$5::text,'scratch_card')"),"scratch voucher association must normalize an empty phone");
});

test("Hotspot activation and lookup SQL use explicit text/bigint parameter types",()=>{
 const auth=read("controllers/hotspotAuthController.js");
 assert.ok(auth.includes("($2::text<>'' AND REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($2::text,'880'||SUBSTRING($2::text FROM 2)))"));
 assert.ok(auth.includes("REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g') IN ($1::text,'880'||SUBSTRING($1::text FROM 2))"));
 assert.ok(auth.includes("WHERE id=$8::bigint AND (mac_address IS NULL OR LOWER(mac_address)=LOWER($3::text))"));
 assert.ok(auth.includes("WHERE id=$1::bigint AND LOWER(mac_address)=LOWER($2::text)"));
 assert.ok(auth.includes("phone=COALESCE(NULLIF($7::text,''),NULLIF(phone,''),'Unlinked')"));
});

test("Online MFS voucher update keeps the password CASE parameter explicitly typed",()=>{
 const payment=read("controllers/paymentController.js");
 assert.ok(payment.includes("password=CASE WHEN $11::text IS NOT NULL THEN $2::text ELSE password END"));
 assert.ok(payment.includes("transaction_id=$14::bigint,renewal_stacked=$15::boolean"));
});
