const db = require("../db");
const { getRxPowerStatus } = require("../lib/network/rxPowerStatus");
const { isTelemetryStale, telemetryLastSeen, matchTelemetryIdentity } = require("../lib/network/oltTelemetryFreshness");

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

exports.getCustomerMap = async (req, res) => {
  try {
    const key = clean(req.params.id, 100);
    if (!key) return res.status(400).json({ success: false, message: "Customer ID or username is required." });

    const customerResult = await db.query(
      "SELECT c.id, c.username, c.onu_mac, c.fiber_box, c.onu_rx_power_dbm, c.onu_rx_power_observed_at, pu.caller_id AS caller_id, d.name AS rx_power_source FROM customers c LEFT JOIN pppoe_users pu ON LOWER(pu.username)=LOWER(c.username) LEFT JOIN network_devices d ON d.id=c.onu_rx_power_source_device_id WHERE c.id::text=$1 OR LOWER(c.username)=LOWER($1) LIMIT 2",
      [key]
    );
    if (customerResult.rows.length === 0) return res.status(404).json({ success: false, message: "Customer not found." });
    if (customerResult.rows.length !== 1) return res.status(409).json({ success: false, message: "Customer identity is ambiguous." });

    const customer = customerResult.rows[0];
    const observations = await db.query(
      `SELECT o.id, o.observation_type AS "observationType",
              o.identity_type AS "identityType", o.identity_value AS "identityValue",
              o.observed_value AS "observedValue", o.match_status AS "matchStatus",
              o.match_confidence AS "matchConfidence", o.evidence,
              o.observed_at AS "observedAt", d.name AS "sourceDevice"
       FROM network_observations o
       LEFT JOIN network_devices d ON d.id=o.source_device_id
       WHERE o.customer_id=$1
       ORDER BY o.observed_at DESC, o.id DESC
       LIMIT 30`,
      [customer.id]
    );
    const latest = observations.rows[0] || null;
    // Router MAC must be selected from PPPoE observations independently of
    // newer bridge-host or other observation types.
    const routerObservation = observations.rows.find(
      (item) => item.observationType === "pppoe_session"
    ) || null;
    let oltTelemetry = null;
    try {
      const telemetryResult = await db.query(
        "SELECT t.olt_id AS \"oltId\", t.onu_id AS \"onuId\", t.onu_mac::text AS \"onuMac\", " +
        "t.pppoe_username AS \"pppoeUsername\", t.pon_port AS \"ponPort\", t.status, " +
        "t.rx_power_dbm AS \"rxPowerDbm\", t.tx_power_dbm AS \"txPowerDbm\", " +
        "t.observed_at AS \"observedAt\", t.received_at AS \"receivedAt\", t.source_agent AS \"sourceAgent\" " +
        "FROM customers c LEFT JOIN pppoe_users pu ON LOWER(pu.username)=LOWER(c.username) " +
        "JOIN olt_telemetry t ON (" +
        "t.onu_mac=CASE WHEN c.onu_mac ~* '^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$' THEN REPLACE(c.onu_mac,'-',':')::macaddr ELSE NULL END " +
        "OR t.onu_mac=CASE WHEN pu.caller_id ~* '^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$' THEN REPLACE(pu.caller_id,'-',':')::macaddr ELSE NULL END) " +
        "WHERE LOWER(c.username)=LOWER($1) " +
        "ORDER BY (t.onu_mac=CASE WHEN c.onu_mac ~* '^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$' THEN REPLACE(c.onu_mac,'-',':')::macaddr ELSE NULL END) DESC, t.observed_at DESC LIMIT 1",
        [customer.username, clean(customer.onu_mac, 100), clean(customer.caller_id, 100)]
      );
      oltTelemetry = telemetryResult.rows[0] || null;
      if (oltTelemetry) {
        oltTelemetry.stale = isTelemetryStale(oltTelemetry);
        oltTelemetry.lastSeenAt = telemetryLastSeen(oltTelemetry);
        const rx = oltTelemetry.rxPowerDbm;
        oltTelemetry.signalLevel = rx === null || rx === undefined ? "unknown" : Number(rx) < -27 ? "weak" : Number(rx) <= -25 ? "warning" : "good";
        oltTelemetry.matchedBy = matchTelemetryIdentity({
          onuMac: customer.onu_mac,
          callerId: customer.caller_id
        }, oltTelemetry) || "unknown";
      }
    } catch (telemetryError) {
      // Telemetry is optional; a missing table/reading must not break Customer 360 mapping.
      console.warn("[Network map customer API] OLT telemetry lookup skipped:", telemetryError.message);
    }
    const rxStatus = getRxPowerStatus(
      customer.onu_rx_power_observed_at,
      customer.onu_rx_power_dbm
    );
    return res.json({
      success: true,
      customer: { id: customer.id, username: customer.username },
      provisioned: { onuMac: customer.onu_mac || null, fiberBox: customer.fiber_box || null },
      rxPower: { dbm: customer.onu_rx_power_dbm === null || customer.onu_rx_power_dbm === undefined ? null : Number(customer.onu_rx_power_dbm), observedAt: customer.onu_rx_power_observed_at || null, sourceDevice: customer.rx_power_source || null, status: rxStatus },
      routerMac: routerObservation?.observedValue?.routerMac || null,
      observations: observations.rows,
      discoveryStatus: latest ? "observations_available" : "not_yet_observed",
      lastObservedAt: latest?.observedAt || null,
      notes: [
        "ONU MAC is sourced from customer fiber inventory until an OLT/PON adapter verifies it.",
        "Router MAC is sourced from MikroTik PPPoE caller-id observations.",
        "Unknown and ambiguous identities are not automatically attached to this customer."
      ]
    });
  } catch (error) {
    console.error("[Network map customer API]", error?.message || error);
    return res.status(503).json({ success: false, message: "Customer network map is temporarily unavailable." });
  }
};

