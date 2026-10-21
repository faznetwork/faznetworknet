(() => {
  // Route dashboard KPI clicks to the existing admin-panel view handlers.
  // Resolve handlers at click time because admin.ejs registers them after this file.
  window.openHotspotKpiUsers = async function (status) {
    if (status === 'all' || status === 'active') {
      const titleKey = status === 'active' ? 'active_user' : 'all_user';
      if (typeof window.loadHotspotSection === 'function') {
        return window.loadHotspotSection(status, titleKey);
      }
      const menuLink = document.querySelector(
        status === 'active'
          ? '[onclick*="loadHotspotSection(\'active\'"][onclick*="active_user"]'
          : '[onclick*="loadHotspotSection(\'all\'"][onclick*="all_user"]'
      );
      if (menuLink) { menuLink.click(); return true; }
      return false;
    }
    if (typeof window.loadHotspotVoucherRecords === 'function') {
      return window.loadHotspotVoucherRecords('cleanup', 'Expired & Cleanup');
    }
    const cleanupLink = document.querySelector('[onclick*="loadHotspotVoucherRecords(\'cleanup\'"]');
    if (cleanupLink) { cleanupLink.click(); return true; }
    return false;
  };

  // Enforce exclusive visibility for the two dashboard sections. The admin
  // router handles other pages; this helper prevents dashboard overlap.
  window.switchDashboardView = function (targetViewId) {
    document.querySelectorAll(".dashboard-view").forEach((view) => {
      view.classList.add("hidden");
      view.style.display = "none";
      view.setAttribute("aria-hidden", "true");
    });

    const target = targetViewId ? document.getElementById(targetViewId) : null;
    if (target && target.classList.contains("dashboard-view")) {
      target.classList.remove("hidden");
      target.style.display = "block";
      target.setAttribute("aria-hidden", "false");
      return true;
    }
    return false;
  };

  const clock = document.getElementById("current-time");
  const statusBadge = document.getElementById("router-status");
  const interfaceSelect = document.getElementById("interface-select");
  const chartCanvas = document.getElementById("traffic-chart");
  const cpuValue = document.getElementById("cpu-value");
  const cpuBar = document.getElementById("cpu-bar");
  const memoryValue = document.getElementById("memory-value");
  const memoryBar = document.getElementById("memory-bar");
  const uptimeValue = document.getElementById("uptime-value");
  const testButton = document.getElementById("test-router-btn");
  const testResult = document.getElementById("router-test-result");

  const updateClock = () => {
    if (clock) {
      clock.textContent = window.FazDate ? window.FazDate.formatDateTime(new Date()) : new Date().toISOString();
    }
  };
  updateClock();
  setInterval(updateClock, 1000);

  const setStatus = (connected) => {
    if (!statusBadge) return;
    statusBadge.textContent = connected ? "Connected" : "Disconnected";
    statusBadge.className = connected
      ? "inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 text-xs font-bold"
      : "inline-flex items-center gap-2 rounded-full bg-red-50 text-red-700 px-3 py-1.5 text-xs font-bold";
    statusBadge.insertAdjacentHTML("afterbegin", '<span class="h-2 w-2 rounded-full ' + (connected ? "bg-emerald-500" : "bg-red-500") + '"></span>');
  };

  const setGauge = (valueElement, barElement, value, suffix = "%") => {
    const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
    if (valueElement) valueElement.textContent = numeric.toFixed(1) + suffix;
    if (barElement) barElement.style.width = Math.max(0, Math.min(100, numeric)) + "%";
  };

  let chart;
  if (chartCanvas && window.Chart) {
    chart = new Chart(chartCanvas, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          { label: "Download (RX)", data: [], borderWidth: 2, tension: 0.35, pointRadius: 0 },
          { label: "Upload (TX)", data: [], borderWidth: 2, tension: 0.35, pointRadius: 0 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: { display: true, ticks: { maxTicksLimit: 8 } },
          y: { beginAtZero: true, title: { display: true, text: "Mbps" } }
        }
      }
    });
  }

  const apiJson = async (url) => {
    const response = await fetch(url, { headers: { Accept: "application/json" }, cache: "no-store" });
    let data;
    try { data = await response.json(); } catch (_) { throw new Error("Invalid server response."); }
    if (!response.ok || data.success === false) throw new Error(data.error || "Router request failed.");
    return data;
  };

  const loadInterfaces = async () => {
    if (!interfaceSelect) return;
    try {
      const data = await apiJson("/api/router/interfaces");
      const current = interfaceSelect.value;
      interfaceSelect.innerHTML = '<option value="">Select an interface</option>';
      data.interfaces.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.name;
        option.textContent = item.name + " (" + item.type + (item.running ? ", running" : "") + ")";
        interfaceSelect.appendChild(option);
      });
      if (current && [...interfaceSelect.options].some((option) => option.value === current)) {
        interfaceSelect.value = current;
      } else if (data.interfaces.length) {
        interfaceSelect.value = data.interfaces.find((item) => item.running && !item.disabled)?.name || data.interfaces[0].name;
      }
    } catch (_) {
      setStatus(false);
    }
  };

  const loadResources = async () => {
    try {
      const data = await apiJson("/api/router/resources");
      const r = data.resources;
      setGauge(cpuValue, cpuBar, r.cpuLoad);
      setGauge(memoryValue, memoryBar, r.memoryUsagePercent);
      if (uptimeValue) uptimeValue.textContent = r.uptime || "unknown";
      setStatus(true);
    } catch (_) {
      setStatus(false);
    }
  };

  const loadTraffic = async () => {
    if (!chart || !interfaceSelect || !interfaceSelect.value) return;
    try {
      const data = await apiJson("/api/router/traffic?interface=" + encodeURIComponent(interfaceSelect.value));
      const t = data.traffic;
      const now = new Date().toLocaleTimeString([], { minute: "2-digit", second: "2-digit" });
      chart.data.labels.push(now);
      chart.data.datasets[0].data.push(t.rxMbps);
      chart.data.datasets[1].data.push(t.txMbps);
      const maxPoints = 30;
      if (chart.data.labels.length > maxPoints) {
        chart.data.labels.shift();
        chart.data.datasets.forEach((dataset) => dataset.data.shift());
      }
      chart.update("none");
      setStatus(true);
    } catch (_) {
      setStatus(false);
    }
  };

  if (interfaceSelect) {
    interfaceSelect.addEventListener("change", () => {
      if (!chart) return;
      chart.data.labels = [];
      chart.data.datasets.forEach((dataset) => { dataset.data = []; });
      chart.update("none");
      loadTraffic();
    });
  }

  if (testButton) {
    testButton.addEventListener("click", async () => {
      testButton.disabled = true;
      testButton.textContent = "Testing...";
      if (testResult) {
        testResult.textContent = "Connecting to MikroTik...";
        testResult.className = "text-sm text-slate-500";
      }
      try {
        const data = await apiJson("/api/router/test");
        if (testResult) {
          testResult.textContent = "Connected to " + data.routerName + " (RouterOS " + data.version + ")";
          testResult.className = "text-sm font-semibold text-emerald-600";
        }
      } catch (error) {
        if (testResult) {
          testResult.textContent = error.message;
          testResult.className = "text-sm font-semibold text-red-600";
        }
      } finally {
        testButton.disabled = false;
        testButton.textContent = "Test Connection";
      }
    });
  }

  const isDashboard = Boolean(interfaceSelect || chartCanvas);
  if (isDashboard) {
    loadInterfaces();
    loadResources();
    loadTraffic();
    setInterval(loadResources, 2500);
    setInterval(loadTraffic, 2500);
  }
})();


