"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

// Phase 3 (M14): an unauthenticated device lookup is a pure read. It
// returns only a coarse status plus can_recharge / requires_claim_secret,
// and it must NOT purge the router session or write the voucher row.
// Expiry enforcement belongs to jobs/hotspotExpirationCleanup.js.
test("expired portal lookup is a pure read: coarse status only, no router purge, no DB write",()=>{
 const auth=read("controllers/hotspotAuthController.js");
 assert.match(auth,/requires_claim_secret:requiresClaimSecret,can_recharge:expired/);
 assert.doesNotMatch(auth,/disableExpiredDirectHotspotUser\(row\.username\|\|mac,row\.mac_address\|\|mac\)/);
 assert.doesNotMatch(auth,/UPDATE hotspot_vouchers SET status='expired',profile='expired_profile'/);
 assert.match(auth,/Expiry enforcement belongs to jobs\/hotspotExpirationCleanup\.js/);
 const service=read("services/mikrotikService.js");
 assert.match(service,/async disableExpiredDirectHotspotUser/);
 assert.match(service,/\/ip\/hotspot\/active\/remove/);
 assert.match(service,/\/ip\/hotspot\/cookie\/remove/);
 assert.match(service,/\/ip\/hotspot\/user\/remove/);
 const portal=read("public/login.html");
 assert.doesNotMatch(portal,/DEVICE_LOOKUP_URL/);
 assert.match(portal,/\/api\/public\/payment\/confirm/);
});
