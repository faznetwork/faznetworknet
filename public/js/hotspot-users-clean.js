(function () {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  let users = [], selected = null, profiles = [], loading = false;
  const endpoint = id => "/api/hotspot/users/" + encodeURIComponent(String(id));
  async function request(url, options = {}) {
    const response = await fetch(url, { cache: "no-store", ...options, headers: { Accept: "application/json", ...(options.headers || {}) } });
    let data = {}; try { data = await response.json(); } catch (_) {}
    if (!response.ok || data.success !== true) throw new Error(data.message || data.error || "Request failed.");
    return data;
  }
  function toast(message, ok = true) {
    let host = $("#freshHotspotToast");
    if (!host) { host = document.createElement("div"); host.id = "freshHotspotToast"; host.className = "fresh-hs-toast-host"; document.body.appendChild(host); }
    const item = document.createElement("div"); item.className = "alert " + (ok ? "alert-success" : "alert-danger") + " shadow-sm"; item.setAttribute("role", "status"); item.textContent = message; host.appendChild(item);
    window.setTimeout(() => item.remove(), 4500);
  }
  function expiryLabel(value) {
    if (!value) return "Not set";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  }
  function statusLabel(user) { return user.is_online ? "Online" : String(user.status || "offline").replace(/^./, c => c.toUpperCase()); }
  function renderList() {
    const host = $("#freshHotspotUserList"), query = ($("#freshHotspotSearch")?.value || "").trim().toLowerCase();
    if (!host) return;
    const filtered = users.filter(user => [user.username,user.customer_name,user.phone,user.mac_address,user.profile,user.ip].some(value => String(value || "").toLowerCase().includes(query)));
    $("#freshHotspotCount").textContent = filtered.length + " subscriber" + (filtered.length === 1 ? "" : "s");
    host.innerHTML = filtered.length ? filtered.map(user => '<button type="button" class="fresh-hs-user '+(String(user.id)===String(selected?.id)?"is-selected":"")+'" data-user-id="'+esc(user.id)+'"><span class="fresh-hs-avatar">'+esc((user.customer_name||user.username||"?").slice(0,1).toUpperCase())+'</span><span class="fresh-hs-user-copy"><strong>'+esc(user.customer_name||"Unnamed Subscriber")+'</strong><span>'+esc(user.username)+'</span><small>'+esc(user.phone||"No phone")+' · '+esc(user.profile||"No package")+'</small></span><span class="fresh-hs-status '+(user.is_online?"is-online":"")+'">'+esc(statusLabel(user))+'</span></button>').join("") : '<div class="fresh-hs-empty">No subscribers match your search.</div>';
    host.querySelectorAll("[data-user-id]").forEach(button => button.addEventListener("click", () => selectUser(button.dataset.userId, true)));
  }
  function detailsMarkup(user) {
    if (!user) return '<div class="fresh-hs-empty fresh-hs-detail-empty"><div class="fs-1 mb-2">◎</div><strong>Select a subscriber</strong><p class="mb-0">Subscriber details and actions will appear here.</p></div>';
    const item = (label, value) => '<div class="fresh-hs-stat"><span>'+esc(label)+'</span><strong>'+esc(value || "Not set")+'</strong></div>';
    return '<div class="fresh-hs-detail-head"><div><div class="fresh-hs-eyebrow">SUBSCRIBER 360</div><h3>'+esc(user.customer_name||"Unnamed Subscriber")+'</h3><div class="text-muted">'+esc(user.username)+'</div></div><span class="fresh-hs-status '+(user.is_online?"is-online":"")+'">'+esc(statusLabel(user))+'</span></div><div class="fresh-hs-stats">'+item("Mobile",user.phone)+item("MAC address",user.mac_address)+item("Package",user.profile)+item("IP address",user.ip)+item("Uptime",user.uptime)+item("Expiry",expiryLabel(user.expires_at))+item("Server",user.server)+item("Comment",user.comment)+item("Notes",user.note)+'</div><div class="fresh-hs-actions"><button type="button" class="btn btn-success" data-action="renew">Quick Renew</button><button type="button" class="btn btn-outline-success" data-action="edit">Edit Profile</button><button type="button" class="btn btn-outline-warning" data-action="disconnect" disabled title="Disabled in this safety-scoped rebuild: active RouterOS sessions must remain untouched.">Disconnect</button><button type="button" class="btn btn-outline-danger" data-action="archive">Archive voucher</button></div><p class="fresh-hs-safety-note"><i class="bi bi-shield-check me-1"></i>Panel-only changes. RouterOS users, active sessions, cookies, hosts and configuration are not modified.</p>';
  }
  function renderDetail() {
    const desktop = $("#freshHotspotDetail"); if (desktop) desktop.innerHTML = detailsMarkup(selected);
    const mobile = $("#freshHotspotMobileBody"); if (mobile) mobile.innerHTML = detailsMarkup(selected);
    document.querySelectorAll("#freshHotspotWorkspace [data-action]").forEach(button => button.addEventListener("click", () => {
      if (!selected) return;
      if (button.dataset.action === "edit") openEdit();
      if (button.dataset.action === "renew") openRenew();
      if (button.dataset.action === "archive") archiveUser();
    }));
  }
  function selectUser(id, openMobile) {
    selected = users.find(user => String(user.id) === String(id)) || null;
    renderList(); renderDetail();
    if (openMobile && window.matchMedia("(max-width: 991.98px)").matches) {
      const modal = $("#freshSubscriberMobileModal");
      if (window.bootstrap?.Modal && modal) window.bootstrap.Modal.getOrCreateInstance(modal).show();
      else if (modal) modal.hidden = false;
    }
  }
  function modalShow(id) {
    const modal = $("#"+id);
    if (window.bootstrap?.Modal && modal) window.bootstrap.Modal.getOrCreateInstance(modal).show();
    else if (modal) { modal.hidden = false; modal.classList.add("show"); }
  }
  function modalHide(id) {
    const modal = $("#"+id);
    if (window.bootstrap?.Modal && modal) window.bootstrap.Modal.getOrCreateInstance(modal).hide();
    else if (modal) { modal.hidden = true; modal.classList.remove("show"); }
  }
  function openEdit() {
    if (!selected) return;
    const form = $("#freshEditProfileForm");
    form.elements.customer_name.value = selected.customer_name || "";
    form.elements.phone.value = selected.phone || "";
    form.elements.mac_address.value = selected.mac_address || "";
    form.elements.note.value = selected.note || "";
    form.elements.mac_lock.checked = selected.mac_lock !== false;
    $("#freshEditProfileResult").textContent = "";
    modalShow("freshEditProfileModal");
  }
  async function submitEdit(event) {
    event.preventDefault();
    const form = event.currentTarget, button = form.querySelector('[type="submit"]'), result = $("#freshEditProfileResult");
    button.disabled = true; result.className = "small mt-3 text-muted"; result.textContent = "Saving profile…";
    const payload = { customer_name: form.elements.customer_name.value.trim(), phone: form.elements.phone.value.trim(), mac_address: form.elements.mac_address.value.trim(), note: form.elements.note.value.trim(), mac_lock: form.elements.mac_lock.checked };
    try {
      const response = await fetch(endpoint(selected.id)+"/profile", { method:"PUT", headers:{"Content-Type":"application/json",Accept:"application/json"}, body:JSON.stringify(payload), cache:"no-store" });
      let data = {}; try { data = await response.json(); } catch (_) {}
      if (!(response.ok && data.success === true)) throw new Error(data.message || data.error || "Profile update failed.");
      result.className = "small mt-3 text-success fw-semibold"; result.textContent = "Profile saved.";
      toast(data.message || "Profile updated successfully.");
      modalHide("freshEditProfileModal");
      await loadUsers(selected.id);
    } catch (error) { result.className = "small mt-3 text-danger"; result.textContent = error.message || "Profile update failed."; }
    finally { button.disabled = false; }
  }
  async function loadProfiles() {
    const data = await request("/api/hotspot/profiles");
    profiles = Array.isArray(data.profiles) ? data.profiles : [];
  }
  function openRenew() {
    if (!selected) return;
    const select = $("#freshRenewProfile");
    select.innerHTML = '<option value="">Choose a package…</option>' + profiles.map(profile => '<option value="'+esc(profile.profile_id||profile.name)+'" data-name="'+esc(profile.name)+'" data-price="'+esc(profile.price||0)+'" data-validity="'+esc(profile.validityValue||1)+'" data-unit="'+esc(profile.validityUnit||"days")+'">'+esc(profile.name)+' · ৳'+Number(profile.price||0).toFixed(2)+'</option>').join("");
    select.value = selected.profile_id || "";
    $("#freshRenewNotify").checked = true; $("#freshRenewResult").textContent = "";
    updateRenewPreview(); modalShow("freshRenewModal");
  }
  function unitMs(value, unit) {
    const n = Number(value); if (!Number.isFinite(n) || n <= 0) return 0;
    unit = String(unit || "days").toLowerCase();
    return n * (unit.startsWith("s") ? 1000 : unit.startsWith("m") && !unit.startsWith("mo") ? 60000 : unit.startsWith("h") ? 3600000 : unit.startsWith("w") ? 604800000 : unit.startsWith("mo") ? 2592000000 : 86400000);
  }
  function updateRenewPreview() {
    const option = $("#freshRenewProfile")?.selectedOptions?.[0];
    $("#freshRenewPrice").textContent = option?.value ? "৳"+Number(option.dataset.price||0).toFixed(2) : "৳0.00";
    const duration = option?.value ? unitMs(option.dataset.validity,option.dataset.unit) : 0;
    const old = selected?.expires_at ? new Date(selected.expires_at) : null, now = new Date();
    const base = old && Number.isFinite(old.getTime()) && old > now ? old : now;
    $("#freshRenewExpiry").textContent = option?.value ? (duration ? expiryLabel(new Date(base.getTime()+duration)) : "Data quota") : "Choose package";
  }
  async function submitRenew(event) {
    event.preventDefault();
    if (!selected) return;
    const button = $("#freshRenewSubmit"), result = $("#freshRenewResult");
    button.disabled = true; result.className = "small mt-3 text-muted"; result.textContent = "Saving renewal…";
    try {
      const data = await request(endpoint(selected.id)+"/renew", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile_id:$("#freshRenewProfile").value,send_notification:$("#freshRenewNotify").checked})});
      result.className = "small mt-3 text-success fw-semibold"; result.textContent = "Renewal saved.";
      toast("Renewal saved. RouterOS was not changed.");
      modalHide("freshRenewModal"); await loadUsers(selected.id);
    } catch (error) { result.className = "small mt-3 text-danger"; result.textContent = error.message || "Renewal failed."; }
    finally { button.disabled = false; }
  }
  async function archiveUser() {
    if (!selected || !window.confirm("Archive this voucher in the panel database only? The MikroTik user and sessions will remain untouched.")) return;
    try {
      await request(endpoint(selected.id), {method:"DELETE"});
      toast("Voucher archived in PostgreSQL. MikroTik user remains intact.");
      await loadUsers(null);
    } catch (error) { toast(error.message || "Archive failed.", false); }
  }
  async function loadUsers(keepId) {
    if (loading) return; loading = true;
    const host = $("#freshHotspotUserList");
    if (host) host.innerHTML = '<div class="fresh-hs-empty">Loading subscribers…</div>';
    try {
      const data = await request("/api/hotspot/users");
      users = Array.isArray(data.users) ? data.users : [];
      selected = users.find(user => String(user.id) === String(keepId)) || selected && users.find(user => String(user.id) === String(selected.id)) || users[0] || null;
      renderList(); renderDetail();
      $("#freshHotspotCount").textContent = users.length + " subscribers";
    } catch (error) {
      if (host) host.innerHTML = '<div class="fresh-hs-empty text-danger">'+esc(error.message || "Unable to load subscribers.")+'</div>';
      const detail = $("#freshHotspotDetail"); if (detail) detail.innerHTML = '<div class="alert alert-danger">'+esc(error.message || "Unable to load subscribers.")+'</div>';
    } finally { loading = false; }
  }
  function workspaceMarkup() {
    return '<section id="freshHotspotWorkspace" class="hotspot-dynamic-view admin-view fresh-hs-workspace"><div class="fresh-hs-title-row"><div><div class="fresh-hs-eyebrow">HOTSPOT MANAGEMENT</div><h2>All Hotspot Users</h2><p>One subscriber list, one profile editor, and a unified Subscriber 360 detail view.</p></div><button type="button" id="freshHotspotRefresh" class="btn btn-outline-success">↻ Refresh</button></div><div class="fresh-hs-layout"><aside class="fresh-hs-list-panel"><div class="fresh-hs-list-heading"><strong>Subscribers</strong><span id="freshHotspotCount">Loading…</span></div><input id="freshHotspotSearch" class="form-control" type="search" placeholder="Search name, phone, MAC, IP…" aria-label="Search Hotspot subscribers"><div id="freshHotspotUserList" class="fresh-hs-user-list"><div class="fresh-hs-empty">Loading subscribers…</div></div></aside><main id="freshHotspotDetail" class="fresh-hs-detail-panel"></main></div></section><div class="modal fade" id="freshSubscriberMobileModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Subscriber 360</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">✕</button></div><div class="modal-body" id="freshHotspotMobileBody"></div></div></div></div><div class="modal fade" id="freshEditProfileModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><form id="freshEditProfileForm"><div class="modal-header"><h5 class="modal-title">Edit Subscriber Profile</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">✕</button></div><div class="modal-body"><label class="form-label">Customer Name<input class="form-control" name="customer_name" maxlength="160" required></label><label class="form-label">Mobile Number<input class="form-control" name="phone" inputmode="tel" maxlength="20"></label><label class="form-label">MAC Address<input class="form-control" name="mac_address" maxlength="32"></label><label class="form-label">Notes<textarea class="form-control" name="note" rows="3" maxlength="1000"></textarea></label><label class="form-check"><input class="form-check-input" type="checkbox" name="mac_lock"><span class="form-check-label">MAC lock</span></label><div id="freshEditProfileResult" class="small mt-3" role="status" aria-live="polite"></div></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-success">Save Profile</button></div></form></div></div></div><div class="modal fade" id="freshRenewModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><form id="freshRenewForm"><div class="modal-header"><h5 class="modal-title">Quick Renew</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">✕</button></div><div class="modal-body"><label class="form-label">Package<select id="freshRenewProfile" class="form-select" required><option value="">Loading packages…</option></select></label><div class="fresh-hs-renew-summary"><div><span>Price</span><strong id="freshRenewPrice">৳0.00</strong></div><div><span>Estimated new expiry</span><strong id="freshRenewExpiry">Choose package</strong></div></div><label class="form-check mt-3"><input class="form-check-input" id="freshRenewNotify" type="checkbox" checked><span class="form-check-label">Send SMS / WhatsApp notification</span></label><div id="freshRenewResult" class="small mt-3" role="status" aria-live="polite"></div></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button id="freshRenewSubmit" type="submit" class="btn btn-success">Confirm Renewal</button></div></form></div></div></div>';
  }
  function mount() {
    const dynamic = $("#dynamicPageContent");
    if (!dynamic) return;
    const old = dynamic.querySelector(".hotspot-dynamic-view");
    if (old) old.outerHTML = workspaceMarkup();
    else dynamic.insertAdjacentHTML("beforeend", workspaceMarkup());
    $("#freshHotspotSearch")?.addEventListener("input", renderList);
    $("#freshHotspotRefresh")?.addEventListener("click", () => loadUsers(selected?.id));
    $("#freshEditProfileForm")?.addEventListener("submit", submitEdit);
    $("#freshRenewForm")?.addEventListener("submit", submitRenew);
    $("#freshRenewProfile")?.addEventListener("change", updateRenewPreview);
    loadUsers();
    loadProfiles().then(updateRenewPreview).catch(error => console.warn("[Subscriber 360] Package list unavailable:", error.message));
  }
  function install() {
    if (typeof window.loadHotspotSection !== "function" || window.__freshHotspotInstalled) return;
    window.__freshHotspotInstalled = true;
    const original = window.loadHotspotSection;
    window.loadHotspotSection = async function (filter, titleKey) {
      await original.apply(this, arguments);
      if (filter === "all" && titleKey === "all_user") mount();
    };
    window.addEventListener("resize", () => {
      if (window.matchMedia("(min-width: 992px)").matches) modalHide("freshSubscriberMobileModal");
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, {once:true}); else install();
})();