(() => {
  const syncBtn = document.getElementById("pppoe-sync-btn");
  const syncResult = document.getElementById("pppoe-sync-result");
  const usersBody = document.getElementById("pppoe-users-body");
  const activeBody = document.getElementById("pppoe-active-body");
  const profilesBody = document.getElementById("pppoe-profiles-body");
  const userCount = document.getElementById("pppoe-user-count");
  const profileCount = document.getElementById("pppoe-profile-count");
  const onlineCount = document.getElementById("pppoe-online-count");
  const userModal = document.getElementById("pppoe-user-modal");
  const profileModal = document.getElementById("pppoe-profile-modal");
  const userForm = document.getElementById("pppoe-user-form");
  const profileForm = document.getElementById("pppoe-profile-form");
  const userProfile = document.getElementById("user-profile");
  const editingInput = document.getElementById("user-editing");
  const userModalTitle = document.getElementById("user-modal-title");
  let users = [];
  let profiles = [];
  let activeSessions = [];

  if (!syncBtn && !usersBody) return;

  const pppoeApi = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(options.headers || {}) },
      cache: "no-store"
    });
    let data;
    try { data = await response.json(); } catch (_) { throw new Error("Invalid server response."); }
    if (!response.ok || data.success === false) throw new Error(data.error || "PPPoE request failed.");
    return data;
  };

  const esc = (value) => {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  };

  const showResult = (message, ok = true) => {
    if (!syncResult) return;
    syncResult.className = "rounded-xl px-4 py-3 text-sm font-semibold " + (ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700");
    syncResult.textContent = message;
    syncResult.classList.remove("hidden");
  };

  const openModal = (modal) => modal && modal.classList.remove("hidden");
  const closeModal = (modal) => modal && modal.classList.add("hidden");

  const loadProfiles = async () => {
    const data = await pppoeApi("/api/pppoe/profiles");
    profiles = data.profiles || [];
    if (profileCount) profileCount.textContent = profiles.length;
    if (profilesBody) {
      profilesBody.innerHTML = profiles.length ? profiles.map((p) =>
        "<tr><td class='font-bold'>" + esc(p.name) + "</td><td>" + esc(p.rate_limit || "—") +
        "</td><td>" + esc(p.local_address || "—") + "</td><td>" + esc(p.remote_address || "—") +
        "</td><td>" + esc(p.session_timeout || "—") + "</td><td>" + esc(p.comment || "—") + "</td></tr>"
      ).join("") : "<tr><td colspan='6' class='empty-cell'>No PPPoE profiles found.</td></tr>";
    }
    if (userProfile) {
      const current = userProfile.value;
      userProfile.innerHTML = "<option value=''>Select profile...</option>" + profiles.map((p) =>
        "<option value='" + esc(p.name) + "'>" + esc(p.name) + (p.rate_limit ? " — " + esc(p.rate_limit) : "") + "</option>"
      ).join("");
      if (current) userProfile.value = current;
    }
  };

  const loadUsers = async () => {
    const data = await pppoeApi("/api/pppoe/users");
    users = data.users || [];
    if (userCount) userCount.textContent = users.length;
    renderUsers();
  };

  const renderUsers = () => {
    if (!usersBody) return;
    const normalizeSessionUsername = (value) => String(value ?? "").trim().toLowerCase();
    const online = new Set(activeSessions
      .map((s) => normalizeSessionUsername(s?.username || s?.name || s?.user))
      .filter(Boolean));
    usersBody.innerHTML = users.length ? users.map((u) => {
      const isOnline = online.has(normalizeSessionUsername(u.username));
      const status = u.disabled
        ? "<span class='status-badge status-disabled'>Disabled</span>"
        : "<span class='status-badge status-active'>Active</span>";
      const onlineBadge = isOnline ? " <span class='status-badge status-online'>Online</span>" : "";
      const toggleLabel = u.disabled ? "Enable" : "Disable";
      return "<tr>" +
        "<td class='font-bold whitespace-nowrap'>" + esc(u.username) + onlineBadge + "</td>" +
        "<td>" + esc(u.profile || "—") + "</td>" +
        "<td>" + status + "</td>" +
        "<td>" + esc(u.phone || "—") + "</td>" +
        "<td class='max-w-xs truncate' title='" + esc(u.comment || "") + "'>" + esc(u.comment || "—") + "</td>" +
        "<td><div class='flex justify-end gap-2'>" +
        "<button class='table-action' data-action='toggle' data-username='" + esc(u.username) + "' data-disabled='" + (!u.disabled) + "'>" + toggleLabel + "</button>" +
        "<button class='table-action' data-action='kick' data-username='" + esc(u.username) + "'>Kick</button>" +
        "<button class='table-action' data-action='edit' data-username='" + esc(u.username) + "'>Edit</button>" +
        "</div></td></tr>";
    }).join("") : "<tr><td colspan='6' class='empty-cell'>No PPPoE users in database. Click Sync from MikroTik.</td></tr>";
  };

  const loadActive = async () => {
    const data = await pppoeApi("/api/pppoe/active");
    activeSessions = data.sessions || [];
    if (onlineCount) onlineCount.textContent = activeSessions.length;
    if (activeBody) {
      activeBody.innerHTML = activeSessions.length ? activeSessions.map((s) =>
        "<tr><td class='font-bold'>" + esc(s.username) + "</td><td>" + esc(s.address || "—") +
        "</td><td>" + esc(s.uptime || "—") + "</td><td>" + esc(s.callerId || "—") +
        "</td><td>" + esc(s.sessionId || "—") + "</td><td class='text-right'><button class='table-action' data-active-kick='" + esc(s.username) + "'>Kick</button></td></tr>"
      ).join("") : "<tr><td colspan='6' class='empty-cell'>No active PPPoE sessions.</td></tr>";
    }
    renderUsers();
  };

  const sync = async (silent = false) => {
    if (syncBtn) { syncBtn.disabled = true; syncBtn.textContent = "⏳ Syncing..."; }
    try {
      const data = await pppoeApi("/api/pppoe/sync", { method: "POST", body: "{}" });
      await Promise.all([loadProfiles(), loadUsers(), loadActive()]);
      if (!silent) showResult("✓ " + data.message, true);
      return data;
    } catch (error) {
      if (!silent) showResult(error.message, false);
      throw error;
    } finally {
      if (syncBtn) { syncBtn.disabled = false; syncBtn.textContent = "🔄 Sync from MikroTik"; }
    }
  };

  const resetUserForm = () => {
    if (!userForm) return;
    userForm.reset();
    editingInput.value = "";
    document.getElementById("user-username").disabled = false;
    document.getElementById("user-modal-title").textContent = "Add New PPPoE User";
    document.getElementById("user-form-result").classList.add("hidden");
  };

  const editUser = (username) => {
    const u = users.find((item) => item.username === username);
    if (!u) return;
    editingInput.value = u.username;
    document.getElementById("user-username").value = u.username;
    document.getElementById("user-username").disabled = true;
    document.getElementById("user-password").value = "";
    document.getElementById("user-profile").value = u.profile || "";
    document.getElementById("user-caller-id").value = u.caller_id || "";
    document.getElementById("user-comment").value = u.comment || "";
    document.getElementById("user-disabled").checked = Boolean(u.disabled);
    userModalTitle.textContent = "Edit PPPoE User";
    openModal(userModal);
  };

  if (syncBtn) syncBtn.addEventListener("click", () => sync(false).catch(() => {}));
  document.getElementById("add-user-btn")?.addEventListener("click", () => { resetUserForm(); openModal(userModal); });
  document.getElementById("add-profile-btn")?.addEventListener("click", () => { profileForm?.reset(); openModal(profileModal); });

  document.querySelectorAll(".modal-close").forEach((button) => {
    button.addEventListener("click", () => closeModal(document.getElementById(button.dataset.modal)));
  });
  [userModal, profileModal].forEach((modal) => modal?.addEventListener("click", (event) => { if (event.target === modal) closeModal(modal); }));

  document.querySelectorAll(".pppoe-tab").forEach((tab) => tab.addEventListener("click", async () => {
    document.querySelectorAll(".pppoe-tab").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".pppoe-panel").forEach((panel) => panel.classList.add("hidden"));
    tab.classList.add("active");
    document.getElementById("pppoe-panel-" + tab.dataset.tab)?.classList.remove("hidden");
    if (tab.dataset.tab === "active") await loadActive().catch((e) => showResult(e.message, false));
    if (tab.dataset.tab === "profiles") await loadProfiles().catch((e) => showResult(e.message, false));
  }));

  usersBody?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const username = button.dataset.username;
    try {
      if (button.dataset.action === "edit") return editUser(username);
      if (button.dataset.action === "toggle") {
        await pppoeApi("/api/pppoe/toggle-user", { method: "POST", body: JSON.stringify({ username, disabled: button.dataset.disabled === "true" }) });
        await Promise.all([loadUsers(), loadActive()]);
        showResult("✓ " + username + " status updated.", true);
      }
      if (button.dataset.action === "kick") {
        if (!window.confirm("Kick " + username + " from the active PPPoE session?")) return;
        const data = await pppoeApi("/api/pppoe/kick-user", { method: "POST", body: JSON.stringify({ username }) });
        await loadActive();
        showResult("✓ " + (data.kicked ? username + " disconnected." : username + " is not online."), true);
      }
    } catch (error) { showResult(error.message, false); }
  });

  activeBody?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-active-kick]");
    if (!button) return;
    const username = button.dataset.activeKick;
    if (!window.confirm("Kick " + username + " now?")) return;
    try {
      const data = await pppoeApi("/api/pppoe/kick-user", { method: "POST", body: JSON.stringify({ username }) });
      await loadActive();
      showResult("✓ " + (data.kicked ? username + " disconnected." : username + " is no longer online."), true);
    } catch (error) { showResult(error.message, false); }
  });

  userForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const editing = editingInput.value;
    const password = document.getElementById("user-password").value;
    if (!editing && !password) return showResult("Password is required for a new user.", false);
    const resultBox = document.getElementById("user-form-result");
    resultBox.className = "md:col-span-2 text-sm font-semibold text-slate-500";
    resultBox.textContent = "Saving to MikroTik...";
    resultBox.classList.remove("hidden");
    const payload = {
      username: editing || document.getElementById("user-username").value.trim(),
      password,
      profile: userProfile.value,
      callerId: document.getElementById("user-caller-id").value.trim(),
      comment: document.getElementById("user-comment").value.trim(),
      disabled: document.getElementById("user-disabled").checked
    };
    try {
      const url = editing ? "/api/pppoe/update-user" : "/api/pppoe/create-user";
      await pppoeApi(url, { method: "POST", body: JSON.stringify(payload) });
      closeModal(userModal);
      await Promise.all([loadProfiles(), loadUsers(), loadActive()]);
      showResult("✓ PPPoE user " + (editing ? "updated" : "created") + " and synchronized.", true);
    } catch (error) {
      resultBox.className = "md:col-span-2 text-sm font-semibold text-red-600";
      resultBox.textContent = error.message;
    }
  });

  profileForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const resultBox = document.getElementById("profile-form-result");
    resultBox.className = "md:col-span-2 text-sm font-semibold text-slate-500";
    resultBox.textContent = "Creating on MikroTik...";
    resultBox.classList.remove("hidden");
    const payload = {
      name: document.getElementById("profile-name").value.trim(),
      rateLimit: document.getElementById("profile-rate-limit").value.trim(),
      localAddress: document.getElementById("profile-local-address").value.trim(),
      remoteAddress: document.getElementById("profile-remote-address").value.trim(),
      sessionTimeout: document.getElementById("profile-session-timeout").value.trim(),
      idleTimeout: document.getElementById("profile-idle-timeout").value.trim(),
      comment: document.getElementById("profile-comment").value.trim(),
      onlyOne: document.getElementById("profile-only-one").checked,
      changeTcpMss: document.getElementById("profile-change-mss").checked
    };
    try {
      await pppoeApi("/api/pppoe/create-profile", { method: "POST", body: JSON.stringify(payload) });
      closeModal(profileModal);
      await Promise.all([loadProfiles(), loadUsers()]);
      showResult("✓ Profile created on MikroTik and synchronized.", true);
    } catch (error) {
      resultBox.className = "md:col-span-2 text-sm font-semibold text-red-600";
      resultBox.textContent = error.message;
    }
  });

  sync(true).catch((error) => {
    showResult("Initial MikroTik sync failed: " + error.message, false);
    Promise.allSettled([loadProfiles(), loadUsers(), loadActive()]);
  });
  setInterval(() => loadActive().catch(() => {}), 5000);
})();


