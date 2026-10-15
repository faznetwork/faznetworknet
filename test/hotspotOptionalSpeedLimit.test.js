"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function loadHotspotController() {
  const controllerPath = path.resolve(__dirname, "../controllers/hotspotController.js");
  const originalLoad = Module._load;
  const state = { creates: [], updates: [], queries: [] };
  const db = {
    async query(sql, params = []) {
      state.queries.push({ sql, params });
      if (sql.includes("SELECT value FROM app_settings")) return { rows: [] };
      return { rows: [] };
    }
  };
  const mikrotik = {
    async createHotspotProfile(data) { state.creates.push(data); return { name: data.name }; },
    async updateHotspotProfile(data) { state.updates.push(data); return { name: data.name, id: "*1" }; }
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

test("Hotspot profile create accepts an empty optional speed limit", async () => {
  const { controller, state } = loadHotspotController();
  const res = responseRecorder();
  await controller.createProfile({
    body: { name: "UnlimitedTest", sharedUsers: 1, price: 150, validityValue: 30, validityUnit: "days" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(state.creates.length, 1);
  assert.equal(state.creates[0].rateLimit, "");
});

test("PUT-style Hotspot profile update accepts an empty speed limit and uses the path identifier", async () => {
  const { controller, state } = loadHotspotController();
  const res = responseRecorder();
  await controller.updateProfile({
    params: { id: "UnlimitedTest" },
    body: { name: "UnlimitedTest", rateLimit: "", sharedUsers: 1, price: 150, validityValue: 30, validityUnit: "days" }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(state.updates.length, 1);
  assert.equal(state.updates[0].name, "UnlimitedTest");
  assert.equal(state.updates[0].rateLimit, "");
});

test("RouterOS profile creation omits an empty rate-limit attribute", async () => {
  const service = require("../services/mikrotikService");
  const original = service._withConnection;
  const calls = [];
  service._withConnection = async (operation, callback) => callback({
    async write(command, params) { calls.push({ command, params }); return []; }
  });
  try {
    await service.createHotspotProfile({ name: "UnlimitedTest", rateLimit: "", sharedUsers: 1, onLogin: "" });
    const add = calls.find(call => call.command === "/ip/hotspot/user/profile/add");
    assert.ok(add);
    assert.ok(!add.params.some(param => param.startsWith("=rate-limit=")));
  } finally {
    service._withConnection = original;
  }
});

test("RouterOS profile update explicitly clears an existing rate limit when blank", async () => {
  const service = require("../services/mikrotikService");
  const original = service._withConnection;
  const calls = [];
  service._withConnection = async (operation, callback) => callback({
    async write(command, params) {
      calls.push({ command, params });
      if (command === "/ip/hotspot/user/profile/print") return [{ ".id": "*1", name: "UnlimitedTest" }];
      return [];
    }
  });
  try {
    await service.updateHotspotProfile({ name: "UnlimitedTest", rateLimit: "", sharedUsers: 1, onLogin: "" });
    const update = calls.find(call => call.command === "/ip/hotspot/user/profile/set");
    assert.ok(update);
    assert.ok(update.params.includes("=rate-limit="));
  } finally {
    service._withConnection = original;
  }
});
