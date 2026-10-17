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

test("voucher generator refuses random credentials under MAC-based authentication", async () => {
  const { controller, state } = loadController();
  const res = responseRecorder();
  await controller.generate({ body: { quantity: 501, profile: "Gold", validity: "1d", price: 10 } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "MAC_REQUIRED");
  assert.equal(state.creates.length, 0);
  assert.equal(state.queries.length, 0);
});
});

test("voucher generator refuses random credentials under MAC-based authentication", async () => {
  const { controller, state } = loadController();
  const res = responseRecorder();
  await controller.generate({ body: { quantity: 2, profile: "Gold", validity: "1d", price: 10 } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "MAC_REQUIRED");
  assert.equal(state.creates.length, 0);
  assert.equal(state.queries.length, 0);
});

test("voucher generator refuses partial provisioning under MAC-based authentication", async () => {
  const { controller, state } = loadController({ failInsertAt: 2 });
  const res = responseRecorder();
  await controller.generate({ body: { quantity: 3, profile: "Gold", validity: "1d", price: 10 } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.success, false);
  assert.equal(state.creates.length, 0);
  assert.equal(state.removes.length, 0);
});
});
