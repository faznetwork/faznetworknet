"use strict";

const mikrotikService = require("./mikrotikService");

function routerExpiryFields(payload) {
  const expiry = payload?.expiresAt ? new Date(payload.expiresAt) : null;
  if (!expiry || Number.isNaN(expiry.getTime())) return { expiryDate: payload?.expiryDate || "", comment: payload?.comment || "" };
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Dhaka", year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit", hourCycle:"h23" }).formatToParts(expiry).map(part => [part.type, part.value]));
  const timestamp = parts.year + "-" + parts.month + "-" + parts.day + " " + parts.hour + ":" + parts.minute + ":" + parts.second;
  return { expiryDate: timestamp.slice(0, 10), comment: "Exp: " + timestamp };
}

async function applyRouterRenewal(payload, router = mikrotikService) {
  const expiryFields = routerExpiryFields(payload);
  return router.rechargeHotspotUser({
    username: payload.mac,
    password: "",
    profile: payload.profile,
    validity: payload.validity,
    limitBytesTotal: Math.max(0, Math.floor(Number(payload.limitBytesTotal) || 0)),
    expiryDate: expiryFields.expiryDate,
    comment: expiryFields.comment,
    macAddress: payload.mac,
    previousUsername: payload.previousUsername,
    server: payload.server
  });
}

async function cleanupStaleRenewals(database, olderThanSeconds = 1800) {
  const ageSeconds = Math.max(60, Math.floor(Number(olderThanSeconds) || 1800));
  // Past-due staleness only: a pending op whose next attempt is still in
  // the future is NEVER stale (it may be leased by the reconciler right
  // now). The attempts>=5 backstop also only fires once the op is past
  // due, so a mid-lease op is never killed.
  return database.query(
    "UPDATE hotspot_renewal_operations SET status='failed',last_error=COALESCE(NULLIF(last_error,''),'Stale pending renewal timed out.'),updated_at=NOW() WHERE status='pending' AND (next_attempt_at<=NOW()-($1::text||' seconds')::interval OR (attempts>=5 AND next_attempt_at<=NOW())) RETURNING id",
    [String(ageSeconds)]
  );
}

async function failRenewal(database, operationId, error) {
  if (!operationId) return null;
  const message = String(error?.message || error || "Renewal failed.").slice(0, 1000);
  // Backoff grows with each failure (5, 10, 15, 20 min, capped at 30);
  // the 5th failure is terminal — no further retries.
  return database.query(
    "UPDATE hotspot_renewal_operations SET status=CASE WHEN attempts+1>=5 THEN 'failed' ELSE 'pending' END,attempts=attempts+1,last_error=$2,next_attempt_at=CASE WHEN attempts+1>=5 THEN NULL ELSE NOW()+(LEAST(5*(attempts+1),30)||' minutes')::interval END,updated_at=NOW() WHERE id=$1::uuid AND status='pending' RETURNING id",
    [operationId, message]
  );
}

async function finalizeRenewal(client, operationId, payload) {
  const voucherId = String(payload?.voucherId ?? "").trim();
  if (!/^\d+$/.test(voucherId)) throw new Error("Hotspot renewal has an invalid voucher ID.");
  const duplicateRows = await client.query(
    "UPDATE hotspot_vouchers SET status='archived',updated_at=NOW() WHERE id<>$1::bigint AND ((LOWER(COALESCE(username,''))=LOWER($2) AND status IN ('pending_claim','unused','active')) OR (LOWER(COALESCE(mac_address,''))=LOWER($2) AND status='active')) RETURNING id",
    [voucherId, payload.mac]
  );
  const debugPayload = {
    voucherId: payload.voucherId,
    profile: payload.profile,
    validity: payload.validity,
    limitBytesTotal: payload.limitBytesTotal,
    expiresAt: payload.expiresAt,
    renewalStacked: payload.renewalStacked,
    archivedDuplicateRows: duplicateRows.rowCount
  };
  console.log("[DEBUG RENEWAL]", { voucherId, payload: debugPayload, voucherIdType: typeof payload.voucherId });
  const updated = await client.query(
    "UPDATE hotspot_vouchers SET username=$2::text,password=$2::text,profile=$3::text,validity=$4::text,time_limit=NULLIF($5::text,''),data_limit=NULLIF($6::text,''),price=$7::numeric,status='active',phone=$8::text,mac_address=$2::text,customer_name=COALESCE(NULLIF($9::text,''),customer_name),comment=$10::text,expires_at=$11::timestamptz,renewal_stacked=$12::boolean,first_login_at=COALESCE(first_login_at,NOW()),pre_expiry_notified=false,cleanup_status='not_required',cleanup_error=NULL,router_removed_at=NULL,updated_at=NOW() WHERE id=$1::bigint RETURNING id,username,profile,validity,time_limit,data_limit,price,status,phone,customer_name,mac_address,expires_at,comment,transaction_id",
    [voucherId,payload.mac,payload.profile,payload.validity,payload.validity,payload.limitBytesTotal?String(payload.limitBytesTotal):null,payload.price,payload.phone,payload.customerName,payload.comment,payload.expiresAt,payload.renewalStacked]
  );
  console.log("[DEBUG RENEWAL RESULT]", { voucherId, rowCount: updated.rowCount, returnedRows: updated.rows?.length || 0 });
  if (updated.rowCount !== 1 || !updated.rows?.[0]) throw new Error("RouterOS renewal was applied but PostgreSQL could not finalize voucher ID " + voucherId + ".");
  const operation = await client.query(
    "UPDATE hotspot_renewal_operations SET status='completed',attempts=attempts+1,last_error=NULL,completed_at=NOW(),updated_at=NOW() WHERE id=$1::uuid AND status='pending' RETURNING id",
    [operationId]
  );
  if (!operation.rows?.length) throw new Error("Voucher renewal was finalized but its reconciliation record could not be completed.");
  return updated.rows[0];
}

module.exports = { applyRouterRenewal, finalizeRenewal, cleanupStaleRenewals, failRenewal, routerExpiryFields };
