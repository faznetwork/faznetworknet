"use strict";

const db = require("../db");
const mikrotikService = require("../services/mikrotikService");
const { deleteHotspotSubscriber } = require("../services/hotspotDeletionService");

const clean = (value, max = 255) => String(value ?? "").trim().slice(0, max);
const lower = value => clean(value, 255).toLowerCase();
function normalizeMac(value) {
  const compact = String(value ?? "").trim().replace(/[:-]/g, "");
  return /^[0-9a-f]{12}$/i.test(compact) ? compact.match(/.{2}/g).join(":").toUpperCase() : "";
}
function normalizePhone(value) {
  const bn = "০১২৩৪৫৬৭৮৯";
  let digits = String(value ?? "").replace(/[০-৯]/g, ch => String(bn.indexOf(ch))).replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length === 13) digits = "0" + digits.slice(3);
  return digits.slice(0, 20);
}
function validityMs(value, unit) {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours|d|day|days|w|week|weeks|mo|month|months)?$/);
  const n = Number(match ? match[1] : raw);
  const u = String(unit || (match && match[2]) || "").trim().toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return 0;
  if (["gb", "data", "quota"].includes(u)) return 0;
  const multiplier = u.startsWith("s") ? 1000 : u.startsWith("m") && !u.startsWith("mo") ? 60000 :
    u.startsWith("h") ? 3600000 : u.startsWith("w") ? 604800000 : u.startsWith("mo") ? 2592000000 : u.startsWith("d") ? 86400000 : 0;
  return n * multiplier;
}
function error(res, status, message) { return res.status(status).json({ success: false, message, error: message }); }
function rowLookup(rows, identifier) {
  const key = lower(identifier);
  const numeric = /^\d+$/.test(key);
  return rows.find(row => (numeric && String(row.id) === key) || lower(row.username) === key || lower(row.mac_address) === key) || null;
}

