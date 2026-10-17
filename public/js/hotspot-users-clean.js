(function () {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  let users = [], selected = null, profiles = [], loading = false, selectedFilter = "all";
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
  function stateOf(user) { const s=String(user?.status||"").toLowerCase(),e=user?.expires_at?new Date(user.expires_at):null;if(s==="expired"||(e&&e.getTime()<Date.now())||String(user?.profile||"").toLowerCase()==="expired_profile")return "expired";if(user?.is_online||user?.online)return "online";if(e&&e.getTime()>Date.now())return "active";return "offline"; }
  function statusLabel(user){return ({online:"Online",active:"Active",offline:"Offline",expired:"Expired"})[stateOf(user)];}
  function expiryLabel(v){if(!v)return "Not set";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toISOString().slice(0,19).replace("T"," ");}
  function remainTag(u){if(!u.expires_at)return '<span class="hs-remain-tag hs-remain-none">—</span>';const ms=new Date(u.expires_at).getTime()-Date.now(),days=Math.ceil(ms/86400000),k=ms<=0?"expired":days<=3?"soon":"good";return '<span class="hs-remain-tag hs-remain-'+k+'">'+(ms<=0?"Expired":days+"d left")+'</span>';}
  function packageClass(u){if(stateOf(u)==="expired")return "expired";const t=String(u.validity||u.profile||"").toLowerCase();if(/30\s*(day|d)|1\s*month/.test(t))return "30d";if(/15\s*(day|d)/.test(t))return "15d";if(/7\s*(day|d)|1\s*week/.test(t))return "7d";if(/1\s*(day|d)|24\s*h/.test(t))return "1d";return "default";}
  function packageLabel(u){return stateOf(u)==="expired"?"Expired":String(u.profile||u.validity||"No Package");}
  function bytesLabel(v){const n=Number(v||0);if(!n)return "0 B";const a=["B","KB","MB","GB","TB"],i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),4);return (n/Math.pow(1024,i)).toFixed(i?1:0)+" "+a[i];}
  function actionButtons(u,mobile){const online=stateOf(u)==="online";return '<div class="hs-row-actions"><button class="btn btn-sm btn-outline-success" type="button" data-row-action="renew" data-id="'+esc(u.id)+'">🔄 Renew</button><button class="btn btn-sm btn-outline-primary" type="button" data-row-action="edit" data-id="'+esc(u.id)+'">✏️ Edit</button><button class="btn btn-sm btn-outline-warning" type="button" data-row-action="disconnect" data-id="'+esc(u.id)+'" '+(online&&u.sessionId?"":"disabled")+'>🚫 Disconnect</button><button class="btn btn-sm btn-outline-danger" type="button" data-row-action="archive" data-id="'+esc(u.id)+'">🗑️ Delete</button>'+(mobile?'<button class="btn btn-sm btn-dark" type="button" data-open-user="'+esc(u.id)+'">Details</button>':"")+'</div>';}
  function renderList(){
    const host=$("#freshHotspotUserList"),q=($("#freshHotspotSearch")?.value||"").trim().toLowerCase();if(!host)return;
    const b={all:users,online:users.filter(u=>stateOf(u)==="online"),active:users.filter(u=>stateOf(u)==="active"),offline:users.filter(u=>stateOf(u)==="offline"),expired:users.filter(u=>stateOf(u)==="expired")};
    const list=(b[selectedFilter]||users).filter(u=>[u.username,u.customer_name,u.phone,u.mac_address,u.macAddress,u.profile,u.ip,u.address].some(v=>String(v||"").toLowerCase().includes(q)));
    $("#freshHotspotCount").textContent=list.length+" of "+users.length+" subscribers";
    const tabs='<div class="hs-filter-tabs" role="group" aria-label="Filter Hotspot subscribers">'+[["all","🌐 All Users","count-all"],["online","🟢 Online","count-online"],["active","⚡ Active","count-active"],["offline","⚪ Offline","count-offline"],["expired","🔴 Expired","count-expired"]].map(([k,l,id])=>'<button type="button" class="hs-filter-tab hs-filter-'+k+(selectedFilter===k?" is-selected":"")+'" data-filter="'+k+'" aria-pressed="'+(selectedFilter===k)+'">'+l+' <span id="'+id+'">'+b[k].length+'</span></button>').join("")+'</div>';
    const rows=list.map((u,i)=>{const s=stateOf(u);return '<tr class="hs-executive-row" data-user-id="'+esc(u.id)+'"><td><span class="hs-serial">'+(i+1)+'</span></td><td><strong class="hs-subscriber-name">'+esc(u.customer_name||u.name||"Unnamed Subscriber")+'</strong><div class="hs-subscriber-phone">'+esc(u.phone||"No phone")+'</div><span class="hs-mac-pill">'+esc(u.mac_address||u.macAddress||u.username||"—")+'</span></td><td><span class="hs-package-pill hs-package-'+packageClass(u)+'">'+esc(packageLabel(u))+'</span></td><td><span class="hs-state hs-state-'+s+'">'+(s==="online"?"● ":s==="active"?"⚡ ":"")+statusLabel(u)+'</span></td><td><div class="hs-ip">'+esc(u.ip||u.address||"—")+'</div><div class="hs-session">'+esc(u.uptime||"—")+' · ↓ '+esc(bytesLabel(u.bytesOut))+'</div></td><td><div class="hs-expiry">'+esc(expiryLabel(u.expires_at))+'</div>'+remainTag(u)+'</td><td>'+actionButtons(u,false)+'</td></tr>';}).join("");
    const cards=list.map((u,i)=>{const s=stateOf(u);return '<article class="hs-mobile-card"><button type="button" class="hs-mobile-open" data-open-user="'+esc(u.id)+'"><span class="hs-serial">'+(i+1)+'</span><span class="hs-mobile-main"><strong>'+esc(u.customer_name||u.name||"Unnamed Subscriber")+'</strong><small>'+esc(u.phone||"No phone")+' · '+esc(u.mac_address||u.macAddress||u.username||"—")+'</small><span class="hs-state hs-state-'+s+'">'+statusLabel(u)+'</span></span><span class="hs-mobile-chevron">›</span></button><div class="hs-mobile-meta"><span>'+esc(packageLabel(u))+'</span><span>'+esc(expiryLabel(u.expires_at))+'</span>'+remainTag(u)+'</div><div class="hs-mobile-actions">'+actionButtons(u,true)+'</div></article>';}).join("");
    host.innerHTML=tabs+'<div class="hs-desktop-table-wrap"><table class="hs-executive-table"><thead><tr><th>#</th><th>SUBSCRIBER &amp; DEVICE</th><th>PACKAGE</th><th>STATUS</th><th>IP &amp; SESSION</th><th>EXPIRATION &amp; REMAINING</th><th>ACTIONS</th></tr></thead><tbody>'+(rows||'<tr><td colspan="7" class="hs-empty-row">No subscribers in this filter.</td></tr>')+'</tbody></table></div><div class="hs-mobile-cards">'+(cards||'<div class="hs-empty-row">No subscribers in this filter.</div>')+'</div>';
    host.querySelectorAll("[data-filter]").forEach(x=>x.addEventListener("click",()=>{selectedFilter=x.dataset.filter||"all";renderList();}));
    host.querySelectorAll("[data-open-user]").forEach(x=>x.addEventListener("click",e=>{e.stopPropagation();selectUser(x.dataset.openUser,true);}));
    host.querySelectorAll("[data-row-action]").forEach(x=>x.addEventListener("click",e=>{e.stopPropagation();const u=users.find(v=>String(v.id)===String(x.dataset.id));if(u){selected=u;renderDetail();runRowAction(x.dataset.rowAction,u);}}));
    host.querySelectorAll(".hs-executive-row").forEach(x=>x.addEventListener("click",()=>selectUser(x.dataset.userId,false)));
  }
  function detailsMarkup(user){if(!user)return '<div class="fresh-hs-empty fresh-hs-detail-empty">Select a subscriber</div>';const s=stateOf(user),item=(l,v)=>'<div class="fresh-hs-stat"><span>'+esc(l)+'</span><strong>'+esc(v||"Not set")+'</strong></div>';return '<div class="fresh-hs-detail-head"><div><div class="fresh-hs-eyebrow">SUBSCRIBER 360</div><h3>'+esc(user.customer_name||user.name||"Unnamed Subscriber")+'</h3><div>'+esc(user.username)+'</div></div><span class="hs-state hs-state-'+s+'">'+statusLabel(user)+'</span></div><div class="fresh-hs-stats">'+item("Mobile",user.phone)+item("MAC",user.mac_address||user.macAddress)+item("Package",packageLabel(user))+item("IP",user.ip||user.address)+item("Uptime",user.uptime)+item("Downloaded",bytesLabel(user.bytesOut))+item("Expiration",expiryLabel(user.expires_at))+item("Server",user.server)+item("Comment",user.comment)+'</div><div class="fresh-hs-actions"><button class="btn btn-success" data-action="renew">🔄 Renew</button><button class="btn btn-outline-success" data-action="edit">✏️ Edit</button><button class="btn btn-outline-warning" data-action="disconnect" '+(s==="online"&&user.sessionId?"":"disabled")+'>🚫 Disconnect</button><button class="btn btn-outline-danger" data-action="archive">🗑️ Delete / Archive</button></div>';}
  function renderDetail(){const d=$("#freshHotspotDetail");if(d)d.innerHTML=detailsMarkup(selected);const m=$("#freshHotspotMobileBody");if(m)m.innerHTML=detailsMarkup(selected)+'<button type="button" class="btn btn-dark w-100 mt-3" data-bs-dismiss="modal">✕ Close</button>';[d,m].filter(Boolean).forEach(root=>root.querySelectorAll("[data-action]").forEach(x=>x.addEventListener("click",()=>{if(selected)runRowAction(x.dataset.action,selected);})));}
  async function runRowAction(action,user){if(action==="edit"){openEdit();return;}if(action==="renew"){openRenew();return;}if(action==="archive"){await archiveUser();return;}if(action==="disconnect"){if(!user.sessionId){toast("No active MikroTik session ID is available.",false);return;}if(!window.confirm("Disconnect this active Hotspot session?"))return;try{await request("/api/hotspot/active/disconnect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:user.sessionId})});toast("Active session disconnected.");await loadUsers(user.id);}catch(e){toast(e.message||"Disconnect failed.",false);}}}
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
  function workspaceMarkup(){return `<section id="freshHotspotWorkspace" class="hotspot-dynamic-view admin-view fresh-hs-workspace"><div class="fresh-hs-title-row"><div><div class="fresh-hs-eyebrow">HOTSPOT MANAGEMENT</div><h2>All Hotspot Users</h2><p>Executive subscriber rows with instant status filters and responsive Subscriber 360 actions.</p></div><button type="button" id="freshHotspotRefresh" class="btn btn-outline-success">↻ Refresh</button></div><div class="fresh-hs-list-panel"><div class="fresh-hs-list-heading"><strong>Subscribers</strong><span id="freshHotspotCount">Loading…</span></div><input id="freshHotspotSearch" class="form-control" type="search" placeholder="Search name, phone, MAC, IP…" aria-label="Search Hotspot subscribers"><div id="freshHotspotUserList"><div class="fresh-hs-empty">Loading subscribers…</div></div></div></section>` + '<div class="modal fade fresh-hs-mobile-modal" id="freshSubscriberMobileModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Subscriber 360</h5><button type="button" class="btn btn-dark btn-lg" data-bs-dismiss="modal">✕ Close</button></div><div class="modal-body" id="freshHotspotMobileBody"></div></div></div></div><div class="modal fade" id="freshEditProfileModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><form id="freshEditProfileForm"><div class="modal-header"><h5 class="modal-title">Edit Subscriber Profile</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">✕</button></div><div class="modal-body"><label class="form-label">Customer Name<input class="form-control" name="customer_name" maxlength="160" required></label><label class="form-label">Mobile Number<input class="form-control" name="phone" inputmode="tel" maxlength="20"></label><label class="form-label">MAC Address<input class="form-control" name="mac_address" maxlength="32"></label><label class="form-label">Notes<textarea class="form-control" name="note" rows="3" maxlength="1000"></textarea></label><label class="form-check"><input class="form-check-input" type="checkbox" name="mac_lock"><span class="form-check-label">MAC lock</span></label><div id="freshEditProfileResult" class="small mt-3" role="status" aria-live="polite"></div></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-success">Save Profile</button></div></form></div></div></div><div class="modal fade" id="freshRenewModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><form id="freshRenewForm"><div class="modal-header"><h5 class="modal-title">Quick Renew</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">✕</button></div><div class="modal-body"><label class="form-label">Package<select id="freshRenewProfile" class="form-select" required><option value="">Loading packages…</option></select></label><div class="fresh-hs-renew-summary"><div><span>Price</span><strong id="freshRenewPrice">৳0.00</strong></div><div><span>Estimated new expiry</span><strong id="freshRenewExpiry">Choose package</strong></div></div><label class="form-check mt-3"><input class="form-check-input" id="freshRenewNotify" type="checkbox" checked><span class="form-check-label">Send SMS / WhatsApp notification</span></label><div id="freshRenewResult" class="small mt-3" role="status" aria-live="polite"></div></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button id="freshRenewSubmit" type="submit" class="btn btn-success">Confirm Renewal</button></div></form></div></div></div>';}
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