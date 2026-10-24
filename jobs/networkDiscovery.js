const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

let running = false;

async function runNetworkDiscovery() {
  if (running) return { skipped: true, reason: "previous_run_active" };
  running = true;
  let runId = null;
  let source = null;
  try {
    // Only explicitly enabled RouterOS sources may be scanned in the background.
    const sourceResult = await db.query(
      "SELECT s.id AS source_id, s.device_id FROM network_discovery_sources s JOIN network_devices d ON d.id=s.device_id WHERE s.enabled=TRUE AND s.protocol IN ('routeros_api','mikrotik_api') AND d.device_type='mikrotik' ORDER BY s.id LIMIT 1"
    );
    if (!sourceResult.rowCount) {
      console.info("[NETWORK DISCOVERY] Skipped: no enabled MikroTik discovery source.");
      return { skipped: true, reason: "no_enabled_mikrotik_discovery_source" };
    }
    source = sourceResult.rows[0];
    const deviceId = source.device_id;

    // Create the run before opening sockets so connection failures are visible in history.
    await db.query(
      "UPDATE network_discovery_sources SET last_attempt_at=NOW(),last_status='pending',last_error=NULL,updated_at=NOW() WHERE id=$1",
      [source.source_id]
    );
    const created = await db.query(
      "INSERT INTO network_discovery_runs (source_id,device_id,run_type,status,details) VALUES ($1,$2,'scheduled','running',$3::jsonb) RETURNING id",
      [source.source_id, deviceId, JSON.stringify({ collector: "mikrotik-read-only", cadence: "10m" })]
    );
    runId = created.rows[0].id;

    // Discovery is observation-only: no RouterOS provisioning/configuration calls.
    const [sessions, bridgeResult, router] = await Promise.all([
      mikrotikService.getActiveSessions(),
      mikrotikService.getBridgeHosts().then(
        (hosts) => ({ hosts, available: true }),
        (error) => {
          console.warn("[NETWORK DISCOVERY] Bridge host table unavailable:", error.message);
          return { hosts: [], available: false, error: String(error.message || "Bridge host query failed").slice(0, 500) };
        }
      ),
      mikrotikService.testConnection()
    ]);
    const bridgeHosts = bridgeResult.hosts;
    let matched = 0;
    let unmatched = 0;
    let discovered = 0;
    let onuAutoMapped = 0;
    let onuAutoAmbiguous = 0;

    await db.query(
      "UPDATE network_discovery_runs SET details=$2::jsonb WHERE id=$1",
      [runId, JSON.stringify({ router, collector: "mikrotik-read-only", cadence: "10m", bridgeHostsAvailable: bridgeResult.available, bridgeHostsError: bridgeResult.error || null, onuAutoMapped, onuAutoAmbiguous })]
    );

    for (const session of sessions) {
      const username = String(session.username || "").trim().slice(0, 100);
      if (!username) continue;
      const result = await db.query(
        "SELECT id,username FROM customers WHERE LOWER(username)=LOWER($1) LIMIT 2",
        [username]
      );
      const customer = result.rows.length === 1 ? result.rows[0] : null;
      const status = customer ? "matched" : result.rows.length > 1 ? "ambiguous" : "unmatched";
      const observedValue = {
        username,
        ip: String(session.address || "").slice(0, 64) || null,
        routerMac: String(session.callerId || "").slice(0, 100) || null,
        uptime: String(session.uptime || "").slice(0, 100) || null,
        service: String(session.service || "pppoe").slice(0, 40)
      };
      await db.query(
        `INSERT INTO network_observations
          (discovery_run_id,source_device_id,customer_id,observation_type,identity_type,identity_value,observed_value,match_status,match_confidence,evidence)
         VALUES ($1,$2,$3,'pppoe_session','pppoe_username',$4,$5::jsonb,$6,$7,$8::jsonb)`,
        [runId, deviceId, customer?.id || null, username, JSON.stringify(observedValue), status,
          customer ? 1 : null, JSON.stringify({ rule: customer ? "exact_case_insensitive_pppoe_username" : "no_unique_customer_match", source: "mikrotik_ppp_active" })]
      );
      discovered++;
      if (customer) matched++; else unmatched++;
    }

    for (const host of bridgeHosts) {
      const mac = String(host.macAddress || "").trim().slice(0, 32);
      if (!mac) continue;
      const hostValue = JSON.stringify({ interface: host.interface || null, bridge: host.bridge || null, vlanId: host.vlanId || null, dynamic: Boolean(host.dynamic) });
      const duplicate = await db.query(
        `SELECT id FROM network_observations
         WHERE source_device_id IS NOT DISTINCT FROM $1
           AND observation_type='bridge_host'
           AND LOWER(identity_value)=LOWER($2)
           AND observed_value=$3::jsonb
           AND observed_at > NOW() - INTERVAL '9 minutes'
         LIMIT 1`,
        [deviceId, mac, hostValue]
      );
      if (duplicate.rowCount) continue;
      await db.query(
        `INSERT INTO network_observations
          (discovery_run_id,source_device_id,observation_type,identity_type,identity_value,observed_value,match_status,evidence)
         VALUES ($1,$2,'bridge_host','mac_address',$3,$4::jsonb,'unmatched',$5::jsonb)`,
        [runId, deviceId, mac, hostValue,
          JSON.stringify({ rule: "no_customer_identity_inferred", source: "mikrotik_bridge_host" })]
      );
      discovered++;
      unmatched++;
    }


    const status = bridgeResult.available ? "succeeded" : "partial";
    const sourceStatus = bridgeResult.available ? "connected" : "partial";
    await db.query(
      "UPDATE network_discovery_runs SET status=$2,finished_at=NOW(),discovered_count=$3,matched_count=$4,unmatched_count=$5 WHERE id=$1",
      [runId, status, discovered, matched, unmatched]
    );
    await db.query(
      "UPDATE network_discovery_sources SET last_success_at=NOW(),last_status=$2,last_error=$3,updated_at=NOW() WHERE id=$1",
      [source.source_id, sourceStatus, bridgeResult.error || null]
    );
    await db.query("UPDATE network_devices SET last_seen_at=NOW(),updated_at=NOW() WHERE id=$1", [deviceId]);
    console.log("[NETWORK DISCOVERY] run=" + runId + " status=" + status + " sessions=" + sessions.length + " bridgeMacs=" + bridgeHosts.length + " matched=" + matched + " unmatched=" + unmatched);
    return { runId, status, discovered, matched, unmatched, onuAutoMapped, onuAutoAmbiguous };
  } catch (error) {
    if (runId) {
      await db.query(
        "UPDATE network_discovery_runs SET status='failed',finished_at=NOW(),error_message=$2 WHERE id=$1",
        [runId, String(error.message || "Discovery failed").slice(0, 1000)]
      ).catch((writeError) => console.warn("[NETWORK DISCOVERY] Could not mark run failed:", writeError.message));
    }
    if (source?.source_id) {
      await db.query(
        "UPDATE network_discovery_sources SET last_status='failed',last_error=$2,updated_at=NOW() WHERE id=$1",
        [source.source_id, String(error.message || "Discovery failed").slice(0, 1000)]
      ).catch((writeError) => console.warn("[NETWORK DISCOVERY] Could not mark source failed:", writeError.message));
    }
    console.warn("[NETWORK DISCOVERY] Scheduled read-only scan failed:", error.message);
    return { failed: true, message: error.message };
  } finally {
    running = false;
  }
}

function startNetworkDiscovery() {
  // First run occurs after schema initialization. A failed router connection is
  // recorded/logged and does not prevent the web process from starting.
  runNetworkDiscovery().catch((error) => console.warn("[NETWORK DISCOVERY] Initial run failed:", error.message));
  return setInterval(() => {
    runNetworkDiscovery().catch((error) => console.warn("[NETWORK DISCOVERY] Scheduled run failed:", error.message));
  }, 10 * 60 * 1000);
}

module.exports = { runNetworkDiscovery, startNetworkDiscovery };
