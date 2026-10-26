const net = require("node:net");
const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

async function withTimeout(promise, ms, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function getEffectiveTarget() {
  try {
    const result = await withTimeout(
      db.query("SELECT host,api_port FROM router_devices WHERE is_active=TRUE AND api_type='native_api' ORDER BY id ASC LIMIT 1"),
      1500,
      "Router device lookup timed out"
    );
    const router = result.rows?.[0];
    if (!router) {
      return { host: "", port: 8728, source: "router_devices", settingsWarning: "No router has been manually added through Add Device." };
    }
    return {
      host: String(router.host || "").trim(),
      port: Number.parseInt(String(router.api_port || "8728"), 10),
      source: "router_devices"
    };
  } catch (error) {
    return {
      host: "",
      port: 8728,
      source: "router_devices_unavailable",
      settingsWarning: String(error?.message || "Router device lookup failed")
    };
  }
}

function testTcp(host, port, timeoutMs = 2500) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish({ connected: true, message: "TCP connection succeeded" }));
    socket.once("timeout", () => finish({ connected: false, message: "TCP connection timed out" }));
    socket.once("error", error => finish({
      connected: false,
      message: error?.code === "ECONNREFUSED" ? "TCP connection refused" :
        error?.code === "ENETUNREACH" || error?.code === "EHOSTUNREACH" ? "Network route unavailable" :
        error?.code === "ETIMEDOUT" ? "TCP connection timed out" : "TCP connection failed"
    }));
    try {
      socket.connect({ host, port });
    } catch (_) {
      finish({ connected: false, message: "TCP connection could not be started" });
    }
  });
}

async function mikrotikTest(req, res) {
  let dbStatus = "unhealthy";
  let dbError = null;
  let target;
  try {
    await withTimeout(db.query("SELECT 1"), 1500, "Database health check timed out");
    dbStatus = "healthy";
  } catch (error) {
    dbError = String(error?.message || "Database check failed");
  }

  try {
    target = await getEffectiveTarget();
  } catch (_) {
    target = { host: "", port: 8728, source: "unknown" };
  }

  const validTarget = target.host && Number.isInteger(target.port) && target.port >= 1 && target.port <= 65535;
  const tcp = validTarget
    ? await testTcp(target.host, target.port)
    : { connected: false, message: "Effective MikroTik host/port is not configured correctly" };

  let router = null;
  let routerError = null;
  if (tcp.connected) {
    try {
      router = await withTimeout(
        mikrotikService.testConnection(),
        7500,
        "RouterOS API identity test timed out"
      );
    } catch (error) {
      routerError = String(error?.message || "RouterOS API test failed");
    }
  } else {
    routerError = tcp.message;
  }

  const routerStatus = router ? "connected" : "unavailable";
  const success = dbStatus === "healthy" && tcp.connected && routerStatus === "connected";
  return res.status(success ? 200 : 503).set("Cache-Control", "no-store").json({
    success,
    checkedAt: new Date().toISOString(),
    database: { status: dbStatus, ...(dbError ? { error: dbError } : {}) },
    endpoint: {
      host: target.host || null,
      port: validTarget ? target.port : null,
      source: target.source
    },
    tcp: { status: tcp.connected ? "connected" : "failed", message: tcp.message },
    routerOS: {
      status: routerStatus,
      identity: router?.routerName || null,
      board: router?.boardName || router?.model || null,
      version: router?.version || null,
      uptime: router?.uptime || null,
      ...(routerError ? { error: routerError } : {})
    }
  });
}

module.exports = { mikrotikTest };
