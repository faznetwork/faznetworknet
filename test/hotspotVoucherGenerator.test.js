"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

function loadController({ failInsertAt = 0 } = {}) {
  const controllerPath = path.resolve(__dirname, "../controllers/hotspotController.js");
  const originalLoad = Module._load;
  const state = { queries: [], creates: [], removes: [], insertCount: 0 };
  const db = {
    async query(sql, params = []) {
      state.queries.push({ sql, params });
      if (sql.includes("SELECT 1 FROM hotspot_vouchers")) return { rows: [] };
      if (sql.startsWith("INSERT INTO hotspot_vouchers")) {
        state.insertCount += 1;
        if (failInsertAt && state.insertCount === failInsertAt) throw new Error("simulated database insert failure");
        return { rows: [{ id: state.insertCount }] };
      }
      return { rows: [] };
    }
  };
  const mikrotik = {
    async getHotspotProfiles() { return [{ name: "Gold" }]; },
    async getHotspotUsers() { return [{ username: "already-there" }]; },
    async createHotspotUser(user) { state.creates.push(user); },
    async removeHotspotUser(username) { state.removes.push(username); }
  };
  delete require.cache[controllerPath];
  Module._load = function(request, parent, isMain) {
    if (parent && parent.filename === controllerPath && request === "../db") return db;
    if (parent && parent.filename === controllerPath && request === "../services/mikrotikService") return mikrotik;
    return originalLoad.call(this, request, parent, isMain);
  };
  try {
    return { controller: require(controllerPath), state };
  } finally {
    Module._load = originalLoad;
  }
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

test("voucher generator rejects invalid quantity and validity before RouterOS calls", async () => {
  const { controller, state } = loadController();
  const res = responseRecorder();
  await controller.generate({ body: { quantity: 501, profile: "Gold", validity: "1d", price: 10 } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(state.creates.length, 0);
});

test("voucher generator validates the profile, avoids existing RouterOS names, and returns generated batch", async () => {
  const { controller, state } = loadController();
  const res = responseRecorder();
  await controller.generate({ body: { quantity: 2, profile: "Gold", validity: "1d", price: 10, userPrefix: "FAZ-", charLength: 6 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.count, 2);
  assert.equal(state.creates.length, 2);
  assert.ok(state.creates.every(user => user.profile === "Gold"));
  assert.ok(state.creates.every(user => user.username.toLowerCase() !== "already-there"));
  assert.equal(new Set(res.body.vouchers.map(v => v.username.toLowerCase())).size, 2);
});

test("voucher generator compensates RouterOS users and preserves persisted batch history on partial DB failure", async () => {
  const { controller, state } = loadController({ failInsertAt: 2 });
  const res = responseRecorder();
  await controller.generate({ body: { quantity: 3, profile: "Gold", validity: "1d", price: 10, userPrefix: "FAZ-", charLength: 6 } }, res);
  assert.equal(res.statusCode, 502);
  assert.equal(res.body.success, false);
  assert.equal(res.body.partialBatch, 1);
  assert.equal(state.creates.length, 2);
  assert.equal(state.removes.length, 2);
  const rollbackUpdates = state.queries.filter(q => q.sql.startsWith("UPDATE hotspot_vouchers SET status='expired'"));
  assert.equal(rollbackUpdates.length, 1, "only rows inserted by this batch may be marked expired");
  assert.equal(rollbackUpdates[0].params[1], "completed");
});
