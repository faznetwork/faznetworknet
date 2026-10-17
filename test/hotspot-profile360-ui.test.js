"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
test("Hotspot Profile 360 routes and customer fields are wired", () => {
 const routes=fs.readFileSync(path.join(root,"routes/hotspotRoutes.js"),"utf8");
 const controller=fs.readFileSync(path.join(root,"controllers/hotspotProfileController.js"),"utf8");
 assert.match(routes,/\/users\/:id\/profile/);assert.match(controller,/normalizePhone/);assert.match(controller,/normalizeMac/);assert.match(controller,/mac_lock/);assert.match(controller,/rechargeHotspotUser|updateHotspotUser/);
});
test("Admin has Profile 360 and professional subscriber rows without General Settings engine controls", () => {
 const view=fs.readFileSync(path.join(root,"views/admin.ejs"),"utf8"),js=fs.readFileSync(path.join(root,"public/js/hotspot-profile360.js"),"utf8"),css=fs.readFileSync(path.join(root,"public/css/hotspot-profile360.css"),"utf8");
 assert.doesNotMatch(view,/hotspotEngineSettingsCard|hotspotEngineMode|hotspotEngineSave/);
 assert.match(view,/hotspot-profile360\.js/);assert.match(view,/hotspot-profile360\.css/);
 assert.match(view,/Professional Hotspot subscriber card rows/);assert.match(view,/SUBSCRIBER \/ DEVICE/);
 assert.match(view,/generalWebhookForm/);assert.match(view,/generalMfsForm/);
 assert.match(js,/hotspot\/users/);assert.doesNotMatch(js,/hotspot-engine|hotspotEngineMode|hotspotEngineSave/);assert.match(js,/mac_lock/);
 assert.match(js,/Edit Hotspot Subscriber Profile/);assert.match(js,/Address \/ Location Note/);
 assert.match(css,/#0f172a/);assert.match(css,/hotspot-mac-pill/);
});

test("All Hotspot Users table has distinct identity fields, semantic validity pills, and non-overlapping icon-only actions", () => {
 const view=fs.readFileSync(path.join(root,"views/admin.ejs"),"utf8");
 assert.match(view,/\.hotspot-table-header th\{background:#0f172a!important;color:#f8fafc!important/);
 assert.match(view,/tbody tr\.hotspot-user-row\{background:#fff!important/);
 assert.match(view,/\.actions-cell-wrapper\{display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:8px!important/);
 assert.match(view,/btn-action-view/);assert.match(view,/btn-action-renew/);assert.match(view,/btn-action-edit/);assert.match(view,/btn-action-delete/);
 assert.match(view,/const subscriberName=u=>/);assert.match(view,/Unnamed Subscriber/);
 assert.match(view,/const remainingMarkup=u=>/);assert.match(view,/is-warning/);assert.match(view,/is-danger/);assert.match(view,/is-good/);
 assert.match(view,/class="hotspot-table-head hotspot-table-header"/);
 assert.doesNotMatch(view,/<span class="d-none d-xl-inline ms-1">Renew<\/span>/);
});

test("All Hotspot Users renders a responsive master-detail Subscriber 360 workspace", () => {
 const view=fs.readFileSync(path.join(root,"views/admin.ejs"),"utf8");
 const js=fs.readFileSync(path.join(root,"public/js/hotspot-master-detail.js"),"utf8");
 const css=fs.readFileSync(path.join(root,"public/css/hotspot-master-detail.css"),"utf8");
 assert.match(view,/renderHotspotMasterDetail\)window\.renderHotspotMasterDetail\(all\)/);
 assert.match(view,/hotspot-master-detail\.js/);assert.match(view,/hotspot-master-detail\.css/);
 for(const id of ["hotspotMasterSearch","subscriberMasterList","hotspot-total-count","subscriberDetailCard","subscriberDetailBody","detailCustomerName","detailPhone","detailMac","detailIp","detailUptime","detailExpiry","detailRemaining","actionRenewBtn","actionEditBtn","actionKickBtn","actionDeleteBtn"]) assert.ok(js.includes(id), "missing workspace element: "+id);
 assert.match(js,/\/api\/hotspot\/users\/kick/);assert.match(js,/\/api\/hotspot\/users\/remove/);assert.ok(js.includes('encodeURIComponent(id)+"/profile"'));
 assert.match(js,/renewHotspotUser/);assert.match(js,/editHotspotUser/);assert.match(js,/active-subscriber-item/);assert.match(js,/scrollIntoView/);
 assert.match(css,/@media\s*\(max-width:\s*991\.98px\)/);assert.match(css,/position:\s*sticky/);
});

test("Mobile All Hotspot Users keeps subscriber list and Subscriber 360 visible together", () => {
 const css=fs.readFileSync(path.join(root,"public/css/hotspot-master-detail.css"),"utf8");
 assert.match(css,/Keep the same list \+ Subscriber 360 composition on phones/);
 assert.match(css,/subscriber-mobile-detail-open \.hotspot-master-detail-container>\.col-lg-5\{display:block!important\}/);
 assert.match(css,/hotspot-all-users-view #subscriberDetailColumn\{display:block!important\}/);
});


test("Hotspot lifecycle supports first-login and pre-assigned activation plus manual overrides", () => {
 const controller=fs.readFileSync(path.join(root,"controllers/hotspotController.js"),"utf8");
 const profileController=fs.readFileSync(path.join(root,"controllers/hotspotProfileController.js"),"utf8");
 const addView=fs.readFileSync(path.join(root,"views/admin.ejs"),"utf8");
 const editJs=fs.readFileSync(path.join(root,"public/js/hotspot-profile360.js"),"utf8");
 assert.match(controller,/activation_type|activationType/);assert.match(controller,/preassigned\?"active":"unused"/);assert.match(controller,/firstLoginAt=preassigned\?new Date\(\):null/);assert.match(controller,/rechargeHotspotUser/);assert.match(controller,/mac_address/);
 assert.match(profileController,/async function updateProfile/);assert.match(profileController,/expires_at/);assert.match(profileController,/rechargeHotspotUser/);assert.match(profileController,/Profile updated successfully!/);assert.match(profileController,/mac_lock/);
 assert.match(addView,/name="activation_type"/);assert.match(addView,/id="hsDeviceMac"/);assert.match(addView,/id="hsPassword"/);assert.match(addView,/id="hsCustomExpiry"/);
 assert.match(editJs,/profile360Expiry/);assert.match(editJs,/profile360Profile/);assert.match(editJs,/expires_at:f\.elements\.expires_at\.value/);assert.match(editJs,/addEventListener\("submit"/);
});

test("Mobile Subscriber 360 opens a modal while desktop retains detail workspace", () => {
 const js=fs.readFileSync(path.join(root,"public/js/hotspot-master-detail.js"),"utf8");
 const css=fs.readFileSync(path.join(root,"public/css/hotspot-master-detail.css"),"utf8");
 assert.match(js,/id="mobileSubscriberModal"/);assert.match(js,/getOrCreateInstance\(modal\)\.show\(\)/);assert.match(js,/detailPackageName/);assert.match(js,/detailStatus/);
 assert.match(css,/@media\(max-width:991\.98px\)/);assert.match(css,/#mobileSubscriberModal \.modal-body/);assert.match(css,/body:not\(\.sidebar-open\) \.sidebar/);
});

test("Hotspot Profile 360 persists edits by database ID or username/MAC and refreshes subscriber labels", () => {
 const controller=fs.readFileSync(path.join(root,"controllers/hotspotProfileController.js"),"utf8");
 const edit=fs.readFileSync(path.join(root,"public/js/hotspot-profile360.js"),"utf8");
 const master=fs.readFileSync(path.join(root,"public/js/hotspot-master-detail.js"),"utf8");
 assert.match(controller,/Update request/);
 assert.match(controller,/LOWER\(username\)=LOWER\(\$2\) OR LOWER\(mac_address\)=LOWER\(\$2\)/);
 assert.match(controller,/SET username=\$1,password=\$2,customer_name=\$3,phone=\$4,mac_address=\$5,note=\$6/);
 assert.match(controller,/quota\?String\(quota\):null,row\.id/);
 assert.match(edit,/Number\(row\.voucherId\)>0\?String\(Number\(row\.voucherId\)\):String\(row\.username/);
 assert.match(edit,/#detailCustomerName/);assert.match(edit,/#detailPhone/);
 assert.match(edit,/\.subscriber-master-name/);assert.match(edit,/\.subscriber-master-phone/);
 assert.match(master,/String\(u\.voucherId\)>0\?String\(Number\(u\.voucherId\)\):String\(u\.username/);
});
