(function () {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
  let users = [], selected = null, profiles = [], loading = false, selectedFilter = "all";
  let countdownInterval = null, countdownRenderPending = false, countdownVisibilityBound = false;
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
  function isValidPackage(user){const e=user?.expires_at?new Date(user.expires_at):null;return Boolean(e&&!Number.isNaN(e.getTime())&&e.getTime()>Date.now()&&String(user?.status||"").toLowerCase()!=="expired"&&String(user?.profile||"").toLowerCase()!=="expired_profile");}
  function stateOf(user){const s=String(user?.status||"").toLowerCase(),e=user?.expires_at?new Date(user.expires_at):null;if(s==="expired"||(e&&!Number.isNaN(e.getTime())&&e.getTime()<=Date.now())||String(user?.profile||"").toLowerCase()==="expired_profile")return "expired";if((user?.is_online||user?.online)&&String(user?.ip||user?.address||"").trim())return "online";return "offline";}
  function statusLabel(user){const state=stateOf(user);if(state==="offline"&&isValidPackage(user))return "Offline (Active Plan)";return ({online:"Online",offline:"Offline",expired:"Expired"})[state];}
  function expiryLabel(v){if(!v)return "Not set";const d=new Date(v);if(Number.isNaN(d.getTime()))return String(v);if(window.FazDate&&typeof window.FazDate.formatDateTime==="function")return window.FazDate.formatDateTime(d);return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Dhaka",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true}).format(d);}
  function stopLiveCountdown(){if(countdownInterval!==null){window.clearInterval(countdownInterval);countdownInterval=null;}}
  function formatCountdown(delta){
    const seconds=Math.max(0,Math.floor(delta/1000)),days=Math.floor(seconds/86400),hours=Math.floor(seconds%86400/3600),minutes=Math.floor(seconds%3600/60),secs=seconds%60;
    if(days>0)return String(days).padStart(2,"0")+"d "+String(hours).padStart(2,"0")+"h "+String(minutes).padStart(2,"0")+"m "+String(secs).padStart(2,"0")+"s";
    if(hours>0)return String(hours).padStart(2,"0")+"h "+String(minutes).padStart(2,"0")+"m "+String(secs).padStart(2,"0")+"s";
    return String(minutes).padStart(2,"0")+"m "+String(secs).padStart(2,"0")+"s";
  }
  function updateLiveCountdowns(){
    if(document.hidden)return;
    const now=Date.now();let statusChanged=false;
    document.querySelectorAll(".hs-live-countdown[data-expiry]").forEach(el=>{
      const target=Date.parse(el.dataset.expiry||"");
      if(!Number.isFinite(target)){el.textContent="Expiry unavailable";el.classList.add("hs-remain-none");return;}
      const delta=target-now;
      if(delta<=0){
        if(el.dataset.expiredState!=="true")statusChanged=true;
        el.dataset.expiredState="true";el.textContent="EXPIRED";
        el.classList.remove("hs-remain-good","hs-remain-soon","hs-remain-none");
        el.classList.add("hs-remain-expired","badge","bg-danger-subtle","text-danger","font-mono");
        return;
      }
      el.dataset.expiredState="false";el.textContent=formatCountdown(delta);
      el.classList.remove("hs-remain-expired","hs-remain-none","badge","bg-danger-subtle","text-danger");
      el.classList.add("font-mono","tabular-nums");
      el.classList.toggle("hs-remain-soon",delta<=259200000);el.classList.toggle("hs-remain-good",delta>259200000);
    });
    if(statusChanged&&!countdownRenderPending){
      countdownRenderPending=true;
      window.setTimeout(()=>{countdownRenderPending=false;renderList();},0);
    }
  }
  function startLiveCountdown(){
    if(!countdownVisibilityBound){document.addEventListener("visibilitychange",handleCountdownVisibility);countdownVisibilityBound=true;}
    if(document.hidden){stopLiveCountdown();return;}
    stopLiveCountdown();updateLiveCountdowns();
    countdownInterval=window.setInterval(updateLiveCountdowns,1000);
  }
  function handleCountdownVisibility(){if(document.hidden)stopLiveCountdown();else startLiveCountdown();}
  function remainTag(u){
    if(!u.expires_at)return '<span class="hs-remain-tag hs-remain-none">—</span>';
    const target=Date.parse(u.expires_at),expired=Number.isFinite(target)&&target-Date.now()<=0;
    const initial=Number.isFinite(target)?(expired?"EXPIRED":formatCountdown(target-Date.now())):"Expiry unavailable";
    return '<span class="hs-remain-tag hs-live-countdown '+(expired?'hs-remain-expired badge bg-danger-subtle text-danger':'hs-remain-good')+' font-mono tabular-nums" data-expiry="'+esc(u.expires_at)+'" data-expired-state="'+String(expired)+'" aria-live="off">'+esc(initial)+'</span>';
  }
  function packageClass(u){if(stateOf(u)==="expired")return "expired";const t=String(u.validity||u.profile||"").toLowerCase();if(/30\s*(day|d)|1\s*month/.test(t))return "30d";if(/15\s*(day|d)/.test(t))return "15d";if(/7\s*(day|d)|1\s*week/.test(t))return "7d";if(/1\s*(day|d)|24\s*h/.test(t))return "1d";return "default";}
  function packageLabel(u){return stateOf(u)==="expired"?"Expired":String(u.profile||u.validity||"No Package");}
  function bytesLabel(v){const n=Number(v||0);if(!n)return "0 B";const a=["B","KB","MB","GB","TB"],i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),4);return (n/Math.pow(1024,i)).toFixed(i?1:0)+" "+a[i];}
  function copyMacButton(user){
    const mac=String(user.mac_address||user.macAddress||user.username||"").trim();
    if(!mac)return '<span class="hs-mac-value">—</span>';
    return '<span class="hs-mac-copy"><code class="hs-mac-value">'+esc(mac)+'</code><button type="button" class="hs-copy-mac" data-copy-mac="'+esc(mac)+'" aria-label="Copy MAC address" title="Copy MAC address">📋</button></span>';
  }
  function actionButtons(u,context){
    const online=stateOf(u)==="online"&&Boolean(u.sessionId),scope=context==="mobile"?"mobile":"desktop";
    const kick=online?'<button type="button" class="btn btn-sm btn-outline-warning hs-quick-kick" data-row-action="disconnect" data-id="'+esc(u.id)+'" aria-label="Quick kick '+esc(u.customer_name||u.name||u.username||"subscriber")+'" title="Quick kick"><span aria-hidden="true">⚡</span></button>':"";
    return '<div class="hs-action-cluster btn-hotspot-action hs-action-'+scope+'" data-action-scope="'+scope+'">'+
      '<button type="button" class="btn btn-sm btn-outline-primary hs-action-renew btn-action-renew" data-row-action="renew" data-id="'+esc(u.id)+'" aria-label="Renew '+esc(u.customer_name||u.name||u.username||"subscriber")+'" title="Renew"><span aria-hidden="true">🔄</span><span>Renew</span></button>'+kick+
      '<button type="button" class="btn btn-sm btn-light border hs-kebab-toggle" data-menu-toggle aria-haspopup="menu" aria-expanded="false" aria-label="More subscriber actions" title="More actions"><span aria-hidden="true">⋮</span></button>'+
      '<div class="hs-action-menu" role="menu" hidden>'+
        '<button type="button" class="hs-action-item" role="menuitem" data-row-action="edit" data-id="'+esc(u.id)+'"><span aria-hidden="true">✏️</span><span>Edit Details</span></button>'+
        '<button type="button" class="hs-action-item" role="menuitem" data-row-action="unbind" data-id="'+esc(u.id)+'"><span aria-hidden="true">🔓</span><span>Reset MAC Binding</span></button>'+
        '<hr>'+
        '<button type="button" class="hs-action-item hs-action-danger" role="menuitem" data-row-action="archive" data-id="'+esc(u.id)+'"><span aria-hidden="true">🗑️</span><span>4-Layer Purge</span></button>'+
      '</div></div>';
  }
  function closeActionMenus(except){
    document.querySelectorAll(".hs-action-menu:not([hidden])").forEach(menu=>{
      if(except&&menu===except)return;
      menu.hidden=true;
      menu.style.removeProperty("left");menu.style.removeProperty("top");menu.style.removeProperty("max-height");
      menu.style.removeProperty("display");menu.style.removeProperty("visibility");
      const toggle=menu.__actionToggle||menu.closest(".hs-action-cluster")?.querySelector("[data-menu-toggle]");
      if(toggle)toggle.setAttribute("aria-expanded","false");
      const placeholder=menu.__actionPlaceholder;
      if(placeholder?.parentNode){placeholder.parentNode.insertBefore(menu,placeholder);placeholder.remove();}
      menu.__actionPlaceholder=null;menu.__actionToggle=null;
    });
  }
  function openActionMenu(toggle,menu){
    closeActionMenus(menu);
    if(menu.parentNode){
      const placeholder=document.createComment("subscriber action menu");
      menu.parentNode.insertBefore(placeholder,menu);menu.__actionPlaceholder=placeholder;
    }
    menu.__actionToggle=toggle;
    const portal=toggle.closest(".fresh-hs-workspace")||document.body;
    portal.appendChild(menu);
    menu.hidden=false;menu.style.position="fixed";menu.style.display="block";menu.style.visibility="hidden";
    menu.style.maxHeight="min(70vh, 420px)";
    let box=menu.getBoundingClientRect();const rect=toggle.getBoundingClientRect(),gap=8,pad=8;
    const available=Math.max(120,window.innerHeight-pad*2);
    if(box.height>available){menu.style.maxHeight="calc(100vh - 16px)";box=menu.getBoundingClientRect();}
    const below=window.innerHeight-rect.bottom-gap,above=rect.top-gap;
    const upward=box.height>below&&above>below;
    const top=upward?Math.max(pad,rect.top-box.height-gap):Math.min(rect.bottom+gap,window.innerHeight-box.height-pad);
    const left=Math.max(pad,Math.min(window.innerWidth-box.width-pad,rect.right-box.width));
    menu.style.left=left+"px";menu.style.top=top+"px";menu.style.visibility="visible";
    menu.dataset.placement=upward?"top":"bottom";toggle.setAttribute("aria-expanded","true");
  }
  async function copyMac(mac){
    try{
      if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(mac);
      else{
        const input=document.createElement("textarea");input.value=mac;input.setAttribute("readonly","");input.style.position="fixed";input.style.opacity="0";document.body.appendChild(input);input.select();
        const ok=document.execCommand("copy");input.remove();if(!ok)throw new Error("Clipboard access was denied.");
      }
      toast("MAC address copied.");
    }catch(error){toast(error.message||"Could not copy MAC address.",false);}
  }
  function renderList(){
    const host=$("#freshHotspotUserList"),q=($("#freshHotspotSearch")?.value||"").trim().toLowerCase();if(!host)return;
    stopLiveCountdown();closeActionMenus();
    const b={all:users,online:users.filter(u=>stateOf(u)==="online"),active:users.filter(u=>isValidPackage(u)),offline:users.filter(u=>stateOf(u)==="offline"&&isValidPackage(u)),expired:users.filter(u=>stateOf(u)==="expired")};
    const list=(b[selectedFilter]||users).filter(u=>[u.username,u.customer_name,u.phone,u.mac_address,u.macAddress,u.profile,u.ip,u.address].some(v=>String(v||"").toLowerCase().includes(q)));
    $("#freshHotspotCount").textContent=users.length+" Total Users";
    const tabs='<div class="hs-filter-tabs" role="group" aria-label="Filter Hotspot subscribers">'+[["all","All Users","count-all"],["online","Online","count-online"],["active","Active","count-active"],["offline","Offline","count-offline"],["expired","Expired","count-expired"]].map(([k,l,id])=>'<button type="button" class="hs-filter-tab hs-filter-'+k+(selectedFilter===k?" is-selected":"")+'" data-filter="'+k+'" aria-pressed="'+(selectedFilter===k)+'"><i class="hs-filter-dot" aria-hidden="true"></i>'+l+' <span id="'+id+'">'+b[k].length+'</span></button>').join("")+'</div>';
    const rows=list.map((u,i)=>{
      const s=stateOf(u),mac=String(u.mac_address||u.macAddress||u.username||"").trim(),ip=u.ip||u.address||"—";
      return '<tr class="hs-executive-row" data-user-id="'+esc(u.id)+'">'+
        '<td class="table-col-border"><span class="hs-serial">'+(i+1)+'</span></td>'+
        '<td class="table-col-border"><div class="hs-subscriber-identity"><button type="button" class="hs-subscriber-name hs-quick-edit" data-row-action="edit" data-id="'+esc(u.id)+'" aria-label="Edit subscriber '+esc(u.customer_name||u.name||u.username||"subscriber")+'">'+esc(u.customer_name||u.name||"Unnamed Subscriber")+'</button><div class="hs-subscriber-phone">'+esc(u.phone||"No phone")+'</div>'+copyMacButton(u)+'</div></td>'+
        '<td class="table-col-border"><span class="hs-package-pill hs-package-'+packageClass(u)+'">'+esc(packageLabel(u))+'</span></td>'+
        '<td class="table-col-border"><span class="hs-state hs-state-'+s+'">'+(s==="online"?"● ":"")+esc(statusLabel(u))+'</span></td>'+
        '<td class="table-col-border"><div class="hs-ip">'+esc(ip)+'</div><div class="hs-session"><span>↑ '+esc(bytesLabel(u.bytesIn))+'</span><span>↓ '+esc(bytesLabel(u.bytesOut))+'</span></div></td>'+
        '<td class="table-col-border"><div class="hs-expiry">'+esc(expiryLabel(u.expires_at))+'</div>'+remainTag(u)+'</td>'+
        '<td class="hs-actions-cell">'+actionButtons(u,"desktop")+'</td></tr>';
    }).join("");
    const cards=list.map((u,i)=>{
      const s=stateOf(u),ip=u.ip||u.address||"—",name=u.customer_name||u.name||"Unnamed Subscriber";
      return '<article class="hs-mobile-card mobile-sub-card" data-user-id="'+esc(u.id)+'">'+
        '<div class="hs-mobile-row-one"><span class="hs-serial">#'+(i+1)+'</span><button type="button" class="hs-subscriber-name hs-mobile-name" data-row-action="edit" data-id="'+esc(u.id)+'">'+esc(name)+'</button><span class="hs-package-pill hs-package-'+packageClass(u)+'">'+esc(packageLabel(u))+'</span><span class="hs-state hs-state-'+s+'">'+esc(statusLabel(u))+'</span></div>'+
        '<div class="hs-mobile-row-two"><span class="hs-subscriber-phone">'+esc(u.phone||"No phone")+'</span><span class="hs-mobile-separator" aria-hidden="true">·</span>'+copyMacButton(u)+'</div>'+
        '<div class="hs-mobile-footer"><div class="hs-mobile-traffic"><strong>'+esc(ip)+'</strong><span>↑ '+esc(bytesLabel(u.bytesIn))+' · ↓ '+esc(bytesLabel(u.bytesOut))+'</span></div><div class="hs-mobile-expiry">'+remainTag(u)+'</div></div>'+'<div class="hs-mobile-actions">'+actionButtons(u,"mobile")+'</div>'+
      '</article>';
    }).join("");
    host.innerHTML=tabs+
      '<div class="hs-desktop-table-wrap"><table class="modern-sub-table hs-executive-table"><thead><tr class="hotspot-table-header">'+
        '<th class="table-col-border">#</th><th class="table-col-border">SUBSCRIBER &amp; DEVICE</th><th class="table-col-border">PACKAGE</th><th class="table-col-border">STATUS</th><th class="table-col-border">IP &amp; LIVE TRAFFIC</th><th class="table-col-border">EXPIRATION &amp; COUNTDOWN</th><th>ACTIONS</th>'+
      '</tr></thead><tbody>'+(rows||'<tr><td colspan="7" class="hs-empty-row">No subscribers in this filter.</td></tr>')+'</tbody></table></div>'+
      '<div class="hs-mobile-cards mobile-subscribers-list">'+(cards||'<div class="hs-empty-row">No subscribers in this filter.</div>')+'</div>';
    host.querySelectorAll("[data-filter]").forEach(x=>x.addEventListener("click",()=>{selectedFilter=x.dataset.filter||"all";renderList();}));
    host.querySelectorAll("[data-open-user]").forEach(x=>x.addEventListener("click",e=>{e.stopPropagation();selectUser(x.dataset.openUser,true);}));
    host.querySelectorAll("[data-copy-mac]").forEach(x=>x.addEventListener("click",e=>{e.preventDefault();e.stopPropagation();copyMac(x.dataset.copyMac||"");}));
    host.querySelectorAll("[data-menu-toggle]").forEach(toggle=>toggle.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();const menu=toggle.closest(".hs-action-cluster")?.querySelector(".hs-action-menu");if(!menu)return;
      if(!menu.hidden){closeActionMenus();return;}openActionMenu(toggle,menu);
    }));
    host.querySelectorAll("[data-row-action]").forEach(button=>button.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();const user=users.find(v=>String(v.id)===String(button.dataset.id));if(!user)return;
      selected=user;renderDetail();closeActionMenus();runRowAction(button.dataset.rowAction,user);
    }));
    host.querySelectorAll(".hs-executive-row").forEach(row=>row.addEventListener("click",()=>selectUser(row.dataset.userId,false)));
    startLiveCountdown();
  }
  function detailsMarkup(user){if(!user)return '<div class="fresh-hs-empty fresh-hs-detail-empty">Select a subscriber</div>';const s=stateOf(user),item=(l,v)=>'<div class="fresh-hs-stat"><span>'+esc(l)+'</span><strong>'+esc(v||"Not set")+'</strong></div>';return '<div class="fresh-hs-detail-head"><div><div class="fresh-hs-eyebrow">SUBSCRIBER 360</div><h3>'+esc(user.customer_name||user.name||"Unnamed Subscriber")+'</h3><div>'+esc(user.username)+'</div></div><span class="hs-state hs-state-'+s+'">'+statusLabel(user)+'</span></div><div class="fresh-hs-stats">'+item("Mobile",user.phone)+item("MAC",user.mac_address||user.macAddress)+item("Package",packageLabel(user))+item("IP",user.ip||user.address)+item("Uptime",user.uptime)+item("Downloaded",bytesLabel(user.bytesOut))+item("Expiration",expiryLabel(user.expires_at))+item("Server",user.server)+item("Comment",user.comment)+'</div><div class="fresh-hs-actions"><button class="btn btn-success" data-action="renew">🔄 Renew</button><button class="btn btn-outline-success" data-action="edit">✏️ Edit</button><button class="btn btn-outline-warning" data-action="disconnect" '+(s==="online"&&user.sessionId?"":"disabled")+'>🚫 Disconnect</button><button class="btn btn-outline-danger" data-action="archive">🗑️ Delete / Archive</button></div>';}
  function renderDetail(){const d=$("#freshHotspotDetail");if(d)d.innerHTML=detailsMarkup(selected);const m=$("#freshHotspotMobileBody");if(m)m.innerHTML=detailsMarkup(selected)+'<button type="button" class="btn btn-dark w-100 mt-3" data-bs-dismiss="modal">✕ Close</button>';[d,m].filter(Boolean).forEach(root=>root.querySelectorAll("[data-action]").forEach(x=>x.addEventListener("click",()=>{if(selected)runRowAction(x.dataset.action,selected);})));}
  async function resetMacBinding(user){
    if(!user)return;
    if(!window.confirm("Reset the MAC lock for this subscriber? The saved MAC address will remain in the audit/profile record."))return;
    try{
      const response=await fetch(endpoint(user.id)+"/profile",{method:"PUT",headers:{"Content-Type":"application/json",Accept:"application/json"},body:JSON.stringify({customer_name:user.customer_name||user.name||user.username||"",phone:user.phone||"",mac_address:"",note:user.note||"",mac_lock:false}),cache:"no-store"});
      let data={};try{data=await response.json();}catch(_){}
      if(!response.ok||data.success!==true)throw new Error(data.message||data.error||"MAC lock reset failed.");
      toast("MAC lock reset. The saved MAC address was retained.");await loadUsers(user.id);
    }catch(error){toast(error.message||"MAC lock reset failed.",false);}
  }
  async function runRowAction(action,user){
    selected=user||selected;if(!selected)return;
    if(action==="edit"){if(typeof window.openEditModal==="function"){window.openEditModal(selected.id,selected);return;}openEdit();return;}
    if(action==="renew"){if(typeof window.openRenewModal==="function"){window.openRenewModal(selected.id,selected);return;}openRenew();return;}
    if(action==="archive"){if(typeof window.openDeleteConfirmationModal==="function"){window.openDeleteConfirmationModal(selected.id,selected);return;}await archiveUser();return;}
    if(action==="unbind"){await resetMacBinding(selected);return;}
    if(action==="disconnect"){
      if(typeof window.disconnectSubscriber==="function"){await window.disconnectSubscriber(selected.id,selected);return;}
      if(!selected.sessionId){toast("No active MikroTik session ID is available.",false);return;}
      if(!window.confirm("Disconnect this active Hotspot session?"))return;
      try{await request("/api/hotspot/active/disconnect",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:selected.sessionId})});toast("Active session disconnected.");await loadUsers(selected.id);}
      catch(error){toast(error.message||"Disconnect failed.",false);}
    }
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
    select.innerHTML = '<option value="">Choose a package…</option>' + profiles.map(profile => '<option value="'+esc(profile.profile_id||profile.name)+'" data-name="'+esc(profile.name)+'" data-price="'+esc(profile.price||0)+'" data-validity-value="'+esc(profile.validityValue??0)+'" data-unit="'+esc(profile.validityUnit||"")+'" data-limit-bytes-total="'+esc(profile.limitBytesTotal||profile.limit_bytes_total||0)+'" data-data-only="'+String(profile.dataOnly===true||profile.data_only===true)+'">'+esc(profile.name)+' · ৳'+Number(profile.price||0).toFixed(2)+'</option>').join("");
    select.value = selected.profile_id || "";
    $("#freshRenewNotify").checked = true; $("#freshRenewResult").textContent = "";
    updateRenewPreview(); modalShow("freshRenewModal");
  }
  function unitMs(value, unit) {
    const n = Number(value); if (!Number.isFinite(n) || n <= 0) return 0;
    unit = String(unit || "").trim().toLowerCase();
    if (["gb", "data", "quota"].includes(unit)) return 0;
    const factors = { seconds:1000, second:1000, s:1000, minutes:60000, minute:60000, mins:60000, min:60000, m:60000, hours:3600000, hour:3600000, hrs:3600000, hr:3600000, h:3600000, days:86400000, day:86400000, d:86400000, weeks:604800000, week:604800000, w:604800000, months:2592000000, month:2592000000, mo:2592000000 };
    const factor = factors[unit];
    return factor ? n * factor : 0;
  }
  function updateRenewPreview() {
    const option = $("#freshRenewProfile")?.selectedOptions?.[0];
    $("#freshRenewPrice").textContent = option?.value ? "৳"+Number(option.dataset.price||0).toFixed(2) : "৳0.00";
    const unit = String(option?.dataset.unit||"").trim().toLowerCase();
    const quota = Number(option?.dataset.limitBytesTotal||0);
    const dataOnly = Boolean(option?.value && (option.dataset.dataOnly==="true" || ["gb","data","quota"].includes(unit) || (!unit && quota>0)));
    const duration = option?.value && !dataOnly ? unitMs(option.dataset.validityValue,unit) : 0;
    const now = new Date();
    $("#freshRenewExpiry").textContent = option?.value ? (dataOnly ? "No Expiry Limit (Data Quota)" : duration ? expiryLabel(new Date(now.getTime()+duration)) : "Validity unavailable") : "Choose package";
  }
  async function submitRenew(event) {
    event.preventDefault();
    if (!selected) return;
    const button = $("#freshRenewSubmit"), result = $("#freshRenewResult");
    button.disabled = true; result.className = "small mt-3 text-muted"; result.textContent = "Saving renewal…";
    try {
      const option=$("#freshRenewProfile")?.selectedOptions?.[0];
      if(!option?.value)throw new Error("Select a Hotspot package first.");
      const validityUnit=String(option.dataset.unit||"").trim().toLowerCase();
      const limitBytesTotal=Math.max(0,Number(option.dataset.limitBytesTotal||0));
      let validityValue=Number(option.dataset.validityValue||0);
      if(["gb","data","quota"].includes(validityUnit)&&validityValue<=0&&limitBytesTotal>0&&limitBytesTotal%1073741824===0)validityValue=limitBytesTotal/1073741824;
      const voucherIdRaw=selected.voucher_id??selected.id;
      const voucherId=String(voucherIdRaw??"").trim();
      if(!/^\d+$/.test(voucherId))throw new Error("Subscriber voucher ID is missing or invalid.");
      // The API calculates the canonical expiry from profile metadata; do not send a client-estimated expiry timestamp.
      const payload={voucherId,id:voucherId,username:selected.username||selected.mac_address||selected.macAddress||"",mac:selected.mac_address||selected.macAddress||"",profile_id:option.value,profile:option.dataset.name||"",validityValue,validityUnit,limitBytesTotal,send_notification:$("#freshRenewNotify").checked};
      const data = await request("/api/hotspot/manual-renew", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
      result.className = "small mt-3 text-success fw-semibold"; result.textContent = "Renewal saved.";
      toast("Renewal saved and synchronized with RouterOS.");
      modalHide("freshRenewModal"); await loadUsers(selected.id);
    } catch (error) { result.className = "small mt-3 text-danger"; result.textContent = error.message || "Renewal failed."; }
    finally { button.disabled = false; }
  }
  async function archiveUser() {
    if (!selected || !window.confirm("Permanently revoke this subscriber's network access? The RouterOS active session, cookie, host and user will be purged. Financial history and the previous MAC audit trail will be retained.")) return;
    const runDeletion = () => request(endpoint(selected.id), {method:"DELETE"});
    try {
      await runDeletion();
      toast("Network access purged. Voucher, payment ledger, transactions and MAC audit history were retained.");
      await loadUsers(null);
    } catch (error) {
      const message = error.message || "Hotspot deletion failed. Database status was not changed.";
      toast(message + " You can retry after checking the router connection.", false);
      if (window.confirm(message + "\n\nRetry the verified RouterOS purge now? No financial records will be deleted.")) {
        try {
          await runDeletion();
          toast("Network access purged and voucher soft-deleted. Financial history retained.");
          await loadUsers(null);
        } catch (retryError) {
          toast((retryError.message || "Retry failed.") + " Subscriber and financial records remain available for another retry.", false);
        }
      }
    }
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
      $("#freshHotspotCount").textContent = users.length + " Total Users";
    } catch (error) {
      if (host) host.innerHTML = '<div class="fresh-hs-empty text-danger">'+esc(error.message || "Unable to load subscribers.")+'</div>';
      const detail = $("#freshHotspotDetail"); if (detail) detail.innerHTML = '<div class="alert alert-danger">'+esc(error.message || "Unable to load subscribers.")+'</div>';
    } finally { loading = false; }
  }
  function workspaceMarkup(){return `<section id="freshHotspotWorkspace" class="hotspot-dynamic-view admin-view fresh-hs-workspace"><div class="fresh-hs-title-row"><div class="fresh-hs-title-copy"><h2>Hotspot Subscribers</h2><p>Manage active sessions, plans, and renewals</p></div><div class="hs-header-actions"><span id="freshHotspotCount" class="hs-total-badge">Loading…</span><div class="hs-header-buttons"><button type="button" id="freshHotspotRefresh" class="btn hs-utility-btn" title="Refresh subscribers"><i class="bi bi-arrow-clockwise" aria-hidden="true"></i><span>Refresh</span></button><button type="button" id="freshHotspotSync" class="btn hs-utility-btn" title="Import subscribers from MikroTik into the panel"><i class="bi bi-arrow-repeat" aria-hidden="true"></i><span>Sync with MikroTik</span></button><button type="button" id="freshHotspotPanelSync" class="btn hs-utility-btn" title="Add or update panel subscribers on MikroTik"><i class="bi bi-cloud-upload" aria-hidden="true"></i><span>Sync from Panel</span></button><button type="button" id="freshHotspotExport" class="btn hs-utility-btn" title="Export filtered subscribers"><i class="bi bi-file-earmark-spreadsheet" aria-hidden="true"></i><span>Export CSV</span></button></div></div></div><div class="fresh-hs-list-panel"><div class="hs-main-toolbar"><input id="freshHotspotSearch" class="form-control" type="search" placeholder="Search name, phone, MAC, IP…" aria-label="Search Hotspot subscribers"></div><div id="freshHotspotUserList"><div class="fresh-hs-empty">Loading subscribers…</div></div></div></section>` + '<div class="modal fade fresh-hs-mobile-modal" id="freshSubscriberMobileModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-scrollable modal-fullscreen-sm-down"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">Subscriber 360</h5><button type="button" class="btn btn-dark btn-lg" data-bs-dismiss="modal">✕ Close</button></div><div class="modal-body" id="freshHotspotMobileBody"></div></div></div></div><div class="modal fade hs-edit-modal" id="freshEditProfileModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content"><form id="freshEditProfileForm"><div class="modal-header"><div><span class="fresh-hs-eyebrow">SUBSCRIBER MANAGEMENT</span><h5 class="modal-title">Edit Subscriber Profile</h5><p class="small text-muted mb-0">Update customer identity and device access preferences.</p></div><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div><div class="modal-body"><div class="hs-edit-grid"><label class="hs-edit-field">Customer Name <span class="text-danger">*</span><input class="form-control" name="customer_name" maxlength="160" autocomplete="name" required></label><label class="hs-edit-field">Mobile Number<input class="form-control" name="phone" inputmode="tel" autocomplete="tel" maxlength="20"></label><label class="hs-edit-field">MAC Address<input class="form-control" name="mac_address" maxlength="32" spellcheck="false" placeholder="AA:BB:CC:DD:EE:FF"></label><label class="hs-edit-field hs-edit-full">Notes<textarea class="form-control" name="note" rows="3" maxlength="1000" placeholder="Optional customer notes"></textarea></label></div><div class="hs-edit-security"><label class="form-check"><input class="form-check-input" type="checkbox" name="mac_lock"><span class="form-check-label fw-semibold">Enforce MAC lock</span></label><p class="small mb-0 text-muted">Changing device binding may affect the subscriber’s next login. Confirm the MAC address before saving.</p></div><div id="freshEditProfileResult" class="small mt-3" role="status" aria-live="polite"></div></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-success"><i class="bi bi-check2-circle" aria-hidden="true"></i> Save Changes</button></div></form></div></div></div><div class="modal fade" id="freshRenewModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content"><form id="freshRenewForm"><div class="modal-header"><h5 class="modal-title">Quick Renew</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close">✕</button></div><div class="modal-body"><label class="form-label">Package<select id="freshRenewProfile" class="form-select" required><option value="">Loading packages…</option></select></label><div class="fresh-hs-renew-summary"><div><span>Price</span><strong id="freshRenewPrice">৳0.00</strong></div><div><span>Estimated new expiry</span><strong id="freshRenewExpiry">Choose package</strong></div></div><label class="form-check mt-3"><input class="form-check-input" id="freshRenewNotify" type="checkbox" checked><span class="form-check-label">Send SMS / WhatsApp notification</span></label><div id="freshRenewResult" class="small mt-3" role="status" aria-live="polite"></div></div><div class="modal-footer"><button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancel</button><button id="freshRenewSubmit" type="submit" class="btn btn-success">Confirm Renewal</button></div></form></div></div></div>';}
  function exportCsv() {
    const q=($("#freshHotspotSearch")?.value||"").trim().toLowerCase();
    const filtered=users.filter(u=>(selectedFilter==="all"||selectedFilter==="online"&&stateOf(u)==="online"||selectedFilter==="active"&&isValidPackage(u)||selectedFilter==="offline"&&stateOf(u)==="offline"&&isValidPackage(u)||selectedFilter==="expired"&&stateOf(u)==="expired")&&[u.username,u.customer_name,u.phone,u.mac_address,u.macAddress,u.profile,u.ip,u.address].some(v=>String(v||"").toLowerCase().includes(q)));
    const safe=v=>{let s=String(v??"");if(/^[\t\r\n ]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const columns=["Name","Username","Phone","MAC","Package","Status","IP","Expiration"];
    const data=filtered.map(u=>[u.customer_name||u.name,u.username,u.phone,u.mac_address||u.macAddress,packageLabel(u),statusLabel(u),u.ip||u.address,expiryLabel(u.expires_at)]);
    const csv="\uFEFF"+[columns,...data].map(row=>row.map(safe).join(",")).join("\r\n");
    const url=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    const a=document.createElement("a");a.href=url;a.download="faz-hotspot-users-"+selectedFilter+".csv";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function mount() {
    const dynamic = $("#dynamicPageContent");
    if (!dynamic) return;
    const old = dynamic.querySelector(".hotspot-dynamic-view");
    if (old) old.outerHTML = workspaceMarkup();
    else dynamic.insertAdjacentHTML("beforeend", workspaceMarkup());
    $("#freshHotspotSearch")?.addEventListener("input", renderList);
    $("#freshHotspotRefresh")?.addEventListener("click", () => loadUsers(selected?.id));
    $("#freshHotspotSync")?.addEventListener("click", () => { const source=$("#btnImportFromMikrotik"); if(source && !source.disabled) source.click(); else toast("MikroTik import is unavailable.",false); });
    $("#freshHotspotPanelSync")?.addEventListener("click", async event => {
      const button=event.currentTarget;
      if(!button||button.disabled)return;
      if(!window.confirm("Add missing panel subscribers and update matching MikroTik Hotspot users? Only active, unused, valid MAC-bound panel subscribers are synced."))return;
      const previous=button.innerHTML;
      button.disabled=true;
      button.innerHTML='<span class="spinner-border spinner-border-sm" aria-hidden="true"></span><span>Syncing…</span>';
      try{
        const result=await request("/api/hotspot/sync/push-to-mikrotik",{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({})});
        toast("Panel sync complete: "+Number(result.provisioned||0)+" added, "+Number(result.refreshed||0)+" updated, "+Number(result.skipped||0)+" skipped, "+Number(result.disconnected||0)+" expired sessions disconnected.");
        await loadUsers(selected?.id);
      }catch(error){toast(error.message||"Panel-to-MikroTik sync failed.",false);}
      finally{button.disabled=false;button.innerHTML=previous;}
    });
    $("#freshHotspotExport")?.addEventListener("click", exportCsv);
    if(!countdownVisibilityBound){document.addEventListener("visibilitychange",handleCountdownVisibility);countdownVisibilityBound=true;}
    document.addEventListener("click",event=>{if(!event.target.closest(".hs-action-cluster")&&!event.target.closest(".hs-action-menu"))closeActionMenus();});
    document.addEventListener("keydown",event=>{if(event.key==="Escape"){const open=document.querySelector(".hs-action-menu:not([hidden])");const toggle=open?.closest(".hs-action-cluster")?.querySelector("[data-menu-toggle]");closeActionMenus();toggle?.focus();}});
    window.addEventListener("resize",()=>closeActionMenus());
    window.addEventListener("scroll",()=>closeActionMenus(),true);
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
