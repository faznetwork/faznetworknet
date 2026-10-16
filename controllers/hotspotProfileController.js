"use strict";
const db = require("../db");
const mikrotikService = require("../services/mikrotikService");

function normalizePhone(value) {
  let digits = String(value ?? "").replace(/[০-৯]/g, ch => String("০১২৩৪৫৬৭৮৯".indexOf(ch))).replace(/\D/g, "");
  if (digits.startsWith("8801") && digits.length === 13) digits = "0" + digits.slice(3);
  return /^01[3-9]\d{8}$/.test(digits) ? digits : "";
}
function normalizeMac(value) {
  const compact = String(value ?? "").trim().replace(/[:-]/g, "");
  return /^[0-9a-fA-F]{12}$/.test(compact) ? compact.match(/.{2}/g).join(":").toUpperCase() : "";
}
function fail(res, status, message) { return res.status(status).json({ success: false, message, error: message }); }
function safeProfile(row) {
  return {
    id: row.id, username: row.username, name: row.customer_name || "",
    phone: row.phone || "", mac: row.mac_address || "",
    notes: row.note || "", profile: row.profile || "",
    profile_id: row.profile_id || "", status: row.status || "",
    expires_at: row.expires_at || null, server: row.server || "all"
  };
}
async function getProfile(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return fail(res, 400, "A valid hotspot customer ID is required.");
  try {
    const result = await db.query(
      "SELECT id,username,customer_name,phone,mac_address,note,profile,profile_id,status,expires_at,server FROM hotspot_vouchers WHERE id=$1 LIMIT 1",
      [id]
    );
    if (!result.rows?.length) return fail(res, 404, "Hotspot customer was not found.");
    return res.json({ success: true, profile: safeProfile(result.rows[0]) });
  } catch (error) {
    console.error("[Hotspot Profile API] Read failed:", error);
    return fail(res, 503, "Unable to load hotspot customer profile.");
  }
}
async function updateProfile(req, res) {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return fail(res, 400, "A valid hotspot customer ID is required.");
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const name = String(body.name ?? body.customer_name ?? "").trim().slice(0, 160);
  const phone = normalizePhone(body.phone ?? body.customer_phone);
  const rawMac = String(body.mac ?? body.mac_address ?? "").trim();
  const mac = rawMac ? normalizeMac(rawMac) : "";
  const notes = String(body.notes ?? body.note ?? "").trim().slice(0, 500);
  if (!name) return fail(res, 400, "Customer name is required.");
  if (!phone) return fail(res, 400, "Enter a valid Bangladesh mobile number (01XXXXXXXXX or 8801XXXXXXXXX).");
  if (rawMac && !mac) return fail(res, 400, "Enter a valid MAC address.");
  try {
    const found = await db.query(
      "SELECT id,username,customer_name,phone,mac_address,note,profile,profile_id,status,expires_at,server FROM hotspot_vouchers WHERE id=$1 LIMIT 1",
      [id]
    );
    const row = found.rows?.[0];
    if (!row) return fail(res, 404, "Hotspot customer was not found.");
    const username = String(row.username || "").trim();
    if (!username) return fail(res, 409, "This customer has no MikroTik username; profile sync was not attempted.");
    // Keep the existing RouterOS profile and expiry comment intact; phone is the account password.
    const routerUser = await mikrotikService.getHotspotUser(username);
    if (!routerUser) return fail(res, 409, "The matching MikroTik Hotspot user was not found; database changes were not saved.");
    const chosenMac = mac || normalizeMac(row.mac_address) || normalizeMac(username);
    const sync = await mikrotikService.updateHotspotUser(
      username, routerUser.profile, routerUser.comment, phone, chosenMac
    );
    const saved = await db.query(
      "UPDATE hotspot_vouchers SET customer_name=$1,phone=$2,mac_address=$3,note=$4,updated_at=NOW() WHERE id=$5 RETURNING id,username,customer_name,phone,mac_address,note,profile,profile_id,status,expires_at,server",
      [name, phone, chosenMac || null, notes, id]
    );
    try { require("../controllers/hotspotController").invalidateListCache?.(); } catch (_) {}
    return res.json({ success: true, message: "Customer profile saved and MikroTik credentials synchronized.", profile: safeProfile(saved.rows[0]), routerSync: sync });
  } catch (error) {
    console.error("[Hotspot Profile API] Update failed:", error);
    return fail(res, error.statusCode || 502, "Profile update or MikroTik synchronization failed; database profile was not changed. " + String(error.message || "").slice(0, 220));
  }
}
module.exports = { getProfile, updateProfile };
