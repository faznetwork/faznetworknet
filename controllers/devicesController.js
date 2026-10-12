const db = require("../db");
const mikrotikService = require("../services/mikrotikService");
const deviceCredentials = require("../services/deviceCredentials");
const { RouterOSAPI } = require("node-routeros");

function withTimeout(promise, ms, message) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(message)), ms); })
  ]).finally(() => clearTimeout(timer));
}
async function withMikroTikDevice(config, callback) {
  const connection = new RouterOSAPI({ host: config.host, port: config.port, user: config.user, password: config.password || "", timeout: 8, keepalive: false });
  if (typeof connection.on === "function") connection.on("error", () => {});
  try {
    await withTimeout(connection.connect(), 9000, "MikroTik connection timed out");
    return await withTimeout(callback(connection), 9000, "MikroTik API request timed out");
  } finally { try { connection.close(); } catch (_) {} }
}
async function testMikroTik(config) {
  return withMikroTikDevice(config, async connection => {
    const rows = await connection.write("/system/identity/print");
    const identity = Array.isArray(rows) ? rows[0] : null;
    if (!identity) throw new Error("RouterOS API connected but did not return router identity.");
    return { connected: true, routerName: String(identity.name || "MikroTik Router"), message: "Connection Established" };
  });
}
function normalizeDeviceConfig(body) {
  const host = clean(body.managementIp, 512);
  const port = body.managementPort === "" || body.managementPort == null ? 8728 : Number(body.managementPort);
  const user = clean(body.managementUsername, 160);
  const password = String(body.managementPassword ?? "");
  if (!host) throw Object.assign(new Error("MikroTik management IP / host is required."), { statusCode: 400 });
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Object.assign(new Error("API port must be from 1 to 65535."), { statusCode: 400 });
  if (!user) throw Object.assign(new Error("MikroTik API username is required."), { statusCode: 400 });
  if (password.length > 1024) throw Object.assign(new Error("MikroTik API password is too long."), { statusCode: 400 });
  return { host, port, user, password };
}

