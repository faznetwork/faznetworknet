"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Admin loads only the clean Subscriber 360 assets for All Hotspot Users", () => {
  const view = read("views/admin.ejs");
  assert.match(view, /hotspot-users-clean\.js/);
  assert.match(view, /hotspot-users-clean\.css/);
  assert.doesNotMatch(view, /hotspot-profile360\.js|hotspot-master-detail\.js|hotspot-profile360\.css|hotspot-master-detail\.css/);
  assert.doesNotMatch(view, /const getExp=u=>|window\.renderHotspotMasterDetail/);
  const js = read("public/js/hotspot-users-clean.js");
  for (const token of ["freshHotspotUserList", "freshHotspotDetail", "freshEditProfileModal", "freshRenewModal", "freshSubscriberMobileModal", "Quick Renew", "Edit Profile", "Archive voucher"]) {
    assert.ok(js.includes(token), "missing UI feature: " + token);
  }
  assert.match(js, /response\.ok && data\.success === true/);
  assert.match(js, /max-width:991\.98px|991\.98px/);
  assert.match(js, /data-action="disconnect" disabled/);
});

test("Unified routes direct list, edit, renew and archive to the safe controller", () => {
  const routes = read("routes/hotspotRoutes.js");
  assert.match(routes, /router\.get\("\/users",userController\.list\)/);
  assert.match(routes, /router\.put\("\/users\/:id\/profile",userController\.updateProfile\)/);
  assert.match(routes, /router\.post\("\/users\/:id\/renew",userController\.renew\)/);
  assert.match(routes, /router\.delete\("\/users\/:id",userController\.archive\)/);
  const controller = read("controllers/hotspotUserController.js");
  assert.match(controller, /SELECT id,username,customer_name,phone,mac_address/);
  assert.match(controller, /UPDATE hotspot_vouchers SET customer_name=\$1,phone=\$2/);
  assert.match(controller, /status='archived'/);
});

test("Subscriber 360 explicitly leaves RouterOS active sessions and destructive actions untouched", () => {
  const controller = read("controllers/hotspotUserController.js");
  const ui = read("public/js/hotspot-users-clean.js");
  assert.match(controller, /RouterOS calls are deliberately read-only/);
  assert.doesNotMatch(controller, /mikrotikService\.(?:removeHotspotUser|rechargeHotspotUser|kickHotspotUser|deleteHotspotUser|removeHotspotCookie|removeHotspotHost)\s*\(/);
  assert.match(controller, /Voucher archived in PostgreSQL only/);
  assert.match(ui, /active RouterOS sessions must remain untouched/);
  assert.match(ui, /The MikroTik user and sessions will remain untouched/);
});
