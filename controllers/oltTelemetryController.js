"use strict";
const crypto = require("crypto");
const db = require("../db");
const { parseOpticalPowerDbm } = require("../lib/network/opticalPower");
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
  `).then(()=>db.query('ALTER TABLE olt_telemetry ADD COLUMN IF NOT EXISTS pppoe_username VARCHAR(160)')).catch(error => { schemaReady = null; throw error; });
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
  return {
    oltId, onuId, onuMac:normalizeMac(row.onuMac), pppoeUsername:String(row.pppoeUsername||'').trim().slice(0,160)||null,
    ponPort:String(row.ponPort||'').trim().slice(0,100)||null,
    status, rx:power(row.rxPowerDbm,-50,10),
    tx:power(row.txPowerDbm,-50,20),
    observedAt:observedAt.toISOString(),
    sourceAgent:String(row.sourceAgent||'').trim().slice(0,160)||null,
    raw:row.raw && typeof row.raw==='object'&&!Array.isArray(row.raw) && Buffer.byteLength(JSON.stringify(row.raw))<=12000?JSON.stringify(row.raw):'{}'
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
    try {
      await client.query('BEGIN');
      for(const r of normalized) {
        await client.query(`
          INSERT INTO olt_telemetry (olt_id,onu_id,onu_mac,pppoe_username,pon_port,status,rx_power_dbm,tx_power_dbm,observed_at,source_agent,raw,received_at)
          VALUES ($1,$2,$3::macaddr,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,NOW())
          ON CONFLICT (olt_id,onu_id) DO UPDATE SET
            onu_mac=COALESCE(EXCLUDED.onu_mac,olt_telemetry.onu_mac),
            pppoe_username=COALESCE(EXCLUDED.pppoe_username,olt_telemetry.pppoe_username),
            pon_port=COALESCE(EXCLUDED.pon_port,olt_telemetry.pon_port),
            -- Refresh liveness on every authenticated arrival even if the device clock/observedAt lags.
            -- Keep optical measurements monotonic so an out-of-order sample cannot overwrite newer power data.
            status=EXCLUDED.status,
            rx_power_dbm=CASE WHEN EXCLUDED.observed_at >= olt_telemetry.observed_at THEN EXCLUDED.rx_power_dbm ELSE olt_telemetry.rx_power_dbm END,
            tx_power_dbm=CASE WHEN EXCLUDED.observed_at >= olt_telemetry.observed_at THEN EXCLUDED.tx_power_dbm ELSE olt_telemetry.tx_power_dbm END,
            observed_at=GREATEST(EXCLUDED.observed_at,olt_telemetry.observed_at),
            source_agent=COALESCE(EXCLUDED.source_agent,olt_telemetry.source_agent),
            raw=EXCLUDED.raw,
            received_at=NOW()
        `,[r.oltId,r.onuId,r.onuMac,r.pppoeUsername,r.ponPort,r.status,r.rx,r.tx,r.observedAt,r.sourceAgent,r.raw]);
        count++;
      }
      await client.query('COMMIT');
    } catch(error) { try{await client.query('ROLLBACK')}catch(_){} throw error; }
    finally {client.release();}
    return res.json({success:true,oltId,received:readings.length,processed:count,receivedAt:new Date().toISOString()});
  } catch(error) {
    console.error('[OLT telemetry ingest]',error.message);
    return res.status(400).json({success:false,message:error.message||'Unable to store OLT telemetry.'});
  }
}];
exports.listTelemetry = async (req,res) => {
  try {
    await ensureSchema();
    const username=String(req.query.username||'').trim().slice(0,160);
    const rawMac=String(req.query.mac||'').trim();
    const normalizedMac=rawMac.replace(/[^0-9a-f]/gi,'').toLowerCase();
    if(rawMac && !/^[0-9a-f]{12}$/i.test(normalizedMac)) {
      return res.status(400).json({success:false,message:'Invalid MAC address.'});
    }

    // Reverse mapping is MAC-first: an explicitly assigned ONU MAC takes
    // precedence; otherwise use the fresh PPPoE caller-id snapshot.
    const mappingJoin = `
      LEFT JOIN LATERAL (
        SELECT c.username,
               CASE
                 WHEN regexp_replace(lower(COALESCE(c.onu_mac,'')), '[^0-9a-f]', '', 'g') =
                      regexp_replace(lower(COALESCE(t.onu_mac::text,'')), '[^0-9a-f]', '', 'g')
                   THEN 0 ELSE 1
               END AS priority
        FROM customers c
        LEFT JOIN pppoe_users p ON LOWER(p.username)=LOWER(c.username)
        LEFT JOIN LATERAL (
          SELECT s.caller_id
          FROM pppoe_live_sessions s
          WHERE LOWER(s.username)=LOWER(c.username)
            AND s.received_at >= NOW() - INTERVAL '3 minutes'
            AND NULLIF(BTRIM(s.caller_id), '') IS NOT NULL
          ORDER BY s.received_at DESC
          LIMIT 1
        ) live ON TRUE
        WHERE
          (NULLIF(BTRIM(c.onu_mac), '') IS NOT NULL
           AND regexp_replace(lower(c.onu_mac), '[^0-9a-f]', '', 'g') =
               regexp_replace(lower(COALESCE(t.onu_mac::text,'')), '[^0-9a-f]', '', 'g'))
          OR
          (NULLIF(BTRIM(c.onu_mac), '') IS NULL
           AND NULLIF(BTRIM(COALESCE(live.caller_id,p.caller_id)), '') IS NOT NULL
           AND regexp_replace(lower(COALESCE(live.caller_id,p.caller_id)), '[^0-9a-f]', '', 'g') =
               regexp_replace(lower(COALESCE(t.onu_mac::text,'')), '[^0-9a-f]', '', 'g'))
        ORDER BY priority, c.updated_at DESC NULLS LAST
        LIMIT 1
      ) mapped ON TRUE
    `;
    const select = `
      SELECT t.olt_id AS "oltId", t.onu_id AS "onuId",
             t.onu_mac::text AS "onuMac", t.pon_port AS "ponPort",
             t.status, t.rx_power_dbm AS "rxPowerDbm",
             t.tx_power_dbm AS "txPowerDbm",
             t.observed_at AS "observedAt", t.received_at AS "receivedAt",
             t.source_agent AS "sourceAgent",
             COALESCE(NULLIF(t.pppoe_username,''), mapped.username) AS "pppoeUsername"
      FROM olt_telemetry t
      ${mappingJoin}
    `;
    let result;
    if(username) {
      result=await db.query(`
        ${select}
        WHERE
          (NULLIF((SELECT c.onu_mac FROM customers c WHERE LOWER(c.username)=LOWER($1) LIMIT 1), '') IS NOT NULL
           AND regexp_replace(lower(t.onu_mac::text), '[^0-9a-f]', '', 'g') =
               regexp_replace(lower((SELECT c.onu_mac FROM customers c WHERE LOWER(c.username)=LOWER($1) LIMIT 1)), '[^0-9a-f]', '', 'g'))
          OR
          (NULLIF((SELECT c.onu_mac FROM customers c WHERE LOWER(c.username)=LOWER($1) LIMIT 1), '') IS NULL
           AND regexp_replace(lower(t.onu_mac::text), '[^0-9a-f]', '', 'g') =
             regexp_replace(lower(COALESCE(
               (SELECT s.caller_id FROM pppoe_live_sessions s
                WHERE LOWER(s.username)=LOWER($1)
                  AND s.received_at >= NOW() - INTERVAL '3 minutes'
                ORDER BY s.received_at DESC LIMIT 1),
               (SELECT p.caller_id FROM pppoe_users p WHERE LOWER(p.username)=LOWER($1) LIMIT 1),
               ''
             )), '[^0-9a-f]', '', 'g'))
        ORDER BY t.observed_at DESC NULLS LAST
        LIMIT 1
      `,[username]);
    } else if(normalizedMac) {
      result=await db.query(`
        ${select}
        WHERE regexp_replace(lower(t.onu_mac::text), '[^0-9a-f]', '', 'g')=$1
        ORDER BY t.observed_at DESC NULLS LAST LIMIT 1
      `,[normalizedMac]);
    } else {
      result=await db.query(`
        ${select}
        ORDER BY t.received_at DESC LIMIT 500
      `);
    }
    const readings=result.rows.map(row=>{
      const now=Date.now();
      const receivedAt=row.receivedAt?new Date(row.receivedAt).getTime():NaN;
      const observedAt=row.observedAt?new Date(row.observedAt).getTime():NaN;
      const rx=row.rxPowerDbm==null?null:Number(row.rxPowerDbm);
      // A recent collector arrival does not make an old optical measurement live.
      row.stale=!Number.isFinite(receivedAt)||receivedAt>now||now-receivedAt>15*60*1000||
        !Number.isFinite(observedAt)||observedAt>now+5*60*1000||now-observedAt>30*60*1000;
      row.signalLevel=rx===null||!Number.isFinite(rx)?'unknown':
        rx<=-27?'critical':rx < -23?'warning':rx > -12?'high':'good';
      return row;
    });
    const row=readings[0]||null;
    return res.json({success:true,telemetry:username||normalizedMac?row:null,readings:username||normalizedMac?undefined:readings});
  } catch(error) {
    if(error.code==='42703'||error.code==='42P01') return res.json({success:true,telemetry:null,readings:[]});
    console.error('[OLT telemetry read]',error.message);
    return res.status(503).json({success:false,message:'OLT telemetry temporarily unavailable.'});
  }
};
