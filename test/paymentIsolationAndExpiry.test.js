"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const paymentController = require("../controllers/paymentController");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "controllers/paymentController.js"), "utf8");
const portalSource = fs.readFileSync(path.join(root, "views/portal.ejs"), "utf8");

test("Captive portal submits an explicit Hotspot type and package_id", () => {
  assert.match(portalSource, /service_type:\s*"hotspot"/);
  assert.match(portalSource, /package_id:selectedProfile/);
});

test("Hotspot-originated webhook payments never enter the PPPoE customer resolver", () => {
  const webhook = source.slice(source.indexOf("async function webhook"), source.indexOf("async function dynamicWebhook"));
  assert.match(webhook, /serviceType=String\(req\.body\?\.service_type\|\|req\.body\?\.serviceType/);
  assert.ok(webhook.includes('if((serviceType===""||serviceType==="pppoe")&&payment.customerRef)'));
  assert.match(webhook, /if\(!user&&serviceType===\"pppoe\"&&payment\.senderPhone\)/);
  assert.doesNotMatch(webhook, /if\(!user&&payment\.senderPhone\)/);
});

test("Hotspot verification rejects requests with no service type or Hotspot-specific context", async () => {
  const oldQuery = require("../db").query;
  try {
    const db = require("../db");
    let queried = false;
    db.query = async () => { queried = true; return { rows: [] }; };
    const res = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await paymentController.verifyTrx({ ip: "service-type-required-test", body: { phone: "01712345678", trxId: "TX-1", amount: 10, profile_id: "pkg-1" } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "SERVICE_TYPE_REQUIRED");
    assert.equal(queried, false, "reject ambiguous requests before any transaction/customer lookup");

    const hotspotRes = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await paymentController.verifyTrx({ ip: "service-type-inferred-test", body: { phone: "01712345678", trxId: "TX-2", amount: 10, package_id: "1-hour" } }, hotspotRes);
    assert.equal(hotspotRes.statusCode, 404);
    assert.equal(hotspotRes.body.code, "NOT_FOUND_OR_DELAYED");
    assert.equal(queried, true, "a package_id safely infers the Hotspot flow");

    const macRes = { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await paymentController.verifyTrx({ ip: "service-type-mac-inferred-test", body: { phone: "01712345678", trxId: "TX-3", amount: 10, mac: "AA:BB:CC:DD:EE:FF" } }, macRes);
    assert.equal(macRes.statusCode, 404);
    assert.equal(macRes.body.code, "NOT_FOUND_OR_DELAYED");
  } finally {
    require("../db").query = oldQuery;
  }
});

test("PPPoE same-date monthly renewal stacks on an existing future expiry", async () => {
  const result = await paymentController.renewalExpirationDate(1, "2099-01-10");
  assert.equal(result, "2099-02-10");
});

test("PPPoE same-date monthly renewal starts today when the previous expiry is in the past", async () => {
  const now = new Date("2026-10-25T12:00:00Z");
  const result = await paymentController.renewalExpirationDate(1, "2000-01-01", now);
  assert.equal(result, "2026-11-25");
});

test("shared renewal service stacks future expiry and starts expired accounts from Dhaka today",async()=>{
 const service=require("../services/renewalService");
 assert.equal(await service.calculateExpiry({durationMonths:1,currentExpiryDate:"2099-01-10",now:new Date("2026-10-25T12:00:00Z")}),"2099-02-10");
 assert.equal(await service.calculateExpiry({durationMonths:1,currentExpiryDate:"2000-01-01",now:new Date("2026-10-25T12:00:00Z")}),"2026-11-25");
});
test("new payment records and manual claims explicitly separate PPPoE and Hotspot",()=>{
 const schema=fs.readFileSync(path.join(root,"db/schema.sql"),"utf8");
 assert.match(schema,/ADD COLUMN IF NOT EXISTS service_type VARCHAR\(20\)/);
 const webhook=source.slice(source.indexOf("async function webhook"),source.indexOf("async function dynamicWebhook"));
 assert.match(webhook,/service_type/);
 assert.match(webhook,/reference_user/);
 assert.match(source,/claim_flow='manual_hotspot',matched_username=\$2,service_type='hotspot'/);
 assert.match(source,/claim_flow='pppoe',matched_username=\$1,service_type='pppoe'/);
});
