"use strict";
const db = require("../db");
const net = require("net");
const mikrotikService = require("../services/mikrotikService");

function clean(value, max = 255) { return String(value == null ? "" : value).trim().slice(0, max); }
function mac(value) {
  const normalized = mikrotikService.normalizeHotspotMac(value);
  if (!normalized) throw Object.assign(new Error("Enter a valid MAC address."), { status: 400 });
  return normalized;
}
function dhakaDate(value) {
  if (!value) return null;
  const raw = String(value).trim();
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw) ? raw : raw.replace(" ", "T") + "+06:00";
  const date = new Date(withZone);
  if (Number.isNaN(date.getTime())) throw Object.assign(new Error("Expiry date is invalid."), { status: 400 });
  return date.toISOString();
}
function bandwidth(value) {
  const text = clean(value || "unlimited", 80).replace(/\s/g, "");
  if (/^(unlimited|fullspeed|full-speed)$/i.test(text)) return "unlimited";
  if (!/^\d+(?:\.\d+)?[kMGT]?\/\d+(?:\.\d+)?[kMGT]?$/i.test(text)) {
    throw Object.assign(new Error("Bandwidth must be Unlimited or in upload/download form, for example 5M/5M."), { status: 400 });
  }
  return text;
}
function actor(req) {
  const user = req.user || req.session?.admin || req.session?.user || {};
  return { username: clean(user.username || user.name || user.email || "admin", 160), role: clean(user.role || user.admin_role || "admin", 60) };
}
async function audit(req, action, row, details = {}) {
  const who = actor(req);
  await db.query(
    "INSERT INTO admin_audit_logs (actor_username, actor_role, action, details, ip_address, created_at) VALUES ($1,$2,$3,$4::jsonb,$5,NOW())",
    [who.username, who.role, action, JSON.stringify(Object.assign({ binding_id: row.id, mac_address: row.mac_address, ip_address: row.ip_address }, details)), req.ip || null]
  ).catch((error) => console.error("[Hotspot binding audit] Could not write audit event:", error.message));
}
function responseError(res, error) {
  const status = Number(error.status) || 500;
  return res.status(status).json({ success: false, message: status >= 500 ? "Hotspot binding operation failed." : error.message });
}

async function list(req, res) {
  try {
    const result = await db.query("SELECT * FROM hotspot_ip_bindings WHERE archived_at IS NULL ORDER BY created_at DESC,id DESC");
    let routerBindings = [], routerError = null;
    try { routerBindings = await mikrotikService.getHotspotIpBindings(); }
    catch (error) { routerError = error.message; }
    const byMarker = new Map(routerBindings.map((item) => {
      const match = item.comment.match(/^FAZ\|HSIPBIND\|(\d+)\|/);
      return match ? [match[1], item] : ["", null];
    }).filter((entry) => entry[0]));
    const bindings = result.rows.map((row) => {
      const router = byMarker.get(String(row.id));
      return Object.assign({}, row, {
        router_status: router ? router.type : "unavailable",
        router_binding_id: router ? router.id : row.router_binding_id,
        in_sync: Boolean(router && router.macAddress.toUpperCase() === String(row.mac_address).toUpperCase())
      });
    });
    return res.json({ success: true, bindings, router_error: routerError });
  } catch (error) { return responseError(res, error); }
}

