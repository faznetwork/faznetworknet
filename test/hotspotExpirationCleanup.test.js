"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createHotspotExpirationCleanup } = require("../jobs/hotspotExpirationCleanup");

const NOW = new Date("2026-11-21T15:00:00Z");
const MAC = "EE:5B:19:B2:22:EC";
const DEFAULT_TRIAL = { username: "default-trial", comment: "counters and limits for trial users" };

function voucher(overrides = {}) {
  return {
    id: 109,
    username: MAC,
    status: "active",
    comment: "Exp: 2026-11-28 21:11:22",
    validity: "30d",
    first_login_at: new Date("2026-10-29T15:11:22Z"),
    expires_at: new Date("2026-11-28T15:11:22Z"),
    cleanup_status: "not_required",
    phone: null,
    price: 150,
    profile: "30-Day",
    renewal_stacked: false,
    mac_address: null,
    last_known_mac: MAC,
    ...overrides,
  };
}

function harness(voucherRows, snapshotUsers) {
  const queries = [];
  const warnings = [];
  const db = {
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes("WITH due AS")) return { rows: [] };
      if (sql.includes("FROM hotspot_vouchers WHERE (status IN")) return { rows: voucherRows };
      return { rows: [], rowCount: 1 };
    },
  };
  const router = {
    getHotspotExpirationSnapshot: async () => ({ users: snapshotUsers, schedulerNames: [] }),
    cleanupExpiredHotspotUser: async () => ({ verified: true }),
    setHotspotUserComment: async () => true,
  };
  const logger = {
    log: () => {},
    warn: (...args) => warnings.push(args.join(" ")),
    error: () => {},
  };
  const run = createHotspotExpirationCleanup({
    db,
    mikrotikService: router,
    logger,
    notificationDispatcher: { dispatchNotification: () => ({}) },
    now: () => new Date(NOW),
  });
  const expiryUpdates = () => queries.filter((q) => q.sql.startsWith("UPDATE hotspot_vouchers SET status='expired'"));
  return { queries, warnings, run, expiryUpdates };
}

test("Router absence never expires a hotspot voucher whose meyad is still future", async () => {
  const { run, expiryUpdates, warnings } = harness([voucher()], [DEFAULT_TRIAL]);
  const summary = await run();
  assert.equal(summary.expired, 0);
  assert.equal(expiryUpdates().length, 0);
  assert.ok(warnings.some((w) => w.includes(MAC) && w.includes("still-valid")));
});

test("A past-due hotspot voucher missing from the router is still expired", async () => {
  const past = voucher({ expires_at: new Date("2026-11-20T15:11:22Z"), comment: "Exp: 2026-11-20 21:11:22" });
  const { run, expiryUpdates } = harness([past], [DEFAULT_TRIAL]);
  const summary = await run();
  assert.equal(summary.expired, 1);
  assert.equal(expiryUpdates().length, 1);
  assert.equal(expiryUpdates()[0].params[1].getTime(), past.expires_at.getTime());
});

test("A still-valid hotspot voucher present on the router is left alone", async () => {
  const onRouter = { username: MAC, comment: "Exp: 2026-11-28 21:11:22", profile: "30-Day" };
  const { run, expiryUpdates, warnings } = harness([voucher()], [DEFAULT_TRIAL, onRouter]);
  const summary = await run();
  assert.equal(summary.expired, 0);
  assert.equal(expiryUpdates().length, 0);
  assert.equal(warnings.length, 0);
});
