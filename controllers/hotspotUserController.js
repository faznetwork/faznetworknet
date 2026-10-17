"use strict";

const db = require("../db");
const mikrotikService = require("../services/mikrotikService");
const notificationDispatcher = require("../services/notificationDispatcher");

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
  const u = String(unit || (match && match[2]) || "days").toLowerCase();
  if (!Number.isFinite(n) || n <= 0) return 0;
  const multiplier = u.startsWith("s") ? 1000 : u.startsWith("m") && !u.startsWith("mo") ? 60000 :
    u.startsWith("h") ? 3600000 : u.startsWith("w") ? 604800000 : u.startsWith("mo") ? 2592000000 : 86400000;
  return n * multiplier;
}
function stampDhaka(date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })
    .formatToParts(date).reduce((out, part) => (out[part.type] = part.value, out), {});
  return parts.year + "-" + parts.month + "-" + parts.day + " " + parts.hour + ":" + parts.minute + ":" + parts.second;
}
function readJson(value) {
  if (value && typeof value === "object") return value;
  try { const parsed = JSON.parse(value || "{}"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {}; }
  catch (_) { return {}; }
}
function error(res, status, message) { return res.status(status).json({ success: false, message, error: message }); }
function rowLookup(rows, identifier) {
  const key = lower(identifier);
  const numeric = /^\d+$/.test(key);
  return rows.find(row => (numeric && String(row.id) === key) || lower(row.username) === key || lower(row.mac_address) === key) || null;
}

/**
 * All user-management writes in this controller are PostgreSQL-only.
 * RouterOS calls are deliberately read-only: this rebuild must not mutate
 * /ip/hotspot/user, active sessions, cookies, hosts, or configuration.
 */
async function list(req, res) {
  try {
    const [routerUsers, sessions, ledgerResult] = await Promise.all([
      mikrotikService.getHotspotUsers(),
      mikrotikService.getActiveHotspotSessions(),
      db.query("SELECT id,username,customer_name,phone,mac_address,profile,profile_id,comment,note,expires_at,status,server,mac_lock,price,validity FROM hotspot_vouchers ORDER BY id DESC")
    ]);
    const ledger = ledgerResult.rows || [];
    const byUsername = new Map(), byMac = new Map();
    for (const row of ledger) {
      const u = lower(row.username), m = lower(row.mac_address);
      if (u && !byUsername.has(u)) byUsername.set(u, row);
      if (m && !byMac.has(m)) byMac.set(m, row);
    }
    const online = new Map();
    for (const session of (Array.isArray(sessions) ? sessions : [])) {
      const user = lower(session.user || session.username);
      if (user) online.set(user, session);
    }
    const users = (Array.isArray(routerUsers) ? routerUsers : [])
      .filter(user => clean(user.username) && lower(user.username) !== "default-trial")
      .map(user => {
        const username = clean(user.username);
        const mac = normalizeMac(user.macAddress || user.mac_address || user.mac || "");
        const voucher = byUsername.get(lower(username)) || (mac && byMac.get(lower(mac))) || byMac.get(lower(username)) || null;
        const session = online.get(lower(username)) || null;
        const expiry = voucher?.expires_at || null;
        const expired = expiry && Number.isFinite(new Date(expiry).getTime()) && new Date(expiry).getTime() <= Date.now();
        const status = String(voucher?.status || "").toLowerCase() === "archived" ? "archived" : expired ? "expired" : session ? "online" : String(voucher?.status || "offline").toLowerCase();
        return {
          id: voucher?.id ?? username,
          voucher_id: voucher?.id ?? null,
          router_id: user.id ?? null,
          username,
          customer_name: clean(voucher?.customer_name, 160),
          phone: clean(voucher?.phone, 32),
          mac_address: clean(voucher?.mac_address) || mac || normalizeMac(username),
          profile: clean(user.profile || voucher?.profile, 100),
          comment: clean(user.comment || voucher?.comment, 500),
          expires_at: expiry,
          status,
          is_online: Boolean(session),
          ip: clean(session?.address || session?.ip || user.address, 100),
          uptime: clean(session?.uptime || user.uptime, 100),
          note: clean(voucher?.note, 1000),
          mac_lock: voucher?.mac_lock !== false,
          server: clean(user.server || voucher?.server || "all", 100),
          price: Number(voucher?.price || 0),
          profile_id: clean(voucher?.profile_id, 100)
        };
      });
    return res.set("Cache-Control", "no-store").json({ success: true, count: users.length, users });
  } catch (e) {
    console.error("[Hotspot Subscriber 360] Read failed:", e?.message || e);
    return error(res, 503, "Unable to load Hotspot users. No RouterOS state was changed.");
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
  const name = clean(body.customer_name, 160);
  const phone = normalizePhone(body.phone);
  const rawMac = clean(body.mac_address, 32);
  const mac = rawMac ? normalizeMac(rawMac) : "";
  const note = clean(body.note, 1000);
  const macLock = body.mac_lock === undefined ? undefined : body.mac_lock === true || body.mac_lock === "true";
  if (rawMac && !mac) return error(res, 400, "Enter a valid MAC address.");
  try {
    const found = await db.query(
      "SELECT id FROM hotspot_vouchers WHERE ($1::bigint IS NOT NULL AND id=$1) OR LOWER(username)=LOWER($2) OR ($3<>'' AND LOWER(mac_address)=LOWER($3)) ORDER BY CASE WHEN ($1::bigint IS NOT NULL AND id=$1) THEN 0 ELSE 1 END,id DESC LIMIT 1",
      [/^\d+$/.test(identifier) && Number.isSafeInteger(Number(identifier)) ? Number(identifier) : null, identifier, identifier]
    );
    const row = found.rows?.[0];
    if (!row) return error(res, 404, "No PostgreSQL voucher matches this subscriber. RouterOS was not changed.");
    const saved = await db.query(
      "UPDATE hotspot_vouchers SET customer_name=$1,phone=$2,mac_address=COALESCE(NULLIF($3,''),mac_address),note=$4,mac_lock=COALESCE($5,mac_lock),updated_at=NOW() WHERE id=$6 RETURNING id,username,customer_name,phone,mac_address,note,profile,profile_id,status,expires_at,mac_lock",
      [name, phone, mac, note, macLock, row.id]
    );
    if (!saved.rows?.length) return error(res, 404, "Subscriber profile was not saved.");
    return res.json({ success: true, message: "Profile updated successfully", subscriber: saved.rows[0] });
  } catch (e) {
    console.error("[Hotspot Subscriber 360] Profile update failed:", e?.message || e);
    return error(res, 503, "Profile update failed. PostgreSQL did not confirm the save.");
  }
}

async function renew(req, res) {
  const identifier = clean(req.params.id, 255);
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const requestedProfile = clean(body.profile_id, 100);
  if (!identifier || !requestedProfile) return error(res, 400, "Subscriber and package profile are required.");
  try {
    const found = await db.query(
      "SELECT * FROM hotspot_vouchers WHERE ($1::bigint IS NOT NULL AND id=$1) OR LOWER(username)=LOWER($2) OR LOWER(mac_address)=LOWER($2) ORDER BY CASE WHEN ($1::bigint IS NOT NULL AND id=$1) THEN 0 ELSE 1 END,id DESC LIMIT 1",
      [/^\d+$/.test(identifier) && Number.isSafeInteger(Number(identifier)) ? Number(identifier) : null, identifier]
    );
    const voucher = found.rows?.[0];
    if (!voucher) return error(res, 404, "Subscriber was not found in PostgreSQL.");
    const settings = await db.query("SELECT value FROM app_settings WHERE key='hotspot_profile_metadata' LIMIT 1");
    const metadata = readJson(settings.rows?.[0]?.value);
    const match = Object.entries(metadata).find(([name, meta]) => {
      const aliases = [name, meta?.id, meta?.profileId, meta?.profile_id, meta?.packageId, meta?.package_id, meta?.packageName, meta?.package_name, meta?.alias];
      return aliases.some(alias => alias !== undefined && lower(alias) === lower(requestedProfile));
    });
    const profileName = match?.[0] || clean(voucher.profile, 100);
    const profileMeta = match?.[1] || {};
    if (!match && lower(profileName) !== lower(requestedProfile)) return error(res, 400, "Selected package could not be mapped to a saved Hotspot package.");
    const duration = validityMs(profileMeta.validityValue ?? voucher.validity, profileMeta.validityUnit);
    const quota = Number(profileMeta.limitBytesTotal || voucher.data_limit || 0);
    if (!duration && !quota) return error(res, 400, "Selected package has no configured time validity or data quota.");
    const now = new Date();
    const previous = voucher.expires_at ? new Date(voucher.expires_at) : null;
    const base = previous && Number.isFinite(previous.getTime()) && previous > now ? previous : now;
    const expiry = duration ? new Date(base.getTime() + duration) : null;
    const comment = expiry ? "Exp: " + stampDhaka(expiry) : "FAZ|DATA_ONLY";
    const saved = await db.query(
      "UPDATE hotspot_vouchers SET profile=$1,profile_id=$2,validity=$3,price=$4,expires_at=$5,status='active',comment=$6,renewal_stacked=$7,updated_at=NOW() WHERE id=$8 RETURNING id,username,customer_name,phone,mac_address,profile,profile_id,status,expires_at,comment",
      [profileName, clean(profileMeta.id || profileMeta.profileId || profileMeta.profile_id || profileName, 100), profileMeta.validityValue ? String(profileMeta.validityValue) + " " + String(profileMeta.validityUnit || "days") : String(voucher.validity || ""), Number(profileMeta.price ?? voucher.price ?? 0), expiry, comment, Boolean(previous && previous > now), voucher.id]
    );
    if (!saved.rows?.length) return error(res, 503, "PostgreSQL did not confirm the renewal.");
    if (body.send_notification === true && voucher.phone) {
      try {
        notificationDispatcher.dispatchNotification({
          userType: "hotspot", event: "hotspot_renewal", to: voucher.phone, phone: voucher.phone,
          username: voucher.username,
          customer: { username: voucher.username, name: voucher.customer_name || voucher.username, phone: voucher.phone, profile: profileName },
          variables: { package: profileMeta.packageName || profileMeta.package_name || profileName, profile: profileName, expiry_date: expiry ? stampDhaka(expiry) : "Data quota" },
          channels: ["sms", "whatsapp"]
        });
      } catch (notifyError) { console.warn("[Hotspot Subscriber 360] Notification dispatch failed:", notifyError?.message || notifyError); }
    }
    return res.json({ success: true, new_expiry: expiry ? expiry.toISOString() : null, subscriber: saved.rows[0], message: "Renewal saved to PostgreSQL only; RouterOS was not changed." });
  } catch (e) {
    console.error("[Hotspot Subscriber 360] Renewal failed:", e?.message || e);
    return error(res, 503, "Renewal failed. PostgreSQL did not confirm the update.");
  }
}

// Safety-preserving archive: deliberately does not remove RouterOS users, sessions,
// cookies, hosts, or change any RouterOS configuration.
async function archive(req, res) {
  const identifier = clean(req.params.id, 255);
  if (!identifier) return error(res, 400, "A voucher ID, username, or MAC address is required.");
  try {
    const found = await db.query(
      "SELECT id FROM hotspot_vouchers WHERE ($1::bigint IS NOT NULL AND id=$1) OR LOWER(username)=LOWER($2) OR LOWER(mac_address)=LOWER($2) ORDER BY CASE WHEN ($1::bigint IS NOT NULL AND id=$1) THEN 0 ELSE 1 END,id DESC LIMIT 1",
      [/^\d+$/.test(identifier) && Number.isSafeInteger(Number(identifier)) ? Number(identifier) : null, identifier]
    );
    if (!found.rows?.length) return error(res, 404, "No PostgreSQL voucher matches this subscriber.");
    const saved = await db.query("UPDATE hotspot_vouchers SET status='archived',updated_at=NOW() WHERE id=$1 RETURNING id,username,status", [found.rows[0].id]);
    return res.json({ success: true, message: "Voucher archived in PostgreSQL only. The MikroTik user and sessions remain untouched.", subscriber: saved.rows[0] });
  } catch (e) {
    console.error("[Hotspot Subscriber 360] Archive failed:", e?.message || e);
    return error(res, 503, "Unable to archive the PostgreSQL voucher.");
  }
}

module.exports = { list, getProfile, updateProfile, renew, archive, normalizeMac, normalizePhone, validityMs };