const TYPES = new Set(["mikrotik","olt","onu","ont","access_point","cpe","other"]);
function clean(value, max = 240) { return String(value ?? "").trim().slice(0, max); }
function sendError(res, error) {
  console.error("[Devices API]", error?.message || error);
  return res.status(error?.statusCode || 500).json({ success: false, message: error?.message || "Device operation failed." });
}
exports.list = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, device_type AS "deviceType", name, vendor, model,
             host(management_ip) AS "managementIp", management_port AS "managementPort", management_username AS "managementUsername", (encrypted_management_password IS NOT NULL) AS "hasManagementPassword", mac_address::text AS "macAddress",
             serial_number AS "serialNumber", location, parent_device_id AS "parentDeviceId",
             notes, last_seen_at AS "lastSeenAt", created_at AS "createdAt", updated_at AS "updatedAt"
      FROM network_devices ORDER BY device_type, lower(name), id
    `);
    res.json({ success: true, devices: result.rows });
  } catch (error) { sendError(res, error); }
};
exports.create = async (req, res) => {
  try {
    const body = req.body || {};
    const deviceType = clean(body.deviceType, 24).toLowerCase();
    const name = clean(body.name, 120);
    if (!TYPES.has(deviceType)) return res.status(400).json({ success: false, message: "Select a supported device type." });
    if (!name) return res.status(400).json({ success: false, message: "Device name is required." });
    let managementInput = clean(body.managementIp, 512);
    const mac = clean(body.macAddress, 32).replace(/-/g, ":");
    let managementPort = body.managementPort === "" || body.managementPort == null ? null : Number(body.managementPort);
    // Be tolerant of IPv4:port pasted into the IP field. The database inet
    // column must receive only the IP; the dedicated port field remains source
    // of truth when supplied.
    const ipv4WithPort = managementInput.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
    if (ipv4WithPort) {
      managementInput = ipv4WithPort[1];
      if (managementPort === null) managementPort = Number(ipv4WithPort[2]);
    }
    const managementUsername = clean(body.managementUsername, 160) || null;
    const managementPassword = String(body.managementPassword ?? "");
    if (managementPort !== null && (!Number.isInteger(managementPort) || managementPort < 1 || managementPort > 65535)) return res.status(400).json({ success: false, message: "Management port must be from 1 to 65535." });
    if (managementPassword.length > 1024) return res.status(400).json({ success: false, message: "Management password is too long." });
    if (!["olt", "mikrotik"].includes(deviceType) && (managementUsername || managementPassword || managementPort !== null)) return res.status(400).json({ success: false, message: "Management credentials are supported for MikroTik and OLT devices only." });
    const encryptedManagementPassword = managementPassword ? deviceCredentials.encrypt(managementPassword) : null;
    let ip = managementInput;
    // PostgreSQL inet stores an address, not a browser URL. Accept an IP-based
    // HTTP(S) URL in the form and persist only its host address.
    if (/^https?:\/\//i.test(managementInput)) {
      try {
        const parsed = new URL(managementInput);
        if (parsed.username || parsed.password || parsed.search || parsed.hash) {
          return res.status(400).json({ success: false, message: "Enter the browser URL without credentials, query parameters, or fragments." });
        }
        ip = parsed.hostname.replace(/^\[|\]$/g, "");
        if (!/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && !ip.includes(":")) {
          return res.status(400).json({ success: false, message: "Use an IP-based browser URL. Configure its port and login path in OLT Management." });
        }
      } catch {
        return res.status(400).json({ success: false, message: "Enter a valid management IP address or browser URL." });
      }
    }
    if (ip && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip) && !ip.includes(":")) return res.status(400).json({ success: false, message: "Enter a valid IPv4 or IPv6 management address, or an IP-based browser URL." });
    if (mac && !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) return res.status(400).json({ success: false, message: "Enter a valid MAC address." });
    const parentId = body.parentDeviceId ? Number(body.parentDeviceId) : null;
    let connection = { connected: false, message: "Not tested: complete the MikroTik API settings and test the connection." };
    if (deviceType === "mikrotik" && ip && managementUsername) {
      try {
        connection = await testMikroTik({ host: ip, port: managementPort || 8728, user: managementUsername, password: managementPassword });
      } catch (error) {
        connection = { connected: false, message: clean(error?.message || "MikroTik connection failed.", 300) };
      }
    }
    const result = await db.query(`
      INSERT INTO network_devices
        (device_type, name, vendor, model, management_ip, management_port, management_username, encrypted_management_password, mac_address, serial_number, location, parent_device_id, notes, last_seen_at)
      VALUES ($1,$2,$3,$4,$5::inet,$6,$7,$8,$9::macaddr,$10,$11,$12,$13,CASE WHEN $14 THEN NOW() ELSE NULL END)
      RETURNING id, device_type AS "deviceType", name, vendor, model,
                host(management_ip) AS "managementIp", management_port AS "managementPort", management_username AS "managementUsername", (encrypted_management_password IS NOT NULL) AS "hasManagementPassword", mac_address::text AS "macAddress",
                serial_number AS "serialNumber", location, parent_device_id AS "parentDeviceId",
                notes, last_seen_at AS "lastSeenAt", created_at AS "createdAt"
    `, [deviceType,name,clean(body.vendor,120)||null,clean(body.model,120)||null,ip||null,managementPort || (deviceType === "mikrotik" ? 8728 : null),managementUsername,encryptedManagementPassword,mac||null,clean(body.serialNumber,160)||null,clean(body.location,240)||null,Number.isSafeInteger(parentId)&&parentId>0?parentId:null,clean(body.notes,2000)||null,Boolean(connection.connected)]);
    res.status(201).json({ success: true, device: result.rows[0], connection });
  } catch (error) { sendError(res, error); }
};
exports.remove = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Invalid device ID." });
    const result = await db.query("DELETE FROM network_devices WHERE id=$1 RETURNING id", [id]);
    if (!result.rowCount) return res.status(404).json({ success: false, message: "Device not found." });
    res.json({ success: true, deletedId: id });
  } catch (error) { sendError(res, error); }
};
exports.testMikrotikConnection = async (req, res) => {
  try {
    const config = normalizeDeviceConfig(req.body || {});
    const result = await testMikroTik(config);
    return res.json({ success: true, connection: result, checkedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(error?.statusCode || 503).json({
      success: false,
      connection: { connected: false, message: clean(error?.message || "MikroTik connection failed.", 300) },
      message: clean(error?.message || "MikroTik connection failed.", 300)
    });
  }
};

exports.discoverMikrotik = async (req, res) => {
  try {
    const id = Number(req.query.deviceId);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Select a registered MikroTik device before discovery." });
    const found = await db.query(`
      SELECT id, name, host(management_ip) AS host, management_port AS port,
             management_username AS "user", encrypted_management_password AS password
      FROM network_devices WHERE id=$1 AND device_type='mikrotik' LIMIT 1
    `, [id]);
    const device = found.rows[0];
    if (!device) return res.status(404).json({ success: false, message: "Registered MikroTik device not found." });
    if (!device.host || !device.user || !device.password) return res.status(400).json({ success: false, message: "This device has no saved API credentials. Register it with its MikroTik API username and password first." });
    const config = { host: device.host, port: Number(device.port || 8728), user: device.user, password: deviceCredentials.decrypt(device.password) };
    const data = await withMikroTikDevice(config, async connection => {
      const [identityRows, resourceRows, interfaceRows, bridgeRows] = await Promise.all([
        connection.write("/system/identity/print"), connection.write("/system/resource/print"),
        connection.write("/interface/print"), connection.write("/interface/bridge/host/print").catch(() => [])
      ]);
      const identity = Array.isArray(identityRows) ? identityRows[0] || {} : {};
      const resources = Array.isArray(resourceRows) ? resourceRows[0] || {} : {};
      const allowed = ["ether","ethernet","sfp","sfp-sfpplus","sfpplus","bridge","vlan","pppoe","lte","bonding"];
      const interfaces = (Array.isArray(interfaceRows) ? interfaceRows : []).filter(item => allowed.some(type => String(item.type || "").toLowerCase().includes(type))).map(item => ({
        name: String(item.name || ""), type: String(item.type || "unknown"),
        running: ["true","yes"].includes(String(item.running).toLowerCase()),
        disabled: ["true","yes"].includes(String(item.disabled).toLowerCase()), comment: String(item.comment || "")
      })).filter(item => item.name);
      const bridgeHosts = (Array.isArray(bridgeRows) ? bridgeRows : []).map(item => ({
        macAddress: String(item["mac-address"] || ""), interface: String(item["on-interface"] || ""),
        bridge: String(item.bridge || ""), vlanId: String(item.vid || ""),
        dynamic: ["true","yes"].includes(String(item.dynamic).toLowerCase()),
        local: ["true","yes"].includes(String(item.local).toLowerCase())
      })).filter(item => item.macAddress && !item.local);
      return {
        router: { routerName: String(identity.name || device.name), version: String(resources.version || "Unknown"), model: String(resources["board-name"] || resources.platform || "RouterOS device"), uptime: String(resources.uptime || "unknown") },
        resources: { cpuLoad: Number(resources["cpu-load"] || 0), boardName: String(resources["board-name"] || resources.platform || "Unknown"), version: String(resources.version || "Unknown"), uptime: String(resources.uptime || "unknown") },
        interfaces, bridgeHosts
      };
    });
    await db.query("UPDATE network_devices SET last_seen_at=NOW(),updated_at=NOW() WHERE id=$1", [id]);
    return res.json({ success: true, readOnly: true, checkedAt: new Date().toISOString(), device: { id, name: device.name }, ...data,
      notes: ["Discovery uses the selected saved MikroTik device, not Render's default/global router configuration.", "Bridge host MACs are learned observations, not guaranteed customer identities.", "OLT PON/ONU discovery belongs in OLT Management and requires its own supported protocol."] });
  } catch (error) {
    return res.status(503).json({ success: false, message: clean(error?.message || "MikroTik discovery failed.", 300) });
  }
};


exports.discoveryStatus = async (req, res) => {
  try {
    const [setting, latest] = await Promise.all([
      db.query("SELECT value FROM app_settings WHERE key='network_discovery_interval_minutes' LIMIT 1"),
      db.query("SELECT id,run_type AS \"runType\",status,started_at AS \"startedAt\",finished_at AS \"finishedAt\",discovered_count AS \"discoveredCount\",matched_count AS \"matchedCount\",unmatched_count AS \"unmatchedCount\",error_message AS \"errorMessage\" FROM network_discovery_runs WHERE run_type='scheduled' ORDER BY started_at DESC LIMIT 1")
    ]);
    const allowed = new Set([5, 10, 15, 30, 60]);
    const configured = Number(setting.rows[0]?.value || 10);
    return res.json({
      success: true,
      intervalMinutes: allowed.has(configured) ? configured : 10,
      lastRun: latest.rows[0] || null,
      scheduler: "server-side read-only MikroTik discovery"
    });
  } catch (error) {
    console.error("[Network discovery status]", error.message);
    return res.status(503).json({ success: false, message: "Network discovery status is temporarily unavailable." });
  }
};

exports.discoverNetworkMap = async (req, res) => {
  let runId = null;
  try {
    // Read-only collection: this endpoint never provisions or changes RouterOS.
    const [sessions, bridgeHosts, router] = await Promise.all([
      mikrotikService.getActiveSessions(),
      mikrotikService.getBridgeHosts().catch((error) => {
        console.warn("[Network mapping] Bridge-host discovery unavailable:", error.message);
        return [];
      }),
      mikrotikService.testConnection()
    ]);
    const deviceResult = await db.query(
      "SELECT id FROM network_devices WHERE device_type='mikrotik' ORDER BY id LIMIT 1"
    );
    const deviceId = deviceResult.rows[0]?.id || null;
    const runResult = await db.query(
      "INSERT INTO network_discovery_runs (device_id,run_type,status,details) VALUES ($1,'manual','running',$2::jsonb) RETURNING id",
      [deviceId, JSON.stringify({ router, collector: "mikrotik-read-only" })]
    );
    runId = runResult.rows[0].id;
    let matched = 0;
    let unmatched = 0;
    for (const session of sessions) {
      const username = clean(session.username, 100);
      if (!username) continue;
      const customerResult = await db.query(
        "SELECT id,username FROM customers WHERE lower(username)=lower($1) LIMIT 2",
        [username]
      );
      const customer = customerResult.rows.length === 1 ? customerResult.rows[0] : null;
      const status = customer ? "matched" : customerResult.rows.length > 1 ? "ambiguous" : "unmatched";
      const value = {
        username,
        ip: clean(session.address, 64) || null,
        routerMac: clean(session.callerId, 100) || null,
        uptime: clean(session.uptime, 100) || null,
        service: clean(session.service, 40) || "pppoe"
      };
      await db.query(
        `INSERT INTO network_observations
          (discovery_run_id,source_device_id,customer_id,observation_type,identity_type,identity_value,observed_value,match_status,match_confidence,evidence)
         VALUES ($1,$2,$3,'pppoe_session','pppoe_username',$4,$5::jsonb,$6,$7,$8::jsonb)`,
        [runId, deviceId, customer?.id || null, username, JSON.stringify(value), status,
          customer ? 1 : null, JSON.stringify({ rule: customer ? "exact_case_insensitive_pppoe_username" : "no_unique_customer_match", source: "mikrotik_ppp_active" })]
      );
      if (customer) matched++; else unmatched++;
    }
    // Bridge host MACs are observations only. Never infer that a learned MAC
    // is an ONU or a particular customer without independent evidence.
    for (const host of bridgeHosts) {
      await db.query(
        `INSERT INTO network_observations
          (discovery_run_id,source_device_id,observation_type,identity_type,identity_value,observed_value,match_status,evidence)
         VALUES ($1,$2,'bridge_host','mac_address',$3,$4::jsonb,'unmatched',$5::jsonb)`,
        [runId, deviceId, clean(host.macAddress, 32),
          JSON.stringify({ interface: host.interface || null, bridge: host.bridge || null, vlanId: host.vlanId || null, dynamic: Boolean(host.dynamic) }),
          JSON.stringify({ rule: "no_customer_identity_inferred", source: "mikrotik_bridge_host" })]
      );
      unmatched++;
    }
    await db.query(
      "UPDATE network_discovery_runs SET status='succeeded',finished_at=NOW(),discovered_count=$2,matched_count=$3,unmatched_count=$4 WHERE id=$1",
      [runId, sessions.length + bridgeHosts.length, matched, unmatched]
    );
    if (deviceId) await db.query("UPDATE network_devices SET last_seen_at=NOW(),updated_at=NOW() WHERE id=$1", [deviceId]);
    return res.json({
      success: true,
      readOnly: true,
      runId,
      checkedAt: new Date().toISOString(),
      counts: { activePppoeSessions: sessions.length, bridgeHostMacs: bridgeHosts.length, matchedCustomers: matched, unmatchedObservations: unmatched },
      notes: [
        "Router MAC is sourced from MikroTik PPPoE caller-id; it is not treated as ONU MAC.",
        "Bridge host MACs are retained as unmatched observations until independent evidence identifies them.",
        "OLT/PON/ONU collection is not yet active; vendor-specific adapter and protocol access are required."
      ]
    });
  } catch (error) {
    if (runId) {
      try {
        await db.query("UPDATE network_discovery_runs SET status='failed',finished_at=NOW(),error_message=$2 WHERE id=$1", [runId, clean(error.message, 1000)]);
      } catch (writeError) {
        console.error("[Network mapping] Could not mark discovery run failed:", writeError.message);
      }
    }
    console.error("[Network mapping discovery]", error?.message || error);
    return res.status(503).json({ success: false, message: "Network discovery failed. No MikroTik configuration was changed." });
  }
};
