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
  for (const token of ["freshHotspotUserList", "freshHotspotDetail", "freshEditProfileModal", "freshRenewModal", "freshSubscriberMobileModal", "Quick Renew", "✏️ Edit", "Delete / Archive", "count-all", "count-online", "count-active", "count-offline", "count-expired", "hs-executive-table", "Offline (Active Plan)", "btn-hotspot-action", "btn-action-renew"]) {
    assert.ok(js.includes(token), "missing UI feature: " + token);
  }
  assert.match(js, /response\.ok && data\.success === true/);
  assert.match(js, /max-width:991\.98px|991\.98px/);
  assert.match(js, /data-row-action="disconnect"/);
  assert.match(js, /data-filter/);
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

test("Subscriber 360 uses guarded session disconnect and keeps archive database-only", () => {
  const controller = read("controllers/hotspotUserController.js");
  const ui = read("public/js/hotspot-users-clean.js");
  assert.match(controller, /RouterOS calls are deliberately read-only/);
  assert.doesNotMatch(controller, /mikrotikService\.(?:removeHotspotUser|rechargeHotspotUser|kickHotspotUser|deleteHotspotUser|removeHotspotCookie|removeHotspotHost)\s*\(/);
  assert.match(controller, /Voucher archived in PostgreSQL only/);
  assert.match(ui, /\/api\/hotspot\/active\/disconnect/);
  assert.match(ui, /user\.sessionId/);
  assert.match(ui, /The MikroTik user and sessions will remain untouched/);
});

test("Hotspot subscriber UI uses a softened slate header and readable action styles",()=>{const css=read("public/css/hotspot-users-clean.css");assert.match(css,/#1e293b/);assert.match(css,/\.hotspot-table-header th/);assert.match(css,/\.hs-subscriber-name\{[^}]*15px/);assert.match(css,/\.btn-action-renew/);});
test("Hotspot API requires an active session with an assigned IP to mark a subscriber online",()=>{const controller=read("controllers/hotspotController.js");assert.match(controller,/is_online:Boolean\(session&&String\(session\.address\|\|\"\"\)\.trim\(\)\)/);assert.match(controller,/getTime\(\)<=now/);});