(() => {
  const txBody=document.getElementById("transactions-body");
  const voucherBody=document.getElementById("vouchers-body");
  if(txBody){
    let txs=[],users=[];
    const api=async(url,opt={})=>{const res=await fetch(url,{...opt,headers:{"Content-Type":"application/json",Accept:"application/json"}});const d=await res.json();if(!res.ok||d.success===false)throw new Error(d.error||"Request failed.");return d;};
    const esc=v=>{const d=document.createElement("div");d.textContent=v==null?"":String(v);return d.innerHTML;};
    const load=async()=>{const [t,u]=await Promise.all([api("/api/payments/transactions"),api("/api/pppoe/users")]);txs=t.transactions||[];users=u.users||[];document.getElementById("unmatched-count").textContent=txs.filter(x=>x.status==="unmatched").length;const s=await api("/api/payments/summary");document.getElementById("today-collection").textContent="৳"+Number(s.summary.today_collection||0).toLocaleString(undefined,{minimumFractionDigits:2});document.getElementById("processed-count").textContent=s.summary.processed_today||0;txBody.innerHTML=txs.length?txs.map(x=>"<tr><td class='font-bold'>"+esc(x.channel.toUpperCase())+"</td><td>"+esc(x.trx_id)+"</td><td>"+esc(x.sender_phone||"—")+"</td><td>৳"+Number(x.amount).toFixed(2)+"</td><td><span class='status-badge "+(x.status==="processed"?"status-active":x.status==="unmatched"?"status-disabled":"status-online")+"'>"+esc(x.status)+"</span></td><td>"+esc(x.matched_username||"—")+"</td><td>"+(window.FazDate ? window.FazDate.formatDateTime(x.created_at) : x.created_at)+"</td><td>"+(x.status==="unmatched"?"<button class='table-action' data-match='"+x.id+"'>Manual Match</button>":"—")+"</td></tr>").join(""):"<tr><td colspan='8' class='empty-cell'>No transactions yet.</td></tr>";};
    const modal=document.getElementById("match-modal");const select=document.getElementById("match-user");let matchId=null;
    txBody.addEventListener("click",e=>{const b=e.target.closest("[data-match]");if(!b)return;matchId=Number(b.dataset.match);const t=txs.find(x=>x.id===matchId);document.getElementById("match-info").textContent="Transaction "+t.trx_id+" • ৳"+Number(t.amount).toFixed(2)+" • "+(t.sender_phone||"No phone");select.innerHTML=users.map(u=>"<option value='"+esc(u.username)+"'>"+esc(u.username)+(u.phone?" — "+esc(u.phone):"")+"</option>").join("");modal.classList.remove("hidden");});
    document.querySelectorAll(".modal-close").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.modal).classList.add("hidden")));
    document.getElementById("match-submit").addEventListener("click",async()=>{try{await api("/api/payments/manual-match",{method:"POST",body:JSON.stringify({id:matchId,username:select.value})});modal.classList.add("hidden");await load();}catch(e){document.getElementById("match-result").textContent=e.message;document.getElementById("match-result").classList.remove("hidden");}});
    document.getElementById("payments-refresh").addEventListener("click",()=>load().catch(e=>alert(e.message)));load().catch(e=>{txBody.innerHTML="<tr><td colspan='8' class='empty-cell'>"+esc(e.message)+"</td></tr>";});
  }
  if(voucherBody){
    let vouchers=[];const api=async(url,opt={})=>{const res=await fetch(url,{...opt,headers:{"Content-Type":"application/json",Accept:"application/json"}});const d=await res.json();if(!res.ok||d.success===false)throw new Error(d.error||"Request failed.");return d;};
    const esc=v=>{const d=document.createElement("div");d.textContent=v==null?"":String(v);return d.innerHTML;};
    const load=async()=>{const d=await api("/api/hotspot/vouchers");vouchers=d.vouchers||[];voucherBody.innerHTML=vouchers.length?vouchers.map(v=>"<tr><td class='font-bold'>"+esc(v.username)+"</td><td>"+esc(v.password)+"</td><td>"+esc(v.profile)+"</td><td>"+esc(v.validity)+"</td><td>৳"+Number(v.price).toFixed(2)+"</td><td><span class='status-badge status-active'>"+esc(v.status)+"</span></td><td>"+(window.FazDate ? window.FazDate.formatDateTime(v.created_at) : v.created_at)+"</td></tr>").join(""):"<tr><td colspan='7' class='empty-cell'>No vouchers generated yet.</td></tr>";};
    const modal=document.getElementById("voucher-modal");document.getElementById("generate-voucher-btn").addEventListener("click",async()=>{try{const d=await api("/api/hotspot/profiles");document.getElementById("voucher-profile").innerHTML=d.profiles.map(p=>"<option value='"+esc(p.name)+"'>"+esc(p.name)+"</option>").join("");modal.classList.remove("hidden");}catch(e){alert(e.message);}});
    document.querySelectorAll(".modal-close").forEach(b=>b.addEventListener("click",()=>document.getElementById(b.dataset.modal).classList.add("hidden")));
    document.getElementById("voucher-form").addEventListener("submit",async e=>{e.preventDefault();const box=document.getElementById("voucher-form-result");box.textContent="Generating on MikroTik...";box.classList.remove("hidden");try{const d=await api("/api/hotspot/generate",{method:"POST",body:JSON.stringify({quantity:Number(document.getElementById("voucher-quantity").value),profile:document.getElementById("voucher-profile").value,validity:document.getElementById("voucher-validity").value,price:Number(document.getElementById("voucher-price").value)})});modal.classList.add("hidden");await load();document.getElementById("hotspot-result").textContent="✓ Generated "+d.count+" vouchers.";document.getElementById("hotspot-result").className="rounded-xl px-4 py-3 text-sm font-semibold bg-emerald-50 text-emerald-700";document.getElementById("hotspot-result").classList.remove("hidden");}catch(e){box.textContent=e.message;box.className="md:col-span-2 text-sm font-semibold text-red-600";}});
    document.getElementById("print-voucher-btn").addEventListener("click",async()=>{if(!vouchers.length)await load();const area=document.getElementById("print-area");area.innerHTML="<div class='print-header'>FAZ NETWORK<br><small>Wi-Fi Hotspot Voucher</small></div>"+vouchers.filter(v=>v.status==="unused").map(v=>"<div class='voucher-card'><h3>FAZ NETWORK</h3><p>Wi-Fi Name: " + (window.HOTSPOT_WIFI_NAME || "FAZ NETWORK") + "</p><strong>"+esc(v.username)+"</strong><span>Password: "+esc(v.password)+"</span><span>Validity: "+esc(v.validity)+"</span></div>").join("");window.print();});
    load().catch(e=>{voucherBody.innerHTML="<tr><td colspan='7' class='empty-cell'>"+esc(e.message)+"</td></tr>";});
  }
})();