/** Subscriber renewal is delegated to the RouterOS + PostgreSQL canonical controller. */
async function list(req, res) {
  try {
    const [sessionsResult, ledgerResult] = await Promise.all([
      mikrotikService.getActiveHotspotSessions().catch(error => {
        console.warn("[Hotspot Subscriber 360] Active-session lookup unavailable; showing DB subscribers offline:", error?.message || error);
        return [];
      }),
      db.query("SELECT id,username,customer_name,phone,mac_address,profile,profile_id,comment,note,expires_at,first_login_at,validity,status,server,mac_lock,price,subscriber_type,activation_type,created_at,updated_at FROM hotspot_vouchers WHERE LOWER(COALESCE(status,'')) NOT IN ('archived','deleted') ORDER BY id DESC")
    ]);
    const ledger = ledgerResult.rows || [];
    const sessions = (Array.isArray(sessionsResult) ? sessionsResult : []).map(session => ({
      ...session,
      username: clean(session.user || session.username),
      mac_address: normalizeMac(session.macAddress || session.mac_address || session["mac-address"] || "")
    }));
    const byUsername = new Map();
    const byMac = new Map();
    for (const session of sessions) {
      if (lower(session.username)) byUsername.set(lower(session.username), session);
      if (lower(session.mac_address)) byMac.set(lower(session.mac_address), session);
    }
    const now = Date.now();
    const users = ledger.map(row => {
      const username = clean(row.username);
      const mac = normalizeMac(row.mac_address) || normalizeMac(username);
      const session = byUsername.get(lower(username)) || (mac && byMac.get(lower(mac))) || null;
      const expiry = row.expires_at ? new Date(row.expires_at) : null;
      const expired = String(row.status || "").toLowerCase() === "expired" ||
        String(row.profile || "").toLowerCase() === "expired_profile" ||
        Boolean(expiry && Number.isFinite(expiry.getTime()) && expiry.getTime() <= now);
      const online = !expired && Boolean(session && String(session.address || session.ip || "").trim());
      const dbStatus = String(row.status || "").toLowerCase();
      const status = expired ? "expired" : online ? "online" :
        dbStatus === "pending_claim" ? "pending_claim" :
        dbStatus === "unused" ? "unused" : "offline";
      return {
        id: row.id,
        voucher_id: row.id,
        username,
        customer_name: clean(row.customer_name, 160),
        phone: clean(row.phone, 32),
        mac_address: mac || clean(row.mac_address),
        profile: clean(row.profile, 100),
        profile_id: clean(row.profile_id, 100),
        comment: clean(row.comment, 500),
        note: clean(row.note, 1000),
        expires_at: row.expires_at || null,
        first_login_at: row.first_login_at || null,
        validity: clean(row.validity, 50),
        status,
        db_status: dbStatus,
        live_status: online ? "online" : "offline",
        is_online: online,
        online,
        ip: clean(session?.address || session?.ip || "", 100),
        uptime: clean(session?.uptime || "", 100),
        bytesIn: Number(session?.bytesIn || 0),
        bytesOut: Number(session?.bytesOut || 0),
        note: clean(row.note, 1000),
        mac_lock: row.mac_lock !== false,
        server: clean(row.server || "all", 100),
        price: Number(row.price || 0),
        subscriber_type: row.subscriber_type || "legacy",
        activation_type: row.activation_type || "legacy",
        created_at: row.created_at || null,
        updated_at: row.updated_at || null
      };
    });
    const filter = String(req.query.filter || "all").trim().toLowerCase();
    const allowed = new Set(["all", "online", "active", "offline", "expired"]);
    if (!allowed.has(filter)) return error(res, 400, "Invalid Hotspot subscriber filter.");
    const filtered = users.filter(user => {
      if (filter === "online") return user.is_online && user.status !== "expired";
      if (filter === "expired") return user.status === "expired";
      if (filter === "active") return !user.is_online && user.db_status === "active" &&
        (!user.expires_at || new Date(user.expires_at).getTime() > now);
      if (filter === "offline") return !user.is_online;
      return true;
    });
    return res.set("Cache-Control", "no-store").json({
      success: true, filter, count: filtered.length, users: filtered,
      activeUsers: sessions.map(session => ({
        id: session.id || session.sessionId || "",
        user: session.username,
        username: session.username,
        address: session.address || session.ip || "",
        macAddress: session.mac_address || "",
        uptime: session.uptime || "",
        bytesIn: Number(session.bytesIn || 0),
        bytesOut: Number(session.bytesOut || 0),
        profile: session.profile || ""
      }))
    });
  } catch (e) {
    console.error("[Hotspot Subscriber 360] Read failed:", e?.message || e);
    return error(res, 503, "Unable to load PostgreSQL Hotspot subscribers. Live-session enrichment may be unavailable; no RouterOS state was changed.");
  }
}
async function getProfile(req, res) {
  const identifier = clean(req.params.id, 255);
  if (!identifier) return error(res, 400, "A voucher ID, username, or MAC address is required.");
  try {
    const result = await db.query("SELECT id,username,customer_name,phone,mac_address,note,profile,profile_id,status,expires_at,mac_lock FROM hotspot_vouchers WHERE ($1::bigint IS NOT NULL AND id=$1) OR LOWER(username)=LOWER($2) OR LOWER(mac_address)=LOWER($2) ORDER BY CASE WHEN ($1::bigint IS NOT NULL AND id=$1) THEN 0 ELSE 1 END,id DESC LIMIT 1", [/^\d+$/.test(identifier) && Number.isSafeInteger(Number(identifier)) ? Number(identifier) : null, identifier]);
    if (!result.rows?.length) return error(res, 404, "Subscriber was not found in PostgreSQL.");
    return res.json({ success: true, subscriber: result.rows[0] });
  } catch (e) { return error(res, 503, "Unable to load the PostgreSQL subscriber profile."); }
}

