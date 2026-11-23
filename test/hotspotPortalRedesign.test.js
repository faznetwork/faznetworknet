"use strict";
// Phase 5 (P5) + Phase 6 (P6): hotspot captive portal login page redesign — views/portal.ejs
// (light theme, no Tailwind CDN, 3 tabs, deviceLookup status pill,
// Time/Data package split, TrxID-only claim, phone+name required on every form)
// + docs/router-hotspot-login.html (standalone router login page).
// Static source assertions, same style as the P3/P4 portal tests in
// hotspotClaimSecurity.test.js.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const portal = fs.readFileSync(path.join(__dirname, "..", "views", "portal.ejs"), "utf8");
const routerPage = fs.readFileSync(path.join(__dirname, "..", "docs", "router-hotspot-login.html"), "utf8");
// Markup only (before the first <script>): the JS assigns settings-driven
// URLs (wa.me from the helpline, logo/banner from the portal config), but
// the static markup itself must carry zero external requests.
const portalMarkup = portal.split("<script")[0];
const routerMarkup = routerPage.split("<script")[0];

test("P5: portal has no external CDN / external URL in its markup (walled-garden safe)", () => {
  assert.equal(portal.includes("cdn.tailwindcss.com"), false, "the Tailwind CDN must be gone");
  assert.equal(portal.includes("cdn.tailwindcss"), false, "no Tailwind CDN reference anywhere");
  assert.doesNotMatch(portalMarkup, /src\s*=\s*["']https?:\/\//, "no external src= in the markup");
  assert.doesNotMatch(portalMarkup, /href\s*=\s*["']https?:\/\//, "no external href= in the markup");
  assert.doesNotMatch(portalMarkup, /@import|fonts\.googleapis|fonts\.gstatic/, "no external font imports");
  assert.ok(portal.includes("system-ui"), "system UI font stack must be used");
});

test("P5: portal calls device-lookup on load and renders the status pill", () => {
  assert.ok(portal.includes("/api/hotspot-auth/device-lookup"), "deviceLookup must be called on load");
  assert.ok(portal.includes('id="status-pill"'), "the status pill must exist");
  assert.ok(portal.includes("requires_claim_secret"), "the pill must react to requires_claim_secret");
  assert.ok(portal.includes("can_recharge"), "the pill must react to can_recharge");
  assert.ok(portal.includes('params.get("mac")'), "the MAC must be read from the ?mac= query param first");
  assert.ok(portal.includes("resolveDeviceMac"), "the MAC resolver must exist");
});

test("P5: portal splits Time vs Data packages by limitBytesTotal", () => {
  assert.ok(portal.includes("limitBytesTotal"), "the split must use limitBytesTotal, never the name");
  assert.ok(portal.includes("শুধু ডেটা কোটা — মেয়াদ নেই"), "data packages must be labelled data-only / no time expiry");
  assert.ok(portal.includes("টাইম প্যাকেজ"), "time packages must be grouped under their own label");
  assert.ok(portal.includes("ডেটা প্যাকেজ"), "data packages must be grouped under their own label");
});

test("P6: portal claim is TrxID-only — no OTP button, no otp field, TrxID upper-cased", () => {
  const claimFn = portal.slice(portal.indexOf('id="claim-code-submit"'));
  assert.equal(portal.includes('id="claim-code-send"'), false, "the Send WhatsApp OTP button must be gone");
  assert.equal(portal.includes("/api/hotspot-auth/request-claim-otp"), false, "the portal must not call request-claim-otp");
  assert.equal(portal.includes("body.otp"), false, "the claim must never send otp");
  assert.ok(claimFn.includes("trxId:value.toUpperCase()"), "the claim must send the TrxID upper-cased");
  assert.ok(portal.includes('id="claim-phone"'), "the claim box must have its own phone input");
  assert.ok(portal.includes('id="claim-name"'), "the claim box must have its own name input");
});

test("P6: phone + name are required on every portal and router form", () => {
  for (const id of ["phone", "customer-name", "existing-phone", "existing-name", "voucher-phone", "voucher-name", "claim-phone", "claim-name"]) {
    const input = portal.match(new RegExp(`<input id="${id}"[^>]*>`));
    assert.ok(input, `the portal must have input #${id}`);
    assert.match(input[0], /required/, `#${id} must be marked required`);
  }
  assert.equal(portal.includes("(ঐচ্ছিক)"), false, "no portal field may be labelled optional");
  assert.ok(portal.includes("ফোন নম্বর দিন — রিচার্জ ও SMS নোটিফিকেশনের জন্য লাগবে।"), "the missing-phone error must mention recharge/SMS notifications");
  assert.ok(portal.includes("আপনার নাম দিন।"), "the missing-name error must exist");
  for (const id of ["existing-phone", "existing-name", "voucher-phone", "voucher-name", "claim-phone", "claim-name"]) {
    const input = routerPage.match(new RegExp(`<input id="${id}"[^>]*>`));
    assert.ok(input, `the router page must have input #${id}`);
    assert.match(input[0], /required/, `router #${id} must be marked required`);
  }
  assert.equal(routerPage.includes("(ঐচ্ছিক)"), false, "no router field may be labelled optional");
  assert.ok(routerPage.includes("ফোন নম্বর দিন — রিচার্জ ও SMS নোটিফিকেশনের জন্য লাগবে।"), "the router missing-phone error must mention recharge/SMS notifications");
});

test("P5: portal has the receipt card and the three tabs in order", () => {
  assert.ok(portal.includes('id="receipt-card"'), "the receipt card must exist");
  assert.ok(portal.includes('id="receipt-trxid"'), "the receipt must show the TrxID");
  assert.ok(portal.includes("activation_pending"), "the activation-pending verify result must be handled");
  const buy = portal.indexOf('data-tab="buy"');
  const existing = portal.indexOf('data-tab="existing"');
  const voucher = portal.indexOf('data-tab="voucher"');
  assert.ok(buy !== -1 && existing !== -1 && voucher !== -1, "all three tabs must exist");
  assert.ok(buy < existing && existing < voucher, "tab order must be Buy, Existing Login, Voucher");
});

test("P5: router page is a real login page with both login forms and the portal link", () => {
  assert.ok(routerPage.includes('id="existing-login-submit"'), "the router page needs the existing-login button");
  assert.ok(routerPage.includes('id="voucher-claim-submit"'), "the router page needs the voucher claim button");
  assert.ok(routerPage.includes('id="voucher-pin"'), "the router page needs the voucher PIN field");
  assert.ok(routerPage.includes("/portal?mac=$(mac)"), "the router page must link to the portal with the MAC");
  assert.ok(routerPage.includes("https://faznetwork.com/api/hotspot-auth/activate"), "the router page must call activate on the panel API");
  assert.ok(routerPage.includes("https://faznetwork.com/api/hotspot-auth/claim-voucher"), "the router page must call claim-voucher on the panel API");
  assert.ok(routerPage.includes("$(link-login-only)"), "the native MikroTik login form must post to link-login-only");
  assert.ok(routerPage.includes('id="claim-code"'), "the router page needs the TrxID claim input");
  assert.ok(routerPage.includes("trxId: value.toUpperCase()"), "the router claim must send the TrxID upper-cased");
  assert.equal(routerPage.includes("body.otp"), false, "the router claim must never send otp");
  assert.equal(routerPage.includes("/api/hotspot-auth/request-claim-otp"), false, "the router page must not call request-claim-otp");
  assert.equal(routerPage.includes('id="claim-code-send"'), false, "the router page must not have a Send OTP button");
  assert.ok(routerPage.includes('id="claim-name"'), "the router claim box must have its own name input");
});

test("P5: router page keeps the login.html fallback string and link id (P4 contract)", () => {
  assert.ok(routerPage.includes("https://faznetwork.com/login.html"), "the router page must keep the login.html fallback URL");
  assert.ok(routerPage.includes('id="login-link"'), "the fallback link must keep its id");
  assert.ok(routerPage.includes("?mac=$(mac)"), "the fallback must carry the device MAC");
  assert.ok(routerPage.includes("link.href = target"), "the fallback link href must be set from JS");
  assert.ok(routerPage.includes("window.location.replace(target)"), "the fallback redirect must stay");
  assert.doesNotMatch(routerMarkup, /src\s*=\s*["']https?:\/\//, "no external src= in the router markup");
  const externalHrefs = [...routerMarkup.matchAll(/href\s*=\s*["'](https?:\/\/[^"']+)/gi)].map((m) => m[1]);
  for (const href of externalHrefs) assert.ok(href.startsWith("https://faznetwork.com/"), "router links must only go to faznetwork.com, got " + href);
});