(() => {
  const box=document.getElementById("dashboard-payments"), total=document.getElementById("today-collection-dashboard");
  if(!box)return;
  const load=async()=>{try{const d=await fetch("/api/payments/summary",{cache:"no-store"}).then(r=>r.json());if(!d.success)throw new Error(d.error);total.textContent="৳"+Number(d.summary.today_collection||0).toLocaleString(undefined,{minimumFractionDigits:2});box.innerHTML=(d.recent||[]).length?d.recent.map(x=>"<div class='flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-4 py-3'><div><p class='font-bold text-sm'>"+x.channel.toUpperCase()+" · "+x.trx_id+"</p><p class='text-xs text-slate-400'>"+(x.matched_username||x.sender_phone||"Unmatched")+"</p></div><div class='text-right'><p class='font-black'>৳"+Number(x.amount).toFixed(2)+"</p><p class='text-xs font-bold "+(x.status==="processed"?"text-emerald-600":"text-amber-600")+"'>"+x.status+"</p></div></div>").join(""):"<p class='text-sm text-slate-400'>No recent payments.</p>"}catch(e){box.innerHTML="<p class='text-sm text-red-500'>Unable to load payment summary.</p>";}};
  load();setInterval(load,15000);
})();


/* General Settings links delegate to the single admin SPA router in admin.ejs.
 * Do not maintain a second popstate router here: two independent history handlers
 * caused duplicate renders and settings requests on browser Back/Forward. */
(() => {
  if (window.__generalSettingsSidebarNavigationBound) return;
  window.__generalSettingsSidebarNavigationBound = true;

  const validTargets = new Set(['brand', 'billing', 'payments', 'sms', 'hotspot-portal']);

  document.addEventListener('click', (event) => {
    const link = event.target.closest('#sidebar [data-settings-nav]');
    if (!link) return;

    const target = link.dataset.settingsNav;
    // Unknown/future links retain normal browser navigation.
    if (!validTargets.has(target) || typeof window.__fazNavigateAdminRoute !== 'function') return;

    event.preventDefault();
    Promise.resolve(window.__fazNavigateAdminRoute({ view: 'settings', section: target }))
      .catch((error) => {
        console.error('[General Settings Navigation] Failed to open section:', error);
        if (typeof window.showToast === 'function') {
          window.showToast(error && error.message ? error.message : 'Unable to open settings section.', 'error');
        }
      });
  });
})();
