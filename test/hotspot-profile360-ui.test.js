"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
test("Hotspot Profile 360 routes and customer fields are wired", () => {
 const routes=fs.readFileSync(path.join(root,"routes/hotspotRoutes.js"),"utf8");
 const controller=fs.readFileSync(path.join(root,"controllers/hotspotProfileController.js"),"utf8");
 assert.match(routes,/\/users\/:id\/profile/);assert.match(controller,/normalizePhone/);assert.match(controller,/normalizeMac/);assert.match(controller,/mac_lock/);assert.match(controller,/updateHotspotUser/);
});
test("Admin has Profile 360, desktop rows, and engine switcher assets", () => {
 const view=fs.readFileSync(path.join(root,"views/admin.ejs"),"utf8"),js=fs.readFileSync(path.join(root,"public/js/hotspot-profile360.js"),"utf8"),css=fs.readFileSync(path.join(root,"public/css/hotspot-profile360.css"),"utf8");
 assert.match(view,/hotspotEngineSettingsCard/);assert.match(view,/hotspot-profile360\.js/);assert.match(view,/hotspot-profile360\.css/);assert.match(view,/Expiry \(seconds\)/);
 assert.match(js,/\/api\/hotspot\/users\/"\+id\+"\/profile/);assert.match(js,/\/api\/settings\/hotspot-engine/);assert.match(js,/mac_lock/);assert.match(css,/#0f172a/);assert.match(css,/hotspot-mac-pill/);
});
