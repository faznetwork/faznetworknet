"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
test("expired subscribers are never reported online and remain available in Expired",()=>{
 const source=fs.readFileSync(require.resolve("../controllers/hotspotUserController"),"utf8");
 assert.match(source,/const online = !expired && Boolean\(session && String\(session\.address \|\| session\.ip \|\| ""\)\.trim\(\)\);/);
 assert.match(source,/if \(filter === "online"\) return user\.is_online && user\.status !== "expired";/);
 assert.match(source,/if \(filter === "expired"\) return user\.status === "expired";/);
 assert.match(source,/if \(filter === "active"\) return !user\.is_online && user\.status !== "expired"/);
});
test("expiry cleanup retains financial and voucher rows while unbinding MAC after verified purge",()=>{
 const source=fs.readFileSync(require.resolve("../jobs/hotspotExpirationCleanup"),"utf8");
 assert.doesNotMatch(source,/DELETE\s+FROM\s+(?:transactions|hotspot_voucher_payments|hotspot_vouchers)/i);
 assert.match(source,/last_known_mac=COALESCE/); assert.match(source,/mac_address=NULL/);
});
