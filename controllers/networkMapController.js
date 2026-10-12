const db = require("../db");
const { getRxPowerStatus } = require("../lib/network/rxPowerStatus");

function clean(value, max = 255) {
  return String(value ?? "").trim().slice(0, max);
}

exports.getCustomerMap = async (req, res) => {
  try {
    const key = clean(req.params.id, 100);
    if (!key) return res.status(400).json({ success: false, message: "Customer ID or username is required." });

    const customerResult = await db.query(
      `SELECT c.id, c.username, c.onu_mac, c.fiber_box,
              p.caller_id AS "storedCallerMac",
              live.caller_id AS "activeCallerMac",
              live.received_at AS "activeSessionReceivedAt"
       FROM customers c
       LEFT JOIN pppoe_users p ON LOWER(p.username)=LOWER(c.username)
       LEFT JOIN LATERAL (
         SELECT s.caller_id, s.received_at
         FROM pppoe_live_sessions s
         WHERE LOWER(s.username)=LOWER(c.username)
           AND s.received_at >= NOW() - INTERVAL '3 minutes'
           AND NULLIF(BTRIM(s.caller_id), '') IS NOT NULL
         ORDER BY s.received_at DESC
         LIMIT 1
       ) live ON TRUE
       WHERE c.id::text=$1 OR LOWER(c.username)=LOWER($1)
       LIMIT 2`,
      [key]
    );
    if (customerResult.rows.length === 0) return res.status(404).json({ success: false, message: "Customer not found." });
    if (customerResult.rows.length !== 1) return res.status(409).json({ success: false, message: "Customer identity is ambiguous." });

    const customer = customerResult.rows[0];
    // Never show an RX reading merely because the collector reported the same
    // PPPoE username: it must match the assigned ONU MAC, or (when none is
    // assigned) the customer's current/known PPPoE caller MAC.
    const assignedMac = clean(customer.onu_mac, 32);
    const callerMac = clean(customer.activeCallerMac || customer.storedCallerMac, 32);
    const normalizedAssignedMac = assignedMac.replace(/[^0-9a-f]/gi, "").toLowerCase();
    const normalizedCallerMac = callerMac.replace(/[^0-9a-f]/gi, "").toLowerCase();
    const mappingMac = /^[0-9a-f]{12}$/.test(normalizedAssignedMac)
      ? normalizedAssignedMac
      : (/^[0-9a-f]{12}$/.test(normalizedCallerMac) ? normalizedCallerMac : "");

    const [observationsResult, telemetryResult] = await Promise.all([
      db.query(
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
      ),
      mappingMac ? db.query(
        `SELECT t.olt_id AS "oltId", t.onu_id AS "onuId",
                t.onu_mac::text AS "onuMac", t.pon_port AS "ponPort",
                t.status, t.rx_power_dbm AS "rxPowerDbm",
                t.tx_power_dbm AS "txPowerDbm",
                t.observed_at AS "observedAt", t.received_at AS "receivedAt",
                t.source_agent AS "sourceAgent"
         FROM olt_telemetry t
         WHERE regexp_replace(lower(t.onu_mac::text), '[^0-9a-f]', '', 'g')=$1
         ORDER BY t.observed_at DESC NULLS LAST, t.received_at DESC
         LIMIT 1`,
        [mappingMac]
      ) : Promise.resolve({ rows: [] })
    ]);

    const observations = observationsResult.rows;
    const latest = observations[0] || null;
    const routerObservation = observations.find(item => item.observationType === "pppoe_session") || null;
    const telemetry = telemetryResult.rows[0] || null;
    const rxStatus = telemetry
      ? getRxPowerStatus(telemetry.observedAt, telemetry.rxPowerDbm)
      : "awaiting_olt_reading";
    const telemetryFresh = telemetry && telemetry.receivedAt
      ? (Date.now() - new Date(telemetry.receivedAt).getTime() <= 15 * 60 * 1000)
      : false;
    const readingIsFresh = Boolean(telemetry && telemetryFresh && rxStatus === "measured");

    return res.json({
      success: true,
      customer: { id: customer.id, username: customer.username },
      provisioned: { onuMac: customer.onu_mac || null, fiberBox: customer.fiber_box || null },
      rxPower: {
        dbm: telemetry?.rxPowerDbm == null ? null : Number(telemetry.rxPowerDbm),
        observedAt: telemetry?.observedAt || null,
        receivedAt: telemetry?.receivedAt || null,
        sourceDevice: telemetry?.oltId || null,
        status: readingIsFresh ? "measured" : (telemetry && (!telemetryFresh || rxStatus === "stale") ? "stale" : rxStatus),
        verified: readingIsFresh,
        mappingMethod: telemetry ? (normalizedAssignedMac && mappingMac === normalizedAssignedMac ? "assigned_onu_mac" : "pppoe_caller_mac") : null
      },
      opticalTelemetry: telemetry ? {
        oltId: telemetry.oltId,
        onuId: telemetry.onuId,
        onuMac: telemetry.onuMac,
        ponPort: telemetry.ponPort,
        status: telemetry.status,
        rxPowerDbm: telemetry.rxPowerDbm == null ? null : Number(telemetry.rxPowerDbm),
        txPowerDbm: telemetry.txPowerDbm == null ? null : Number(telemetry.txPowerDbm),
        observedAt: telemetry.observedAt,
        receivedAt: telemetry.receivedAt,
        sourceAgent: telemetry.sourceAgent,
        stale: !readingIsFresh
      } : null,
      routerMac: routerObservation?.observedValue?.routerMac || customer.activeCallerMac || customer.storedCallerMac || null,
      observations,
      discoveryStatus: latest ? "observations_available" : "not_yet_observed",
      lastObservedAt: latest?.observedAt || null,
      notes: [
        "ONU MAC is sourced from customer fiber inventory until an OLT/PON adapter verifies it.",
        "RX power is shown only when OLT telemetry MAC matches the assigned ONU MAC, or the PPPoE caller MAC when no ONU MAC is assigned.",
        "Unknown, stale, and ambiguous identities are not automatically attached to this customer."
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
