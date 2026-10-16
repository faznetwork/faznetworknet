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
test("Admin has Profile 360 and professional subscriber rows without General Settings engine controls", () => {
 const view=fs.readFileSync(path.join(root,"views/admin.ejs"),"utf8"),js=fs.readFileSync(path.join(root,"public/js/hotspot-profile360.js"),"utf8"),css=fs.readFileSync(path.join(root,"public/css/hotspot-profile360.css"),"utf8");
 assert.doesNotMatch(view,/hotspotEngineSettingsCard|hotspotEngineMode|hotspotEngineSave/);
 assert.match(view,/hotspot-profile360\.js/);assert.match(view,/hotspot-profile360\.css/);assert.match(view,/Expiry \(seconds\)/);
 assert.match(view,/Professional Hotspot subscriber card rows/);assert.match(view,/SUBSCRIBER \/ DEVICE/);
 assert.match(view,/generalWebhookForm/);assert.match(view,/generalMfsForm/);
 assert.match(js,/hotspot\/users/);assert.doesNotMatch(js,/hotspot-engine|hotspotEngineMode|hotspotEngineSave/);assert.match(js,/mac_lock/);
 assert.match(js,/Edit Hotspot Subscriber Profile/);assert.match(js,/Address \/ Location Note/);
 assert.match(css,/#0f172a/);assert.match(css,/hotspot-mac-pill/);
});
