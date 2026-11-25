"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms || 0));

function loadProber() {
  const file = path.resolve(__dirname, "../services/routerStatusProber.js");
  delete require.cache[file];
  return require(file);
}

function fakeClient(behavior = {}) {
  const calls = [];
  const client = {
    calls,
    async getSystemResources() {
      calls.push("resources");
      await delay(behavior.delayMs);
      if (behavior.fail === "resources" || behavior.fail === "all") throw new Error("resources failed");
      return behavior.resources || { boardName: "RB4011", cpuLoad: 5, memoryUsagePercent: 25, uptime: "1d" };
    },
    async getInterfaces() {
      calls.push("interfaces");
      await delay(behavior.delayMs);
      if (behavior.fail === "interfaces" || behavior.fail === "all") throw new Error("interfaces failed");
      return behavior.interfaces || [];
    },
    async getActiveSessions() {
      calls.push("sessions");
      await delay(behavior.delayMs);
      if (behavior.fail === "sessions" || behavior.fail === "all") throw new Error("sessions failed");
      return behavior.sessions || [];
    },
    async testConnection() {
      calls.push("identity");
      await delay(behavior.delayMs);
      if (behavior.fail === "identity" || behavior.fail === "all") throw new Error("identity failed");
      return behavior.identity || { routerName: "Test", version: "7.24.4", model: "RB4011" };
    },
    async getInterfaceTraffic(name) {
      calls.push("traffic:" + name);
      await delay(behavior.delayMs);
      return (behavior.traffic && behavior.traffic[name]) || null;
    }
  };
  return client;
}

test("never-succeeded yields Checking (router.online null)", () => {
  const prober = loadProber();
  const snapshot = prober.getRouterStatusSnapshot();
  assert.equal(snapshot.state, "checking");
  assert.equal(snapshot.online, null);
  assert.equal(snapshot.lastSeenAt, null);
});

test("starts in Checking and becomes Online after the first probe succeeds", async () => {
  const prober = loadProber();
  const client = fakeClient({ interfaces: [{ name: "ether1", running: true, disabled: false }] });
  prober.startRouterStatusProber({ client, intervalMs: 60000 });
  try {
    const before = prober.getRouterStatusSnapshot();
    assert.equal(before.state, "checking");
    assert.equal(before.online, null);
    await prober.probeOnce();
    const after = prober.getRouterStatusSnapshot();
    assert.equal(after.state, "online");
    assert.equal(after.online, true);
    assert.ok(after.lastSeenAt);
    assert.equal(after.data.resources.boardName, "RB4011");
    assert.equal(after.consecutiveFailures, 0);
  } finally {
    await prober.stopRouterStatusProber();
  }
});

test("a slow in-flight probe does not flip a fresh Online cache to Offline", async () => {
  const prober = loadProber();
  const behavior = { delayMs: 0 };
  const client = fakeClient(behavior);
  prober.startRouterStatusProber({ client, intervalMs: 60000 });
  try {
    await prober.probeOnce();
    assert.equal(prober.getRouterStatusSnapshot().state, "online");
    behavior.delayMs = 500;
    const slowProbe = prober.probeOnce();
    // While the slow probe is still running, the last-known-good status stands.
    const during = prober.getRouterStatusSnapshot();
    assert.equal(during.state, "online");
    assert.equal(during.online, true);
    await slowProbe;
    assert.equal(prober.getRouterStatusSnapshot().state, "online");
  } finally {
    await prober.stopRouterStatusProber();
  }
});

test("a genuinely failed probe yields Offline", async () => {
  const prober = loadProber();
  const client = fakeClient({ fail: "all" });
  prober.startRouterStatusProber({ client, intervalMs: 60000 });
  try {
    await prober.probeOnce();
    const snapshot = prober.getRouterStatusSnapshot();
    assert.equal(snapshot.state, "offline");
    assert.equal(snapshot.online, false);
    assert.ok(snapshot.lastError);
    assert.equal(snapshot.consecutiveFailures, 1);
  } finally {
    await prober.stopRouterStatusProber();
  }
});

test("stale cache yields Offline after the window", async () => {
  const prober = loadProber();
  const client = fakeClient();
  prober.startRouterStatusProber({ client, intervalMs: 60000 });
  try {
    await prober.probeOnce();
    assert.equal(prober.getRouterStatusSnapshot().state, "online");
    // 121 s later, past the 120 s staleness window: Offline.
    const stale = prober.getRouterStatusSnapshot(Date.now() + 121000);
    assert.equal(stale.state, "offline");
    assert.equal(stale.online, false);
    assert.ok(stale.ageMs > 120000);
  } finally {
    await prober.stopRouterStatusProber();
  }
});

test("a failed session list does not mark a reachable router Offline", async () => {
  const prober = loadProber();
  const client = fakeClient({ fail: "sessions" });
  prober.startRouterStatusProber({ client, intervalMs: 60000 });
  try {
    await prober.probeOnce();
    const snapshot = prober.getRouterStatusSnapshot();
    assert.equal(snapshot.state, "online");
    assert.equal(snapshot.online, true);
    assert.equal(snapshot.data.sessions, null);
  } finally {
    await prober.stopRouterStatusProber();
  }
});

test("concurrent probeOnce calls share one in-flight probe and never overlap", async () => {
  const prober = loadProber();
  const client = fakeClient({ delayMs: 200 });
  prober.startRouterStatusProber({ client, intervalMs: 60000 });
  try {
    await Promise.all([prober.probeOnce(), prober.probeOnce(), prober.probeOnce()]);
    assert.equal(client.calls.filter((call) => call === "resources").length, 1);
    assert.equal(prober.getRouterStatusSnapshot().state, "online");
  } finally {
    await prober.stopRouterStatusProber();
  }
});
