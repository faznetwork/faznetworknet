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
            status=EXCLUDED.status,rx_power_dbm=EXCLUDED.rx_power_dbm,tx_power_dbm=EXCLUDED.tx_power_dbm,
            observed_at=EXCLUDED.observed_at,source_agent=EXCLUDED.source_agent,raw=EXCLUDED.raw,received_at=NOW()
          WHERE EXCLUDED.observed_at >= olt_telemetry.observed_at
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
    const mac=String(req.query.mac||'').trim().replace(/-/g,':');
    let result;
    if(mac && /^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(mac)) {
      result=await db.query(`SELECT olt_id AS "oltId",onu_id AS "onuId",onu_mac::text AS "onuMac",pppoe_username AS "pppoeUsername",pon_port AS "ponPort",status,rx_power_dbm AS "rxPowerDbm",tx_power_dbm AS "txPowerDbm",observed_at AS "observedAt",received_at AS "receivedAt",source_agent AS "sourceAgent" FROM olt_telemetry WHERE onu_mac=$1::macaddr ORDER BY observed_at DESC LIMIT 1`,[mac]);
    } else if(username) {
      // Match only explicit ONU MAC or the stored PPPoE caller-id; a username alone is not optical identity proof.
      result=await db.query(
        "SELECT t.olt_id AS \"oltId\",t.onu_id AS \"onuId\",t.onu_mac::text AS \"onuMac\",t.pppoe_username AS \"pppoeUsername\",t.pon_port AS \"ponPort\",t.status,t.rx_power_dbm AS \"rxPowerDbm\",t.tx_power_dbm AS \"txPowerDbm\",t.observed_at AS \"observedAt\",t.received_at AS \"receivedAt\",t.source_agent AS \"sourceAgent\" " +
        "FROM customers c LEFT JOIN pppoe_users pu ON LOWER(pu.username)=LOWER(c.username) " +
        "JOIN olt_telemetry t ON (" +
        "t.onu_mac=CASE WHEN c.onu_mac ~* '^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$' THEN REPLACE(c.onu_mac,'-',':')::macaddr ELSE NULL END " +
        "OR t.onu_mac=CASE WHEN pu.caller_id ~* '^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$' THEN REPLACE(pu.caller_id,'-',':')::macaddr ELSE NULL END) " +
        "WHERE LOWER(c.username)=LOWER($1) " +
        "ORDER BY (t.onu_mac=CASE WHEN c.onu_mac ~* '^(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}$' THEN REPLACE(c.onu_mac,'-',':')::macaddr ELSE NULL END) DESC,t.observed_at DESC LIMIT 1",
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
