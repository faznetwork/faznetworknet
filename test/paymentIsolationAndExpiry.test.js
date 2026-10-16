"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const paymentController = require("../controllers/paymentController");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "controllers/paymentController.js"), "utf8");

test("Hotspot-originated webhook payments never enter the PPPoE customer resolver", () => {
  const webhook = source.slice(source.indexOf("async function webhook"), source.indexOf("async function dynamicWebhook"));
  assert.match(webhook, /serviceType=String\(req\.body\?\.service_type\|\|req\.body\?\.serviceType/);
  assert.match(webhook, /if\(serviceType!==\"hotspot\"&&serviceType===\"pppoe\"&&payment\.customerRef\)/);
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

test("PPPoE rolling-30 renewal stacks on an existing future expiry", async () => {
  const query = async () => ({ rows: [{ value: "rolling_30" }] });
  const result = await paymentController.renewalExpirationDate(1, query, "2099-01-10");
  assert.equal(result, "2099-02-09");
});

test("PPPoE rolling-30 renewal starts today when the previous expiry is in the past", async () => {
  const query = async () => ({ rows: [{ value: "rolling_30" }] });
  const today = new Date().toISOString().slice(0, 10);
  const expected = new Date(today + "T00:00:00Z");
  expected.setUTCDate(expected.getUTCDate() + 30);
  const result = await paymentController.renewalExpirationDate(1, query, "2000-01-01");
  assert.equal(result, expected.toISOString().slice(0, 10));
});
