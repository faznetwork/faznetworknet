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
  assert.match(routes, /router\.post\("\/users\/:id\/renew",controller\.manualRenew\)/);
  assert.match(routes, /router\.delete\("\/users\/:id",userController\.archive\)/);
  const router = require("../routes/hotspotRoutes");
  const renewRoute = router.stack.find(layer => layer.route?.path === "/users/:id/renew");
  assert.ok(renewRoute, "renew endpoint is registered");
  assert.equal(renewRoute.route.methods.post, true);
  assert.equal(renewRoute.route.stack[0].handle, require("../controllers/hotspotController").manualRenew);
  const archiveRoute = router.stack.find(layer => layer.route?.path === "/users/:id");
  assert.equal(archiveRoute.route.stack[0].handle, require("../controllers/hotspotUserController").archive);
  const controller = read("controllers/hotspotUserController.js");
  assert.match(controller, /SELECT id,username,customer_name,phone,mac_address/);
  // Phase 3 (§F): partial updates only — the UPDATE is built dynamically
  // from the fields actually present, and a MAC change is refused when
  // another live voucher already holds that MAC.
  assert.match(controller, /UPDATE hotspot_vouchers SET \$\{sets\.join\(",\"\)\} WHERE id=\$\$\{idx\}/);
  assert.match(controller, /customer_name=\$\$\{idx\}/);
  assert.match(controller, /mac_lock=\$\$\{idx\}/);
  assert.match(controller, /Another live subscriber is already bound to this MAC address/);
  assert.match(controller, /deleteHotspotSubscriber/);
});

test("Subscriber 360 uses guarded session disconnect and canonical verified deletion", () => {
  const controller = read("controllers/hotspotUserController.js");
  const ui = read("public/js/hotspot-users-clean.js");
  const guardResponse = { statusCode: 200, payload: null, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; } };
  const guardResult = require("../controllers/hotspotUserController").blockRouterMutation({}, guardResponse);
  assert.equal(guardResult, guardResponse);
  assert.equal(guardResponse.statusCode, 409);
  assert.equal(guardResponse.payload.success, false);
  assert.match(guardResponse.payload.message, /RouterOS users and active sessions remain untouched/);
  assert.doesNotMatch(controller, /mikrotikService\.(?:removeHotspotUser|rechargeHotspotUser|kickHotspotUser|deleteHotspotUser|removeHotspotCookie|removeHotspotHost)\s*\(/);
  assert.match(controller, /Network access purged and subscriber soft-deleted/);
  assert.match(ui, /\/api\/hotspot\/active\/disconnect/);
  assert.match(ui, /user\.sessionId/);
  assert.match(ui, /verified RouterOS purge now/);
  assert.match(ui, /Financial history retained/);
});

test("Hotspot subscriber UI uses a softened slate header and readable action styles",()=>{const css=read("public/css/hotspot-users-clean.css");assert.match(css,/#1e293b/);assert.match(css,/\.hotspot-table-header th/);assert.match(css,/\.hs-subscriber-name\{[^}]*15px/);assert.match(css,/\.btn-action-renew/);});
test("Hotspot API requires an active session with an assigned IP to mark a subscriber online",()=>{const controller=read("controllers/hotspotController.js");assert.match(controller,/is_online:Boolean\(session&&String\(session\.address\|\|\"\"\)\.trim\(\)\)/);assert.match(controller,/getTime\(\)<=now/);});
