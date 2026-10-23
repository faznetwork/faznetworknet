'use strict';

const db = require('../db');
const MAC_RE = /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/;

function normalizeMac(value) {
  const raw = String(value ?? '').trim().replace(/-/g, ':').toLowerCase();
  return MAC_RE.test(raw) ? raw : null;
}

function telemetryHasClientMac(row, mac) {
  const target = normalizeMac(mac);
  if (!target || !Array.isArray(row?.raw?.clientMacs)) return false;
  return row.raw.clientMacs.some(value => normalizeMac(value) === target);
}

function selectUniqueTelemetryMatch(rows, mac) {
  const matches = (rows || []).filter(row => telemetryHasClientMac(row, mac));
  if (!matches.length) return { status: 'not_found', telemetry: null, count: 0 };
  if (matches.length !== 1) return { status: 'ambiguous', telemetry: null, count: matches.length };
  const telemetry = matches[0];
  if (!normalizeMac(telemetry.onuMac) || !String(telemetry.onuId || '').trim() || !String(telemetry.ponPort || '').trim()) {
    return { status: 'unverified', telemetry: null, count: 1 };
  }
  return { status: 'matched', telemetry, count: 1 };
}

async function discoverFromSessions(sessions, { runId = null, sourceDeviceId = null } = {}) {
  const candidates = [];
  const seenCandidates = new Set();
  for (const session of sessions || []) {
    const username = String(session?.username || '').trim().slice(0, 100);
    const routerMac = normalizeMac(session?.callerId);
    const key = username.toLowerCase() + '\\0' + String(routerMac || '');
    if (username && routerMac && !seenCandidates.has(key)) {
      seenCandidates.add(key);
      candidates.push({ username, routerMac });
    }
  }
  if (!candidates.length) return { matched: 0, ambiguous: 0, unmatched: 0, mapped: [] };

  const usernames = [...new Set(candidates.map(item => item.username.toLowerCase()))];
  const macs = [...new Set(candidates.map(item => item.routerMac))];
  const customerResult = await db.query(
    'SELECT id, username, onu_mac FROM customers WHERE LOWER(username)=ANY($1::text[])',
    [usernames]
  );
  const customersByUsername = new Map();
  for (const customer of customerResult.rows) {
    const key = String(customer.username || '').toLowerCase();
    const list = customersByUsername.get(key) || [];
    list.push(customer);
    customersByUsername.set(key, list);
  }

  const telemetryResult = await db.query(
    `SELECT olt_id AS "oltId", onu_id AS "onuId", onu_mac::text AS "onuMac",
            pon_port AS "ponPort", status, rx_power_dbm AS "rxPowerDbm",
            tx_power_dbm AS "txPowerDbm", observed_at AS "observedAt",
            received_at AS "receivedAt", source_agent AS "sourceAgent", raw
       FROM olt_telemetry t
      WHERE t.received_at >= NOW() - INTERVAL '15 minutes'
        AND t.observed_at >= NOW() - INTERVAL '15 minutes'
        AND t.observed_at <= NOW() + INTERVAL '5 minutes'
        AND jsonb_typeof(t.raw->'clientMacs') = 'array'
        AND EXISTS (
          SELECT 1
            FROM jsonb_array_elements_text(t.raw->'clientMacs') AS learned(value)
           WHERE LOWER(REPLACE(learned.value, '-', ':')) = ANY($1::text[])
        )`,
    [macs]
  );
  const telemetryRows = telemetryResult.rows;
  const telemetryByMac = new Map();
  for (const mac of macs) telemetryByMac.set(mac, selectUniqueTelemetryMatch(telemetryRows, mac));

  const candidateTelemetry = [...new Map(
    [...telemetryByMac.values()]
      .filter(result => result.status === 'matched')
      .map(result => [String(result.telemetry.onuMac).toLowerCase(), result.telemetry])
  ).values()];
  const onuMacs = candidateTelemetry.map(row => String(row.onuMac).toLowerCase());
  const assignedResult = onuMacs.length
    ? await db.query(
        `SELECT id, username, LOWER(TRIM(onu_mac)) AS "onuMac"
           FROM customers
          WHERE NULLIF(TRIM(onu_mac), '') IS NOT NULL
            AND LOWER(TRIM(onu_mac)) = ANY($1::text[])`,
        [onuMacs]
      )
    : { rows: [] };
  const assignedByOnu = new Map();
  for (const row of assignedResult.rows) {
    const key = String(row.onuMac || '').toLowerCase();
    const list = assignedByOnu.get(key) || [];
    list.push(row);
    assignedByOnu.set(key, list);
  }

  let matched = 0, ambiguous = 0, unmatched = 0;
  const mapped = [];
  for (const candidate of candidates) {
    const customerRows = customersByUsername.get(candidate.username.toLowerCase()) || [];
    if (customerRows.length !== 1) {
      if (customerRows.length > 1) ambiguous++; else unmatched++;
      continue;
    }
    const customer = customerRows[0];
    const result = telemetryByMac.get(candidate.routerMac) || { status: 'not_found' };
    if (result.status === 'ambiguous') { ambiguous++; continue; }
    if (result.status !== 'matched') { unmatched++; continue; }

    const telemetry = result.telemetry;
    const onuMac = normalizeMac(telemetry.onuMac);
    const existingOnuMac = normalizeMac(customer.onu_mac);
    if (!onuMac || !telemetry.onuId || !telemetry.ponPort) { unmatched++; continue; }
    if (existingOnuMac && existingOnuMac !== onuMac) {
      ambiguous++;
      console.warn('[ONU auto-discovery] Refusing to overwrite existing ONU mapping for customer', customer.username);
      continue;
    }
    const assigned = assignedByOnu.get(onuMac) || [];
    if (assigned.some(row => String(row.id) !== String(customer.id))) {
      ambiguous++;
      console.warn('[ONU auto-discovery] ONU MAC is already assigned to another customer; refusing mapping.');
      continue;
    }

    // Auto-discovery may enrich the OLT port, but only the authenticated OLT
    // telemetry ingest can write customers.onu_mac from the payload root field.
    const update = await db.query(
      `UPDATE customers
          SET olt_pon_port=$1, updated_at=NOW()
        WHERE id=$2
        RETURNING id, username`,
      [String(telemetry.ponPort).slice(0, 120), customer.id]
    );
    if (update.rowCount !== 1) { ambiguous++; continue; }

    matched++;
    const evidence = {
      rule: 'unique_fresh_olt_learned_client_mac',
      source: 'vsol_snmp_mac_forwarding_table',
      routerMac: candidate.routerMac,
      onuMac, onuId: telemetry.onuId, ponPort: telemetry.ponPort,
      oltId: telemetry.oltId, observedAt: telemetry.observedAt, receivedAt: telemetry.receivedAt
    };
    mapped.push({ username: customer.username, routerMac: candidate.routerMac, onuMac, onuId: telemetry.onuId, ponPort: telemetry.ponPort });
    if (runId) {
      await db.query(
        `INSERT INTO network_observations
          (discovery_run_id, source_device_id, customer_id, observation_type,
           identity_type, identity_value, observed_value, match_status,
           match_confidence, evidence)
         VALUES ($1,$2,$3,'onu_auto_mapping','router_mac',$4,$5::jsonb,
                 'matched',1,$6::jsonb)`,
        [runId, sourceDeviceId, customer.id, candidate.routerMac,
          JSON.stringify({ username: customer.username, onuMac, onuId: telemetry.onuId, ponPort: telemetry.ponPort }),
          JSON.stringify(evidence)]
      );
    }
    assignedByOnu.set(onuMac, [...assigned, { id: customer.id, username: customer.username, onuMac }]);
  }
  return { matched, ambiguous, unmatched, mapped };
}

module.exports = { normalizeMac, telemetryHasClientMac, selectUniqueTelemetryMatch, discoverFromSessions };
