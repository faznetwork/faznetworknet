"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Subscriber 360 profile fields persist before any RouterOS sync attempt", () => {
  const source = read("controllers/hotspotProfileController.js");
  const handler = source.slice(source.indexOf("async function updateProfile(req, res)"), source.indexOf("\nmodule.exports"));
  const dbWrite = handler.indexOf('UPDATE hotspot_vouchers SET customer_name');
  const routerRead = handler.indexOf("mikrotikService.getHotspotUser");
  const routerWrite = handler.indexOf("mikrotikService.updateHotspotUser");
  assert.ok(dbWrite >= 0, "profile update SQL should exist");
  assert.ok(routerRead > dbWrite, "RouterOS reads must happen after the PostgreSQL write");
  assert.ok(routerWrite > dbWrite, "RouterOS writes must happen after the PostgreSQL write");
  assert.match(handler, /console\.warn\("\[Hotspot Profile API\] PostgreSQL profile saved; MikroTik synchronization failed\."/);
  assert.match(handler, /return res\.json\(\{[\s\S]*success: true/);
});

test("Quick Renew parses seconds and returns new_expiry", () => {
  const source = read("controllers/hotspotController.js");
  assert.match(source, /function validityMs\(value\)[\s\S]*?\(s\|sec\|secs\|second\|seconds\)/);
  assert.match(source, /u\.startsWith\("s"\)\?1000/);
  assert.match(source, /success:true,new_expiry:renewed\.expiryLabel/);
});

test("Profile 360 and Quick Renew only show success after explicit API confirmation", () => {
  const profileJs = read("public/js/hotspot-profile360.js");
  const admin = read("views/admin.ejs");
  assert.match(profileJs, /if\(!d\|\|d\.success!==true\)throw new Error\(d\?\.message\|\|d\?\.error\|\|"Update failed"\)/);
  assert.match(admin, /if \(!response \|\| response\.success !== true\)\s*\{\s*throw new Error\(response && \(response\.message \|\| response\.error\) \|\| 'Renewal failed\.'\);\s*\}/);
  const renewHandler = admin.slice(admin.indexOf("form.addEventListener('submit', async function (submitEvent)"), admin.indexOf("                modal.show();", admin.indexOf("form.addEventListener('submit', async function (submitEvent)")));
  assert.ok(renewHandler.indexOf("response.success !== true") >= 0);
  assert.ok(renewHandler.indexOf("response.success !== true") < renewHandler.indexOf("if (typeof refreshHotspotCurrent === 'function') await refreshHotspotCurrent();"));
});

test("Legacy RouterOS-only editor no longer posts profile edits", () => {
  const admin = read("views/admin.ejs");
  assert.doesNotMatch(admin, /\/api\/hotspot\/users\/update/);
  assert.match(admin, /window\.editHotspotUserProfile360/);
  assert.match(read("public/js/hotspot-profile360.js"), /window\.editHotspotUserProfile360=async function/);
});
