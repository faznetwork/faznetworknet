const db = require("../db");
const mikrotikService = require("../services/mikrotikService");
const deviceCredentials = require("../services/deviceCredentials");

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
      // MikroTik API port is configured once in shared Core/API settings,
      // never on an inventory record. Only OLT records may keep a per-device port.
      if (deviceType === "olt" && managementPort === null) managementPort = Number(ipv4WithPort[2]);
    }
    if (deviceType === "mikrotik") managementPort = null;
    const managementUsername = clean(body.managementUsername, 160) || null;
    const managementPassword = String(body.managementPassword ?? "");
    if (managementPort !== null && (!Number.isInteger(managementPort) || managementPort < 1 || managementPort > 65535)) return res.status(400).json({ success: false, message: "Management port must be from 1 to 65535." });
    if (managementPassword.length > 1024) return res.status(400).json({ success: false, message: "Management password is too long." });
    if (deviceType !== "olt" && deviceType !== "mikrotik" && (managementUsername || managementPassword || managementPort !== null)) return res.status(400).json({ success: false, message: "Per-device management credentials are currently supported for OLT devices only." });
    // MikroTik inventory must never store duplicate API credentials or per-device ports;
    // its connection details are owned by the shared Core/API settings.
    const encryptedManagementPassword = deviceType === "olt" && managementPassword ? deviceCredentials.encrypt(managementPassword) : null;
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

    if (deviceType === "mikrotik") {
      const duplicate = await db.query(
        `SELECT id,name,host(management_ip) AS "managementIp"
           FROM network_devices
          WHERE device_type='mikrotik'
            AND (lower(name)=lower($1) OR ($2::inet IS NOT NULL AND management_ip=$2::inet))
          ORDER BY id LIMIT 1`,
        [name, ip || null]
      );
      if (duplicate.rowCount) return res.status(409).json({success:false,code:"DEVICE_DUPLICATE",message:"A MikroTik device with this name or IP already exists.",duplicate:duplicate.rows[0]});
    }    if (mac && !/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) return res.status(400).json({ success: false, message: "Enter a valid MAC address." });
    const parentId = body.parentDeviceId ? Number(body.parentDeviceId) : null;
    const result = await db.query(`
      INSERT INTO network_devices
        (device_type, name, vendor, model, management_ip, management_port, management_username, encrypted_management_password, mac_address, serial_number, location, parent_device_id, notes)
      VALUES ($1,$2,$3,$4,$5::inet,$6,$7,$8,$9::macaddr,$10,$11,$12,$13)
      RETURNING id, device_type AS "deviceType", name, vendor, model,
                host(management_ip) AS "managementIp", management_port AS "managementPort", management_username AS "managementUsername", (encrypted_management_password IS NOT NULL) AS "hasManagementPassword", mac_address::text AS "macAddress",
                serial_number AS "serialNumber", location, parent_device_id AS "parentDeviceId",
                notes, last_seen_at AS "lastSeenAt", created_at AS "createdAt"
    `, [deviceType,name,clean(body.vendor,120)||null,clean(body.model,120)||null,ip||null,deviceType === "olt" ? managementPort : null,deviceType === "olt" ? managementUsername : null,encryptedManagementPassword,mac||null,clean(body.serialNumber,160)||null,clean(body.location,240)||null,Number.isSafeInteger(parentId)&&parentId>0?parentId:null,clean(body.notes,2000)||null]);
    res.status(201).json({ success: true, device: result.rows[0] });
  } catch (error) { sendError(res, error); }
};
exports.update = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({success:false,message:"Invalid device ID."});
    const body = req.body || {};
    const name = clean(body.name,120);
    const location = clean(body.location,240) || null;
    const vendor = clean(body.vendor,120) || null;
    const model = clean(body.model,120) || null;
    const host = clean(body.managementIp,512);
    if (!name) return res.status(400).json({success:false,message:"Device name is required."});
    if (!/^(?:\\d{1,3}\\.){3}\\d{1,3}$/.test(host) || host.split(".").some(part => Number(part)>255)) return res.status(400).json({success:false,message:"Enter a valid IPv4 address."});
    const conflict = await db.query(
      `SELECT id,name,host(management_ip) AS "managementIp" FROM network_devices
        WHERE device_type='mikrotik' AND id<>$1
          AND (lower(name)=lower($2) OR management_ip=$3::inet) LIMIT 1`,
      [id,name,host]
    );
    if (conflict.rowCount) return res.status(409).json({success:false,code:"DEVICE_DUPLICATE",message:"Another MikroTik device already uses this name or IP.",duplicate:conflict.rows[0]});
    const result = await db.query(
      `UPDATE network_devices SET name=$2,vendor=$3,model=$4,management_ip=$5::inet,location=$6,notes=$7,updated_at=NOW()
        WHERE id=$1 AND device_type='mikrotik'
        RETURNING id,device_type AS "deviceType",name,vendor,model,host(management_ip) AS "managementIp",location,notes,last_seen_at AS "lastSeenAt",created_at AS "createdAt",updated_at AS "updatedAt"`,
      [id,name,vendor,model,host,location,clean(body.notes,2000)||null]
    );
    if (!result.rowCount) return res.status(404).json({success:false,message:"MikroTik device not found."});
    return res.json({success:true,device:result.rows[0],message:"MikroTik inventory record updated."});
  } catch (error) { sendError(res,error); }
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
exports.discoverMikrotik = async (req, res) => {
  try {
    // Discovery is deliberately read-only: no RouterOS configuration is changed.
    const [identity, resources, interfaces, bridgeHosts] = await Promise.all([
      mikrotikService.testConnection(),
      mikrotikService.getSystemResources(),
      mikrotikService.getInterfaces(),
      mikrotikService.getBridgeHosts().catch(() => [])
    ]);
    res.json({
      success: true,
      readOnly: true,
      checkedAt: new Date().toISOString(),
      router: identity,
      resources,
      interfaces,
      bridgeHosts,
      notes: [
        "Bridge host MACs are learned observations, not guaranteed customer identities.",
        "A port-to-customer mapping is only shown when separately matched to a panel record.",
        "OLT PON/ONU discovery requires the OLT vendor/model and a supported management protocol."
      ]
    });
  } catch (error) {
    res.status(503).json({ success: false, message: error?.message || "MikroTik discovery failed." });
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
