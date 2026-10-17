"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const mikrotik = require("../services/mikrotikService");
const notifications = require("../services/notificationDispatcher");
const controller = require("../controllers/hotspotUserController");

function response() {
  return {
    statusCode: 200, body: null, headers: {},
    status(code) { this.statusCode = code; return this; },
    set(name, value) { this.headers[name] = value; return this; },
    json(body) { this.body = body; return this; }
  };
}
const writeMethods = ["rechargeHotspotUser","removeHotspotUser","kickHotspotUser","deleteHotspotUser","removeHotspotCookie","removeHotspotHost","disconnectHotspotSession"];
async function withMocks(run, queryImpl) {
  const oldQuery = db.query;
  const oldNotification = notifications.dispatchNotification;
  const oldMethods = Object.fromEntries(writeMethods.map(name => [name, mikrotik[name]]));
  let routerWrites = 0;
  for (const name of writeMethods) mikrotik[name] = async () => { routerWrites++; throw new Error("RouterOS mutation forbidden in this test"); };
  db.query = queryImpl;
  notifications.dispatchNotification = () => Promise.resolve();
  try { await run(() => routerWrites); }
  finally {
    db.query = oldQuery;
    notifications.dispatchNotification = oldNotification;
    for (const name of writeMethods) {
      if (oldMethods[name] === undefined) delete mikrotik[name]; else mikrotik[name] = oldMethods[name];
    }
  }
}

test("Profile edit persists customer_name and phone through PostgreSQL before returning success", async () => {
  await withMocks(async getRouterWrites => {
    const res = response();
    await controller.updateProfile({ params: { id: "41" }, body: { customer_name: "Test Subscriber", phone: "01712345678", mac_address: "AA:BB:CC:DD:EE:FF", note: "regression", mac_lock: true } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.subscriber.customer_name, "Test Subscriber");
    assert.equal(res.body.subscriber.phone, "01712345678");
    assert.equal(getRouterWrites(), 0, "profile edit must not call RouterOS mutation methods");
  }, async (sql, params) => {
    if (sql.startsWith("SELECT id FROM hotspot_vouchers")) return { rows: [{ id: 41 }] };
    if (sql.startsWith("UPDATE hotspot_vouchers SET customer_name=")) {
      assert.equal(params[0], "Test Subscriber");
      assert.equal(params[1], "01712345678");
      assert.equal(params[2], "AA:BB:CC:DD:EE:FF");
      assert.equal(params[3], "regression");
      return { rows: [{ id: 41, customer_name: params[0], phone: params[1], mac_address: params[2], note: params[3] }] };
    }
    throw new Error("Unexpected SQL: " + sql);
  });
});

test("Quick Renew stacks expiry from the future expiry rather than from NOW", async () => {
  const oldExpiry = new Date(Date.now() + 6 * 60 * 60 * 1000);
  let savedParams;
  await withMocks(async getRouterWrites => {
    const res = response();
    await controller.renew({ params: { id: "52" }, body: { profile_id: "pkg-day", send_notification: false } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.new_expiry, "new_expiry must be returned");
    const actual = new Date(savedParams[4]).getTime();
    assert.ok(Math.abs(actual - (oldExpiry.getTime() + 24 * 60 * 60 * 1000)) < 1500, "renewal expiry should stack one day on the existing future expiry");
    assert.equal(savedParams[6], true, "renewal_stacked should be true for a future existing expiry");
    assert.equal(getRouterWrites(), 0, "renewal must not mutate RouterOS during this rebuild");
  }, async (sql, params) => {
    if (sql.startsWith("SELECT * FROM hotspot_vouchers")) return { rows: [{ id: 52, username: "AA:BB:CC:DD:EE:FF", customer_name: "Test", phone: "01712345678", mac_address: "AA:BB:CC:DD:EE:FF", profile: "Daily", profile_id: "pkg-day", validity: "1 day", price: 10, expires_at: oldExpiry, status: "active" }] };
    if (sql.startsWith("SELECT value FROM app_settings")) return { rows: [{ value: { Daily: { id: "pkg-day", validityValue: 1, validityUnit: "days", price: 10 } } }] };
    if (sql.startsWith("UPDATE hotspot_vouchers SET profile=")) {
      savedParams = params;
      return { rows: [{ id: 52, username: "AA:BB:CC:DD:EE:FF", profile: params[0], expires_at: params[4], status: "active" }] };
    }
    throw new Error("Unexpected SQL: " + sql);
  });
});

test("Archive changes only the PostgreSQL voucher status and never deletes the live MikroTik user", async () => {
  await withMocks(async getRouterWrites => {
    const res = response();
    await controller.archive({ params: { id: "63" } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
    assert.match(res.body.message, /PostgreSQL only/);
    assert.equal(getRouterWrites(), 0);
  }, async sql => {
    if (sql.startsWith("SELECT id FROM hotspot_vouchers")) return { rows: [{ id: 63 }] };
    if (sql.startsWith("UPDATE hotspot_vouchers SET status='archived'")) return { rows: [{ id: 63, username: "AA:BB:CC:DD:EE:FF", status: "archived" }] };
    throw new Error("Unexpected SQL: " + sql);
  });
});