async function create(req, res) {
  let inserted;
  try {
    const macAddress = mac(req.body.mac_address || req.body.macAddress);
    const type = clean(req.body.binding_type || req.body.bindingType || "bypassed", 20).toLowerCase();
    if (!["bypassed", "regular", "blocked"].includes(type)) throw Object.assign(new Error("Binding type must be bypassed, regular, or blocked."), { status: 400 });
    const bandwidthProfile = bandwidth(req.body.bandwidth_profile || req.body.bandwidthProfile);
    let ipAddress = clean(req.body.ip_address || req.body.ipAddress, 64) || null;
    if (ipAddress) { const address = ipAddress.split("/")[0]; const prefix = ipAddress.includes("/") ? Number(ipAddress.split("/")[1]) : (address.includes(":") ? 128 : 32); if (!net.isIP(address) || !Number.isInteger(prefix) || prefix < 0 || prefix > (address.includes(":") ? 128 : 32)) throw Object.assign(new Error("IP address is invalid."), { status: 400 }); }
    if (bandwidthProfile !== "unlimited" && !ipAddress) {
      const sessions = await mikrotikService.getActiveHotspotSessions();
      const session = sessions.find((item) => String(item.macAddress || "").replace(/[:-]/g, "").toUpperCase() === macAddress.replace(/:/g, ""));
      if (session) ipAddress = session.address || null;
      if (!ipAddress) throw Object.assign(new Error("A bandwidth-limited binding needs an IP address or a current active Hotspot session for this MAC."), { status: 400 });
    }
    const expiryDate = dhakaDate(req.body.expiry_date || req.body.expiryDate);
    if (!expiryDate || new Date(expiryDate).getTime() <= Date.now()) throw Object.assign(new Error("Choose an expiry date in the future."), { status: 400 });
    const values = [macAddress, ipAddress, clean(req.body.customer_name || req.body.customerName, 160) || null, clean(req.body.phone, 40) || null, clean(req.body.comment, 500), type, clean(req.body.package_id || req.body.packageId, 120) || null, bandwidthProfile, expiryDate];
    const saved = await db.query(
      "INSERT INTO hotspot_ip_bindings (mac_address,ip_address,customer_name,phone,comment,binding_type,package_id,bandwidth_profile,expiry_date,status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'disabled') RETURNING *", values
    );
    inserted = saved.rows[0];
    const router = await mikrotikService.syncHotspotIpBinding({ id: inserted.id, macAddress: inserted.mac_address, ipAddress: inserted.ip_address, comment: inserted.comment, bindingType: inserted.binding_type, bandwidthProfile: inserted.bandwidth_profile });
    const active = await db.query("UPDATE hotspot_ip_bindings SET status='active',router_binding_id=$2,last_synced_at=NOW(),router_sync_error=NULL,updated_at=NOW() WHERE id=$1 RETURNING *", [inserted.id, router.routerBindingId]);
    await audit(req, "hotspot_ip_binding.created", active.rows[0], { binding_type: type, bandwidth_profile: bandwidthProfile, expiry_date: expiryDate });
    return res.status(201).json({ success: true, binding: active.rows[0] });
  } catch (error) {
    if (inserted) { await mikrotikService.removeHotspotIpBinding(inserted.id).catch((cleanupError) => console.error("[Hotspot binding rollback] Router cleanup failed:", cleanupError.message)); await db.query("UPDATE hotspot_ip_bindings SET router_sync_error=$2,updated_at=NOW() WHERE id=$1", [inserted.id, clean(error.message, 500)]).catch(() => {}); }
    return responseError(res, error);
  }
}