async function updateProfile(req, res) {
  const identifier = clean(req.params.id, 255);
  if (!identifier) return error(res, 400, "A voucher ID, username, or MAC address is required.");
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = clean(body.customer_name ?? body.name, 160);
  const phone = normalizePhone(body.phone ?? body.customer_phone);
  const rawMac = clean(body.mac_address, 32);
  const mac = rawMac ? normalizeMac(rawMac) : "";
  const note = clean(body.note ?? body.notes, 1000);
  const macLock = body.mac_lock === undefined ? undefined : body.mac_lock === true || body.mac_lock === "true";
  if (rawMac && !mac) return error(res, 400, "Enter a valid MAC address.");
  try {
    const found = await db.query(
      "SELECT id,mac_address,username,profile,comment FROM hotspot_vouchers WHERE ($1::bigint IS NOT NULL AND id=$1) OR LOWER(username)=LOWER($2) OR ($3<>'' AND LOWER(mac_address)=LOWER($3)) ORDER BY CASE WHEN ($1::bigint IS NOT NULL AND id=$1) THEN 0 ELSE 1 END,id DESC LIMIT 1",
      [/^\d+$/.test(identifier) && Number.isSafeInteger(Number(identifier)) ? Number(identifier) : null, identifier, identifier]
    );
    const row = found.rows?.[0];
    if (!row) return error(res, 404, "No PostgreSQL voucher matches this subscriber. RouterOS was not changed.");
    // MAC change: refuse when another live voucher already holds that MAC.
    const oldMac = normalizeMac(row.mac_address) || normalizeMac(row.username);
    if (mac && oldMac && mac !== oldMac) {
      const conflict = await db.query(
        "SELECT id FROM hotspot_vouchers WHERE id<>$1::bigint AND LOWER(COALESCE(mac_address,''))=LOWER($2::text) AND LOWER(COALESCE(status,'')) IN ('active','pending_claim','unused') LIMIT 1",
        [row.id, mac]
      );
      if (conflict.rows?.length) return error(res, 409, "Another live subscriber is already bound to this MAC address.");
    }
    // Partial updates only: a field that is absent from the request is
    // left untouched — it must never wipe the stored name/phone/note.
    const sets = [], params = [];
    let idx = 1;
    if (body.customer_name !== undefined || body.name !== undefined) { sets.push(`customer_name=$${idx}`); params.push(name); idx++; }
    if (body.phone !== undefined || body.customer_phone !== undefined) { sets.push(`phone=$${idx}`); params.push(phone); idx++; }
    if (mac) { sets.push(`mac_address=$${idx}`); params.push(mac); idx++; }
    if (body.note !== undefined || body.notes !== undefined) { sets.push(`note=$${idx}`); params.push(note); idx++; }
    if (macLock !== undefined) { sets.push(`mac_lock=$${idx}`); params.push(macLock); idx++; }
    if (!sets.length) return error(res, 400, "Nothing to update.");
    sets.push("updated_at=NOW()");
    const saved = await db.query(
      `UPDATE hotspot_vouchers SET ${sets.join(",")} WHERE id=$${idx} RETURNING id,username,customer_name,phone,mac_address,note,profile,profile_id,status,expires_at,mac_lock`,
      [...params, row.id]
    );
    if (!saved.rows?.length) return error(res, 404, "Subscriber profile was not saved.");
    // Router sync on a MAC change: rename the RouterOS user to the new
    // MAC (password stays the MAC, as today). The panel row is master —
    // a router failure is reported, not rolled back.
    let routerSync = true, routerSyncMessage = null;
    if (mac && oldMac && mac !== oldMac) {
      try {
        await mikrotikService.updateHotspotUser(mac, row.profile, row.comment, mac, mac, oldMac);
      } catch (routerError) {
        routerSync = false;
        routerSyncMessage = String(routerError?.message || routerError).slice(0, 300);
        console.warn("[Hotspot Subscriber 360] Router sync failed for MAC change:", routerError?.message || routerError);
      }
    }
    return res.json({ success: true, message: "Profile updated successfully", subscriber: saved.rows[0], router_sync: routerSync, ...(routerSyncMessage ? { router_sync_message: routerSyncMessage } : {}) });
  } catch (e) {
    console.error("[Hotspot Subscriber 360] Profile update failed:", e?.message || e);
    return error(res, 503, "Profile update failed. PostgreSQL did not confirm the save.");
  }
}

function renew(req, res) {
  return require("./hotspotController").manualRenew(req, res);
}

// Canonical deletion: RouterOS purge + fresh verification precede a financial-safe soft delete.
async function archive(req, res) {
  const identifier = clean(req.params.id, 160);
  try {
    const result = await deleteHotspotSubscriber({ identifier });
    return res.json({
      success: true,
      message: "Network access purged and subscriber soft-deleted. Voucher sales, payment ledger, transactions, and MAC audit history were retained.",
      ...result
    });
  } catch (e) {
    console.error("[Hotspot Subscriber Deletion] Failed:", {
      code: e?.code || null, statusCode: e?.statusCode || null, message: e?.message || String(e)
    });
    return res.status(Number.isInteger(e?.statusCode) ? e.statusCode : 503).json({
      success: false, code: e?.code || "HOTSPOT_DELETION_FAILED",
      message: e?.message || "Hotspot deletion failed. No database status was changed unless the RouterOS purge was verified.",
      retryable: e?.statusCode === 502 || e?.statusCode === 503
    });
  }
}

async function updateFromBody(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const id = clean(body.voucher_id || body.username || body.mac_address || body.id);
  return updateProfile({ params: { id }, body }, res);
}
async function renewFromBody(req, res) {
  return require("./hotspotController").manualRenew(req, res);
}
async function archiveFromBody(req, res) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const id = clean(body.voucher_id || body.username || body.mac_address || body.id);
  return archive({ params: { id } }, res);
}

function blockRouterMutation(req, res) {
  return res.status(409).json({ success: false, message: "This action is disabled in the safety-scoped Subscriber 360 rebuild. RouterOS users and active sessions remain untouched." });
}

module.exports = { list, getProfile, updateProfile, renew, archive, updateFromBody, renewFromBody, archiveFromBody, blockRouterMutation, normalizeMac, normalizePhone, validityMs };
