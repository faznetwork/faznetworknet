"use strict";

const db = require("../db");
const mikrotikService = require("./mikrotikService");

function deletionError(code, statusCode, message) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function normalizeMac(value) {
  const compact = String(value ?? "").trim().replace(/[:-]/g, "");
  return /^[0-9a-f]{12}$/i.test(compact) ? compact.match(/.{2}/g).join(":").toUpperCase() : "";
}

/**
 * Canonical Hotspot deletion lifecycle.
 * Network access is removed first. Financial records are never deleted.
 * The voucher row and historical MAC remain if RouterOS purge/verification fails.
 */
async function deleteHotspotSubscriber({
  identifier,
  database = db,
  router = mikrotikService,
  logger = console
} = {}) {
  const requested = String(identifier ?? "").trim().slice(0, 160);
  if (!requested) throw deletionError("HOTSPOT_IDENTIFIER_REQUIRED", 400, "A voucher ID, username, or MAC address is required.");

  const numericId = /^\d+$/.test(requested) && Number.isSafeInteger(Number(requested)) ? Number(requested) : null;
  const found = await database.query(
    "SELECT id,username,mac_address,last_known_mac,status FROM hotspot_vouchers " +
    "WHERE ($1::bigint IS NOT NULL AND id=$1) OR LOWER(username)=LOWER($2) " +
    "OR LOWER(COALESCE(mac_address,''))=LOWER($2) OR LOWER(COALESCE(last_known_mac,''))=LOWER($2) " +
    "ORDER BY CASE WHEN ($1::bigint IS NOT NULL AND id=$1) THEN 0 ELSE 1 END,id DESC LIMIT 1",
    [numericId, requested]
  );
  const voucher = found.rows?.[0];
  if (!voucher) throw deletionError("HOTSPOT_VOUCHER_NOT_FOUND", 404, "No PostgreSQL voucher matches this subscriber. No RouterOS or database state was changed.");

  const username = String(voucher.username || "").trim();
  const macAddress = normalizeMac(voucher.mac_address) || normalizeMac(voucher.last_known_mac) || normalizeMac(requested);
  if (!username) throw deletionError("HOTSPOT_USERNAME_MISSING", 409, "The saved voucher has no username; deletion was stopped safely.");
  if (!macAddress) {
    throw deletionError("HOTSPOT_MAC_IDENTITY_MISSING", 409, "A verified MAC address is unavailable. Bind/resolve the device before deletion; no database state was changed.");
  }

  let purge;
  try {
    purge = await router.cleanupExpiredHotspotUser(username, macAddress);
    if (!purge?.verified) {
      throw deletionError("HOTSPOT_PURGE_NOT_VERIFIED", 502, "RouterOS purge was not fully verified. The subscriber record and MAC binding were retained; retry cleanup.");
    }
  } catch (cause) {
    logger.error("[Hotspot deletion] RouterOS purge/verification failed; PostgreSQL subscriber and financial history retained.", {
      voucherId: voucher.id, username, macAddress, code: cause?.code || null, message: cause?.message || String(cause)
    });
    if (cause?.statusCode) throw cause;
    throw deletionError("HOTSPOT_ROUTER_PURGE_FAILED", 502, "MikroTik is unavailable or a purge layer failed. No database status or MAC binding was changed. Retry after the router is reachable.");
  }

  const saved = await database.query(
    "UPDATE hotspot_vouchers SET status='deleted', " +
    "mac_audit_history=(SELECT COALESCE(jsonb_agg(DISTINCT known_mac), '[]'::jsonb) FROM jsonb_array_elements_text(COALESCE(mac_audit_history,'[]'::jsonb) || jsonb_build_array(NULLIF(last_known_mac,''),NULLIF(mac_address,''),$2)) AS macs(known_mac) WHERE known_mac<>''), " +
    "last_known_mac=COALESCE(NULLIF(mac_address,''),NULLIF(last_known_mac,''),$2), " +
    "mac_address=NULL, cleanup_status='completed', cleanup_error=NULL, " +
    "cleanup_attempts=COALESCE(cleanup_attempts,0)+1, router_removed_at=NOW(), updated_at=NOW() " +
    "WHERE id=$1 RETURNING id,username,status,last_known_mac,mac_audit_history,mac_address,transaction_id,price,created_at",
    [voucher.id, macAddress]
  );
  if (!saved.rows?.length) {
    logger.error("[Hotspot deletion] RouterOS purge verified but PostgreSQL soft-delete was not confirmed.", {
      voucherId: voucher.id, username, macAddress
    });
    throw deletionError("HOTSPOT_SOFT_DELETE_UNCONFIRMED", 503, "RouterOS access was purged, but PostgreSQL did not confirm the soft-delete. Financial history was not deleted; retry database finalization.");
  }

  logger.info("[Hotspot deletion] Subscriber access purged and voucher soft-deleted; financial records retained.", {
    voucherId: voucher.id, username, lastKnownMac: macAddress,
    sessionsRemoved: purge.sessionsRemoved, cookiesRemoved: purge.cookiesRemoved,
    hostsRemoved: purge.hostsRemoved, usersRemoved: purge.usersRemoved
  });
  return { success: true, deleted: true, softDeleted: true, username, voucher: saved.rows[0], purge };
}

module.exports = { deleteHotspotSubscriber, normalizeMac };
