"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("Subscriber profile is persisted before RouterOS synchronization", () => {
  const source = read("controllers/hotspotProfileController.js");
  const handler = source.slice(source.indexOf("async function updateProfile(req,res)"), source.indexOf("\nmodule.exports"));
  const dbWrite = handler.indexOf("UPDATE hotspot_vouchers SET username=");
  assert.ok(dbWrite >= 0, "profile update SQL should exist");
  assert.ok(handler.indexOf("mikrotikService.rechargeHotspotUser") > dbWrite);
  assert.ok(handler.indexOf("mikrotikService.removeHotspotUser") > dbWrite);
  assert.match(handler, /console\.warn\("\[Hotspot Profile API\] PostgreSQL profile saved; MikroTik synchronization failed\."/);
  assert.match(handler, /return res\.json\(\{\s*success:true/);
});

test("Quick Renew supports second-based validity and returns new_expiry", () => {
  const source = read("controllers/hotspotController.js");
  assert.match(source, /function validityMs\(value\)[\s\S]*?\(s\|sec\|secs\|second\|seconds\)/);
  assert.match(source, /u\.startsWith\("s"\)\?1000/);
  assert.match(source, /success:true[\s\S]*?new_expiry:renewed\.expiryLabel/);
});

test("Profile 360 and Quick Renew require explicit success before mutating UI", () => {
  const profileJs = read("public/js/hotspot-profile360.js");
  const admin = read("views/admin.ejs");
  assert.match(profileJs, /if\(!d\|\|d\.success!==true\)throw new Error\(d\?\.message\|\|d\?\.error\|\|"Update failed"\)/);
  const renewStart = admin.indexOf("form.addEventListener('submit', async function (submitEvent)");
  const renewEnd = admin.indexOf("                modal.show();", renewStart);
  assert.ok(renewStart >= 0 && renewEnd > renewStart, "Quick Renew submit handler should exist");
  const renewHandler = admin.slice(renewStart, renewEnd);
  assert.match(renewHandler, /if \(!response \|\| response\.success !== true\)/);
  assert.ok(renewHandler.indexOf("response.success !== true") < renewHandler.indexOf("resultEl.className = 'small mt-3 text-success'"));
  assert.ok(renewHandler.indexOf("response.success !== true") < renewHandler.indexOf("if (typeof refreshHotspotCurrent === 'function') await refreshHotspotCurrent();"));
});

test("Legacy RouterOS-only editor is removed from the admin UI", () => {
  const admin = read("views/admin.ejs");
  assert.doesNotMatch(admin, /\/api\/hotspot\/users\/update/);
  assert.match(admin, /window\.editHotspotUserProfile360/);
  assert.match(read("public/js/hotspot-profile360.js"), /window\.editHotspotUserProfile360=async function/);
});
