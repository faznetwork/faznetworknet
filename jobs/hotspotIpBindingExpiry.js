"use strict";

const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

let running = false;

async function runHotspotIpBindingExpiry() {
  if (running) return { skipped: true, processed: 0 };
  running = true;
  let processed = 0;
  try {
    const claimed = await db.query(
      "WITH due AS (SELECT id FROM hotspot_ip_bindings WHERE status='active' AND expiry_date <= NOW() AND (expiry_processing_started_at IS NULL OR expiry_processing_started_at < NOW()-INTERVAL '10 minutes') ORDER BY expiry_date,id FOR UPDATE SKIP LOCKED LIMIT 50) UPDATE hotspot_ip_bindings b SET expiry_processing_started_at=NOW(),updated_at=NOW() FROM due WHERE b.id=due.id RETURNING b.*"
    );
    for (const row of claimed.rows) {
      try {
        const router = await mikrotikService.expireHotspotIpBinding({
          id: row.id, macAddress: row.mac_address, ipAddress: row.ip_address,
          comment: row.comment, bandwidthProfile: "unlimited"
        });
        const expired = await db.query(
          "UPDATE hotspot_ip_bindings SET status='expired',binding_type='blocked',router_binding_id=$2,last_synced_at=NOW(),router_sync_error=NULL,expiry_processing_started_at=NULL,updated_at=NOW() WHERE id=$1 AND status='active' RETURNING *",
          [row.id, router.routerBindingId]
        );
        if (expired.rows[0]) {
          await db.query(
            "INSERT INTO admin_audit_logs (actor_username,actor_role,action,details,created_at) VALUES ('system','system','hotspot_ip_binding.expired',$1::jsonb,NOW())",
            [JSON.stringify({ binding_id: row.id, mac_address: row.mac_address, ip_address: row.ip_address, expired_at: new Date().toISOString() })]
          );
        }
        processed++;
      } catch (error) {
        console.error("[Hotspot IP binding expiry] Failed for binding " + row.id + ":", error.message);
        await db.query(
          "UPDATE hotspot_ip_bindings SET expiry_processing_started_at=NULL,router_sync_error=$2,updated_at=NOW() WHERE id=$1",
          [row.id, String(error.message || "Router sync failed").slice(0, 500)]
        ).catch((dbError) => console.error("[Hotspot IP binding expiry] Could not release retry lease:", dbError.message));
      }
    }
    return { skipped: false, processed };
  } catch (error) {
    console.error("[Hotspot IP binding expiry] Sweep failed:", error.message);
    return { skipped: false, processed, error: error.message };
  } finally { running = false; }
}

function startHotspotIpBindingExpiry() {
  if (global.__hotspotIpBindingExpiryTimer) return global.__hotspotIpBindingExpiryTimer;
  runHotspotIpBindingExpiry().catch((error) => console.error("[Hotspot IP binding expiry] Startup sweep failed:", error.message));
  global.__hotspotIpBindingExpiryTimer = setInterval(() => {
    runHotspotIpBindingExpiry().catch((error) => console.error("[Hotspot IP binding expiry] Scheduled sweep failed:", error.message));
  }, 5 * 60 * 1000);
  global.__hotspotIpBindingExpiryTimer.unref?.();
  return global.__hotspotIpBindingExpiryTimer;
}

module.exports = { runHotspotIpBindingExpiry, startHotspotIpBindingExpiry };