exports.getLatestSummary = async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.id, r.status, r.started_at AS "startedAt", r.finished_at AS "finishedAt",
              r.discovered_count AS "discoveredCount", r.matched_count AS "matchedCount",
              r.unmatched_count AS "unmatchedCount", d.name AS "deviceName"
       FROM network_discovery_runs r
       LEFT JOIN network_devices d ON d.id=r.device_id
       ORDER BY r.started_at DESC, r.id DESC LIMIT 20`
    );
    return res.json({ success: true, runs: result.rows });
  } catch (error) {
    console.error("[Network map summary API]", error?.message || error);
    return res.status(503).json({ success: false, message: "Network discovery summary is temporarily unavailable." });
  }
};


exports.getDiagram = async (req, res) => {
  try {
    const [devices, links, latestRun] = await Promise.all([
      db.query(
        `SELECT id,device_type AS "deviceType",name,vendor,model,
                host(management_ip) AS "managementIp",mac_address::text AS "macAddress",
                location,parent_device_id AS "parentDeviceId",last_seen_at AS "lastSeenAt"
         FROM network_devices
         ORDER BY CASE device_type WHEN 'mikrotik' THEN 0 WHEN 'olt' THEN 1 WHEN 'access_point' THEN 2 WHEN 'cpe' THEN 3 ELSE 4 END,name ASC,id ASC
         LIMIT 1000`
      ),
      db.query(
        `SELECT l.id,l.from_device_id AS "fromDeviceId",l.to_device_id AS "toDeviceId",
                l.relationship,l.match_status AS "matchStatus",l.last_seen_at AS "lastSeenAt",
                f.name AS "fromName",t.name AS "toName"
         FROM network_topology_links l
         JOIN network_devices f ON f.id=l.from_device_id
         JOIN network_devices t ON t.id=l.to_device_id
         ORDER BY CASE l.match_status WHEN 'verified' THEN 0 WHEN 'unverified' THEN 1 ELSE 2 END,
                  f.name ASC,t.name ASC,l.id ASC
         LIMIT 1000`
      ),
      db.query(
        `SELECT status,started_at AS "startedAt",finished_at AS "finishedAt",
                discovered_count AS "discoveredCount",matched_count AS "matchedCount",
                unmatched_count AS "unmatchedCount"
         FROM network_discovery_runs ORDER BY started_at DESC,id DESC LIMIT 1`
      )
    ]);
    return res.json({
      success: true,
      devices: devices.rows,
      links: links.rows,
      latestRun: latestRun.rows[0] || null,
      counts: { devices: devices.rowCount, links: links.rowCount }
    });
  } catch (error) {
    console.error("[Network diagram API]", error?.message || error);
    return res.status(503).json({ success: false, message: "Network diagram data is temporarily unavailable." });
  }
};