async function update(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) throw Object.assign(new Error("Binding was not found."), { status: 404 });
    const found = await db.query("UPDATE hotspot_ip_bindings SET expiry_processing_started_at=NOW() WHERE id=$1 AND archived_at IS NULL AND expiry_processing_started_at IS NULL RETURNING *", [id]);
    if (!found.rows.length) throw Object.assign(new Error("Binding is unavailable or currently expiring."), { status: 409 });
    const current = found.rows[0], body = req.body || {};
    const next = Object.assign({}, current);
    if (body.mac_address || body.macAddress) next.mac_address = mac(body.mac_address || body.macAddress);
    if (body.ip_address !== undefined || body.ipAddress !== undefined) next.ip_address = clean(body.ip_address || body.ipAddress, 64) || null;
    if (body.customer_name !== undefined || body.customerName !== undefined) next.customer_name = clean(body.customer_name || body.customerName, 160) || null;
    if (body.phone !== undefined) next.phone = clean(body.phone, 40) || null;
    if (body.comment !== undefined) next.comment = clean(body.comment, 500);
    if (body.binding_type || body.bindingType) next.binding_type = clean(body.binding_type || body.bindingType, 20).toLowerCase();
    if (!["bypassed", "regular", "blocked"].includes(next.binding_type)) throw Object.assign(new Error("Binding type must be bypassed, regular, or blocked."), { status: 400 });
    if (body.bandwidth_profile !== undefined || body.bandwidthProfile !== undefined) next.bandwidth_profile = bandwidth(body.bandwidth_profile || body.bandwidthProfile);
    if (body.package_id !== undefined || body.packageId !== undefined) next.package_id = clean(body.package_id || body.packageId, 120) || null;
    if (body.expiry_date !== undefined || body.expiryDate !== undefined) next.expiry_date = dhakaDate(body.expiry_date || body.expiryDate);
    if (!next.expiry_date || new Date(next.expiry_date).getTime() <= Date.now()) throw Object.assign(new Error("Choose an expiry date in the future."), { status: 400 });
    if (next.bandwidth_profile !== "unlimited" && !next.ip_address) throw Object.assign(new Error("A bandwidth-limited binding needs an IP address."), { status: 400 });
    const router = await mikrotikService.syncHotspotIpBinding({ id, macAddress: next.mac_address, ipAddress: next.ip_address, comment: next.comment, bindingType: next.binding_type, bandwidthProfile: next.bandwidth_profile });
    const saved = await db.query(
      "UPDATE hotspot_ip_bindings SET mac_address=$2,ip_address=$3,customer_name=$4,phone=$5,comment=$6,binding_type=$7,package_id=$8,bandwidth_profile=$9,expiry_date=$10,status='active',archived_at=NULL,expiry_processing_started_at=NULL,router_binding_id=$11,last_synced_at=NOW(),router_sync_error=NULL,updated_at=NOW() WHERE id=$1 RETURNING *",
      [id,next.mac_address,next.ip_address,next.customer_name,next.phone,next.comment,next.binding_type,next.package_id,next.bandwidth_profile,next.expiry_date,router.routerBindingId]
    );
    await audit(req, "hotspot_ip_binding.updated", saved.rows[0], { expiry_date: next.expiry_date });
    return res.json({ success: true, binding: saved.rows[0] });
  } catch (error) { const id=Number(req.params.id); if(Number.isSafeInteger(id)) await db.query("UPDATE hotspot_ip_bindings SET expiry_processing_started_at=NULL WHERE id=$1", [id]).catch(()=>{}); return responseError(res, error); }
}

async function remove(req, res) {
  try {
    const id = Number(req.params.id);
    const result = await db.query("UPDATE hotspot_ip_bindings SET expiry_processing_started_at=NOW() WHERE id=$1 AND archived_at IS NULL AND expiry_processing_started_at IS NULL RETURNING *", [id]);
    if (!result.rows.length) throw Object.assign(new Error("Binding is unavailable or currently expiring."), { status: 409 });
    const row = result.rows[0];
    await mikrotikService.removeHotspotIpBinding(id);
    const saved = await db.query("UPDATE hotspot_ip_bindings SET status='disabled',archived_at=NOW(),expiry_processing_started_at=NULL,updated_at=NOW(),router_binding_id=NULL,last_synced_at=NOW(),router_sync_error=NULL WHERE id=$1 RETURNING *", [id]);
    await audit(req, "hotspot_ip_binding.archived", saved.rows[0]);
    return res.json({ success: true, binding: saved.rows[0] });
  } catch (error) { const id=Number(req.params.id); if(Number.isSafeInteger(id)) await db.query("UPDATE hotspot_ip_bindings SET expiry_processing_started_at=NULL WHERE id=$1", [id]).catch(()=>{}); return responseError(res, error); }
}

module.exports = { list, create, update, remove, audit, dhakaDate, bandwidth };
