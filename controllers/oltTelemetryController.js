"use strict";
const crypto = require("crypto");
const db = require("../db");
const { parseOpticalPowerDbm } = require("../lib/network/opticalPower");
const { isTelemetryStale, telemetryLastSeen } = require("../lib/network/oltTelemetryFreshness");
let schemaReady;
function ensureSchema() {
  if (!schemaReady) schemaReady = db.query(`
    CREATE TABLE IF NOT EXISTS olt_telemetry (
      id BIGSERIAL PRIMARY KEY,
      olt_id VARCHAR(160) NOT NULL,
      onu_mac MACADDR,
      onu_id VARCHAR(160) NOT NULL,
      pon_port VARCHAR(100),
      status VARCHAR(20) NOT NULL CHECK (status IN ('online','offline','los','unknown')),
      rx_power_dbm NUMERIC(6,2) CHECK (rx_power_dbm IS NULL OR (rx_power_dbm >= -50 AND rx_power_dbm <= 10)),
      tx_power_dbm NUMERIC(6,2) CHECK (tx_power_dbm IS NULL OR (tx_power_dbm >= -50 AND tx_power_dbm <= 20)),
      observed_at TIMESTAMPTZ NOT NULL,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      source_agent VARCHAR(160),
      raw JSONB NOT NULL DEFAULT '{}'::jsonb,
      UNIQUE (olt_id, onu_id)
    );
    CREATE INDEX IF NOT EXISTS idx_olt_telemetry_mac ON olt_telemetry(onu_mac);
    CREATE INDEX IF NOT EXISTS idx_olt_telemetry_seen ON olt_telemetry(received_at DESC);
  `).then(()=>db.query('ALTER TABLE olt_telemetry ADD COLUMN IF NOT EXISTS pppoe_username VARCHAR(160)'))
    .then(()=>db.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS router_mac VARCHAR(32)'))
    .catch(error => { schemaReady = null; throw error; });
  return schemaReady;
}
function secureEqual(a,b) {
  const aa=Buffer.from(String(a||'')), bb=Buffer.from(String(b||''));
  return aa.length===bb.length && aa.length>0 && crypto.timingSafeEqual(aa,bb);
}
function authenticateAgent(req,res,next) {
  const expected=String(process.env.OLT_COLLECTOR_TOKEN||'');
  const auth=String(req.get('authorization')||'');
  const token=auth.match(/^Bearer\s+(.+)$/i)?.[1] || '';
  if (!expected) return res.status(503).json({success:false,message:'OLT collector is not configured on this server.'});
  if (!secureEqual(token,expected)) return res.status(401).json({success:false,message:'Unauthorized collector.'});
  next();
}
function normalizeMac(value) {
  const raw=String(value||'').trim().replace(/-/g,':').toLowerCase();
  if (!raw) return null;
  if (!/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(raw)) throw new Error('Invalid ONU MAC address.');
  return raw;
}
function normalizeClientMac(value) {
  const compact=String(value??"").replace(/[^0-9a-f]/gi,"").toUpperCase();
  return compact.length===12 ? compact : "";
}
function matchPppoeSession(clientMacs,sessions) {
  if(!Array.isArray(clientMacs)||!Array.isArray(sessions)) return null;
  const matched=new Map();
  for(const clientMac of clientMacs) {
    const mac=normalizeClientMac(clientMac);
    if(!mac) continue;
    for(const session of sessions) {
      const username=String(session.username||"").trim();
      const callerId=normalizeClientMac(session.callerId);
      if(username && callerId===mac) matched.set(username.toLowerCase()+"|"+callerId,session);
    }
  }
  return matched.size===1 ? [...matched.values()][0] : null;
}
function getOpticalHealth(telemetry, now = Date.now()) {
  if (!telemetry || telemetry.identityVerified !== true || telemetry.stale === true) {
    return { level: "unknown", label: telemetry?.stale ? "Stale telemetry" : "RX not available" };
  }
  const receivedAt = new Date(telemetry.receivedAt || "").getTime();
  const observedAt = new Date(telemetry.observedAt || "").getTime();
  if (!Number.isFinite(receivedAt) || !Number.isFinite(observedAt) ||
      receivedAt > now || observedAt > now ||
      now - receivedAt > 15 * 60 * 1000 || now - observedAt > 30 * 60 * 1000) {
    return { level: "unknown", label: "Stale telemetry" };
  }
  const rx = Number(telemetry.rxPowerDbm);
  if (telemetry.rxPowerDbm === null || telemetry.rxPowerDbm === undefined ||
      telemetry.rxPowerDbm === "" || !Number.isFinite(rx)) {
    return { level: "unknown", label: "RX not available" };
  }
  if (rx <= -27) return { level: "critical", label: "Critical" };
  if (rx < -23) return { level: "warning", label: "Marginal" };
  if (rx > -12) return { level: "warning", label: "Check Signal" };
  return { level: "healthy", label: "Optimal" };
}
function safeRawJson(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "{}";
  try {
    const json = JSON.stringify(value);
    return json && Buffer.byteLength(json, "utf8") <= 12000 ? json : "{}";
  } catch (_) { return "{}"; }
}
function normalizeReading(row, oltId) {
  const onuId=String(row.onuId||'').trim().slice(0,160);
  if (!onuId) throw new Error('Every reading must include onuId.');
  const status=String(row.status||'unknown').toLowerCase();
  if (!['online','offline','los','unknown'].includes(status)) throw new Error('Invalid ONU status.');
  const power=(value,min,max)=>{
    // V-SOL exposes RX/TX as OCTET STRING on some firmware revisions.
    // Parse only a plain numeric string or an explicit dBm value; never guess
    // whether encoded integer values are tenths/hundredths of a dBm.
    return parseOpticalPowerDbm(value,min,max);
  };
  const observedAt=row.observedAt ? new Date(row.observedAt) : new Date();
  if(Number.isNaN(observedAt.getTime()) || observedAt.getTime()>Date.now()+300000) throw new Error('Invalid observedAt timestamp.');
  const raw=row.raw&&typeof row.raw==="object"&&!Array.isArray(row.raw)?row.raw:{};
  const hasRootOnuMac=typeof row.onuMac==="string"&&row.onuMac.trim()!=="";
  return {
    oltId, onuId, onuMac:hasRootOnuMac?normalizeMac(row.onuMac):null, onuMacAuthoritative:hasRootOnuMac, pppoeUsername:String(row.pppoeUsername||'').trim().slice(0,160)||null,
    ponPort:String(row.ponPort||'').trim().slice(0,100)||null,
    status, rx:power(row.rxPowerDbm,-50,10),
    tx:power(row.txPowerDbm,-50,20),
    observedAt:observedAt.toISOString(),
    sourceAgent:String(row.sourceAgent||'').trim().slice(0,160)||null,
    raw:safeRawJson(raw),
    clientMacs:Array.isArray(raw.clientMacs)?raw.clientMacs:[]
  };
}
exports.syncTelemetry = [authenticateAgent, async (req,res) => {
  try {
    await ensureSchema();
    const body=req.body||{};
    const oltId=String(body.oltId||'').trim().slice(0,160);
    const readings=body.readings;
    if(!oltId) return res.status(400).json({success:false,message:'oltId is required.'});
    if(!Array.isArray(readings)||readings.length<1||readings.length>5000) return res.status(400).json({success:false,message:'readings must contain 1–5000 ONU entries.'});
    const normalized=[];
    for(const row of readings) normalized.push(normalizeReading(row||{},oltId));
    const client=await db.getPool().connect();
    let count=0;
    let identityMatched=0;
    try {
      await client.query('BEGIN');
      const activeSessions=await client.query(
        "SELECT username,caller_id AS \"callerId\" FROM pppoe_live_sessions WHERE LOWER(COALESCE(service,''))='pppoe' AND received_at >= NOW()-INTERVAL '3 minutes' AND caller_id IS NOT NULL"
      );
      for(const r of normalized) {
        const matchedSession=matchPppoeSession(r.clientMacs,activeSessions.rows);
        if(matchedSession) {
          r.pppoeUsername=String(matchedSession.username||"").trim();
          r.identityMatched=true;
          identityMatched++;
        }

        // Only a valid root-level OLT onuMac may write customers.onu_mac.
        // PPPoE caller-id is used solely to resolve the subscriber username.
        if(!r.pppoeUsername && r.onuMacAuthoritative) {
          const previous=await client.query(
            "SELECT pppoe_username FROM olt_telemetry WHERE olt_id=$1 AND onu_id=$2 LIMIT 1",
            [r.oltId,r.onuId]
          );
          r.pppoeUsername=String(previous.rows[0]?.pppoe_username||"").trim()||null;
        }
        const customerUsername=String(r.pppoeUsername||"").trim();
        let rejectedRouterMacNorm = "";
        if(customerUsername && r.onuMacAuthoritative && r.onuMac) {
          const [customerIdentity, sessionIdentity] = await Promise.all([
            client.query(
              "SELECT router_mac FROM customers WHERE LOWER(BTRIM(username))=LOWER(BTRIM($1)) LIMIT 1",
              [customerUsername]
            ),
            Promise.resolve(activeSessions.rows.find(session =>
              String(session.username||"").trim().toLowerCase() === customerUsername.toLowerCase()
            ) || null)
          ]);
          const rootMacNorm=normalizeClientMac(r.onuMac);
          const customerRouterMacNorm=normalizeClientMac(customerIdentity.rows[0]?.router_mac);
          const sessionRouterMacNorm=normalizeClientMac(sessionIdentity?.callerId);
          if(rootMacNorm && (rootMacNorm===customerRouterMacNorm || rootMacNorm===sessionRouterMacNorm)) {
            // A router's PPPoE caller-id is not the ONU's hardware identity.
            // Quarantine this root value so it cannot contaminate the customer or telemetry record.
            rejectedRouterMacNorm=rootMacNorm;
            r.onuMac=null;
            r.onuMacAuthoritative=false;
            console.warn("[OLT telemetry] rejected ONU MAC matching the customer's Router MAC", {
              oltId:r.oltId, onuId:r.onuId, username:customerUsername
            });
          }
        }
        r.onuMacRejectedAsRouter=Boolean(rejectedRouterMacNorm);
        if(customerUsername && r.onuMacAuthoritative && r.onuMac) {
          await client.query(
            "UPDATE customers SET onu_mac=$1,updated_at=NOW() WHERE LOWER(BTRIM(username))=LOWER(BTRIM($2))",
            [r.onuMac,customerUsername]
          );
        }
        const upsertResult=await client.query(`
          INSERT INTO olt_telemetry (olt_id,onu_id,onu_mac,pppoe_username,pon_port,status,rx_power_dbm,tx_power_dbm,observed_at,source_agent,raw,received_at)
          VALUES ($1,$2,$3::macaddr,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW())
          ON CONFLICT (olt_id,onu_id) DO UPDATE SET
            onu_mac=CASE WHEN $12::boolean THEN NULL ELSE COALESCE(EXCLUDED.onu_mac,olt_telemetry.onu_mac) END,
            pppoe_username=COALESCE(EXCLUDED.pppoe_username,olt_telemetry.pppoe_username),
            pon_port=COALESCE(EXCLUDED.pon_port,olt_telemetry.pon_port),
            status=EXCLUDED.status,rx_power_dbm=EXCLUDED.rx_power_dbm,tx_power_dbm=EXCLUDED.tx_power_dbm,
            observed_at=EXCLUDED.observed_at,source_agent=EXCLUDED.source_agent,raw=EXCLUDED.raw,received_at=NOW()
          WHERE EXCLUDED.observed_at >= olt_telemetry.observed_at
          RETURNING id
        `,[r.oltId,r.onuId,r.onuMac,r.pppoeUsername,r.ponPort,r.status,r.rx,r.tx,r.observedAt,r.sourceAgent,r.raw,r.onuMacRejectedAsRouter]);
        if(upsertResult.rows.length) {
          count++;
          if(r.onuMacRejectedAsRouter && rejectedRouterMacNorm) {
            // Remove only the known-contaminated saved value; preserve any unrelated identity.
            await client.query(
              "UPDATE customers SET onu_mac=NULL,updated_at=NOW() WHERE LOWER(BTRIM(username))=LOWER(BTRIM($1)) AND REGEXP_REPLACE(LOWER(COALESCE(onu_mac,'')),'[^0-9a-f]','','g')=$2",
              [customerUsername,rejectedRouterMacNorm.toLowerCase()]
            );
          }
        }
      }
      await client.query('COMMIT');
    } catch(error) { try{await client.query('ROLLBACK')}catch(_){} throw error; }
    finally {client.release();}
    return res.json({success:true,oltId,received:readings.length,processed:count,skippedStale:normalized.length-count,identityMatched,receivedAt:new Date().toISOString()});
  } catch(error) {
    console.error('[OLT telemetry ingest]',error.message);
    return res.status(400).json({success:false,message:error.message||'Unable to store OLT telemetry.'});
  }
}];
exports.normalizeMac = normalizeMac;
exports.getOpticalHealth = getOpticalHealth;
exports.listTelemetry = async (req,res) => {
  try {
    await ensureSchema();
    const username=String(req.query.username||'').trim().slice(0,160);
    const mac=String(req.query.mac||'').trim().replace(/-/g,':');
    let result;
    if(mac && /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) {
      result=await db.query(`SELECT olt_id AS "oltId",onu_id AS "onuId",onu_mac::text AS "onuMac",pppoe_username AS "pppoeUsername",pon_port AS "ponPort",status,rx_power_dbm AS "rxPowerDbm",tx_power_dbm AS "txPowerDbm",observed_at AS "observedAt",received_at AS "receivedAt",source_agent AS "sourceAgent" FROM olt_telemetry WHERE onu_mac=$1::macaddr ORDER BY observed_at DESC LIMIT 1`,[mac]);
    } else if(username) {
      // Only a saved ONU MAC or exact collector-ingested PPPoE username may associate telemetry.
      result=await db.query(
        "SELECT t.olt_id AS \"oltId\",t.onu_id AS \"onuId\",t.onu_mac::text AS \"onuMac\",t.pppoe_username AS \"pppoeUsername\",t.pon_port AS \"ponPort\",t.status,t.rx_power_dbm AS \"rxPowerDbm\",t.tx_power_dbm AS \"txPowerDbm\",t.observed_at AS \"observedAt\",t.received_at AS \"receivedAt\",t.source_agent AS \"sourceAgent\" " +
        "FROM customers c " +
        "JOIN olt_telemetry t ON (" +
        "t.onu_mac=CASE WHEN c.onu_mac ~* '^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$' THEN REPLACE(c.onu_mac,'-',':')::macaddr ELSE NULL END " +
        "OR LOWER(COALESCE(t.pppoe_username,''))=LOWER(c.username)) " +
        "WHERE LOWER(c.username)=LOWER($1) " +
        "ORDER BY (LOWER(COALESCE(t.pppoe_username,''))=LOWER(c.username)) DESC,t.observed_at DESC LIMIT 1",
        [username]
      );
    } else {
      result=await db.query(`SELECT olt_id AS "oltId",onu_id AS "onuId",onu_mac::text AS "onuMac",pppoe_username AS "pppoeUsername",pon_port AS "ponPort",status,rx_power_dbm AS "rxPowerDbm",tx_power_dbm AS "txPowerDbm",observed_at AS "observedAt",received_at AS "receivedAt",source_agent AS "sourceAgent" FROM olt_telemetry ORDER BY received_at DESC LIMIT 500`);
    }
    const markFreshness=item=>{
      item.stale=isTelemetryStale(item);
      item.lastSeenAt=telemetryLastSeen(item);
      item.signalLevel=item.rxPowerDbm===null?'unknown':Number(item.rxPowerDbm)<-27?'weak':Number(item.rxPowerDbm)<=-25?'warning':'good';
    };
    result.rows.forEach(markFreshness);
    const row=result.rows[0]||null;
    return res.json({success:true,telemetry:row,readings:username||mac?undefined:result.rows});
  } catch(error) {
    if(error.code==='42703'||error.code==='42P01') return res.json({success:true,telemetry:null,readings:[]});
    console.error('[OLT telemetry read]',error.message);
    return res.status(503).json({success:false,message:'OLT telemetry temporarily unavailable.'});
  }
};
