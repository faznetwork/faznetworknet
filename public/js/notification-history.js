(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const root = $("notificationHistoryPanel");
  if (!root || root.dataset.initialized === "1") return;
  root.dataset.initialized = "1";

  const state = { page: 1, total: 0, loading: false, loaded: false, debounce: null };
  const controls = {
    search: $("notificationHistorySearch"),
    channel: $("notificationHistoryChannel"),
    provider: $("notificationHistoryProvider"),
    status: $("notificationHistoryStatus"),
    refresh: $("notificationHistoryRefresh"),
    prev: $("notificationHistoryPrev"),
    next: $("notificationHistoryNext"),
    page: $("notificationHistoryPage"),
    body: $("notificationHistoryRows"),
    result: $("notificationHistoryResult"),
    total: $("notificationHistoryTotal")
  };
  const statusStyles = {
    pending: ["Pending", "text-bg-warning"],
    sent: ["Sent", "text-bg-success"],
    delivered: ["Delivered", "text-bg-primary"],
    failed: ["Failed", "text-bg-danger"],
    skipped: ["Skipped", "text-bg-secondary"]
  };
  function setResult(message, kind = "muted") {
    controls.result.className = "small mt-2 text-" + kind;
    controls.result.textContent = message || "";
  }
  function addCell(row, value, className = "") {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = value == null || value === "" ? "—" : String(value);
    row.appendChild(cell);
    return cell;
  }
  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  }
  function statusBadge(status) {
    const [label, style] = statusStyles[String(status || "").toLowerCase()] || ["Unknown", "text-bg-secondary"];
    const badge = document.createElement("span");
    badge.className = "badge " + style;
    badge.textContent = label;
    return badge;
  }
  function renderRows(items) {
    controls.body.replaceChildren();
    if (!items.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.className = "text-center text-muted py-5";
      cell.textContent = "No notification delivery records match these filters.";
      row.appendChild(cell);
      controls.body.appendChild(row);
      return;
    }
    for (const item of items) {
      const row = document.createElement("tr");
      addCell(row, formatDate(item.created_at), "text-nowrap small");
      const channel = addCell(row, item.channel === "whatsapp" ? "WhatsApp" : item.channel === "sms" ? "SMS" : item.channel);
      channel.className = "fw-semibold text-nowrap";
      addCell(row, item.provider || "Unknown", "text-nowrap");
      addCell(row, item.recipient, "font-monospace text-nowrap");
      const messageCell = document.createElement("td");
      messageCell.style.minWidth = "220px";
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.className = "notification-history-message-summary";
      summary.textContent = String(item.message_body || "").replace(/\s+/g, " ").slice(0, 100) || "(empty message)";
      const message = document.createElement("div");
      message.className = "small text-break mt-2";
      message.style.whiteSpace = "pre-wrap";
      message.textContent = item.message_body || "";
      details.append(summary, message);
      if (item.error_message) {
        const error = document.createElement("div");
        error.className = "small text-danger mt-2";
        error.textContent = "Error: " + item.error_message;
        details.appendChild(error);
      }
      messageCell.appendChild(details);
      row.appendChild(messageCell);
      addCell(row, item.transaction_id || item.provider_message_id || "—", "font-monospace small");
      const statusCell = document.createElement("td");
      statusCell.appendChild(statusBadge(item.status));
      row.appendChild(statusCell);
      controls.body.appendChild(row);
    }
  }
  function updateProviderOptions(providers) {
    const current = controls.provider.value || "all";
    const options = [{ value: "all", label: "All SMS gateways" }, ...providers.map(value => ({ value, label: value }))];
    controls.provider.replaceChildren();
    for (const option of options) {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      controls.provider.appendChild(element);
    }
    controls.provider.value = options.some(option => option.value === current) ? current : "all";
  }
  async function loadHistory() {
    if (state.loading) return;
    state.loading = true;
    controls.refresh.disabled = true;
    controls.refresh.innerHTML = '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Loading';
    setResult("Loading delivery history…");
    const params = new URLSearchParams({
      channel: controls.channel.value || "all",
      provider: controls.provider.value || "all",
      status: controls.status.value || "all",
      search: controls.search.value.trim(),
      page: String(state.page)
    });
    try {
      const response = await fetch("/api/notifications/delivery-history?" + params.toString(), {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store"
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.success) throw new Error(payload.message || "Could not load notification history.");
      state.total = Number(payload.total || 0);
      state.loaded = true;
      updateProviderOptions(payload.providers || []);
      renderRows(payload.items || []);
      controls.total.textContent = state.total.toLocaleString();
      controls.page.textContent = "Page " + payload.page + " · " + (payload.items || []).length + " records";
      controls.prev.disabled = state.page <= 1;
      controls.next.disabled = state.page * Number(payload.pageSize || 100) >= state.total;
      setResult(state.total ? "Showing page " + state.page + " of " + Math.max(1, Math.ceil(state.total / Number(payload.pageSize || 100))) + "." : "No matching delivery records yet.");
    } catch (error) {
      setResult(error.message || "Could not load notification history.", "danger");
      controls.body.replaceChildren();
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.className = "text-center text-danger py-4";
      cell.textContent = error.message || "Notification history is unavailable.";
      row.appendChild(cell);
      controls.body.appendChild(row);
    } finally {
      state.loading = false;
      controls.refresh.disabled = false;
      controls.refresh.innerHTML = '<i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Refresh';
    }
  }
  function resetAndLoad() {
    state.page = 1;
    loadHistory();
  }
  controls.refresh.addEventListener("click", resetAndLoad);
  [controls.channel, controls.provider, controls.status].forEach(control => control.addEventListener("change", resetAndLoad));
  controls.search.addEventListener("input", () => {
    clearTimeout(state.debounce);
    state.debounce = setTimeout(resetAndLoad, 250);
  });
  controls.prev.addEventListener("click", () => { if (state.page > 1) { state.page -= 1; loadHistory(); } });
  controls.next.addEventListener("click", () => { if (state.page * 100 < state.total) { state.page += 1; loadHistory(); } });
  document.querySelectorAll('[data-notify-tab="history"]').forEach(button => button.addEventListener("click", () => {
    if (!state.loaded) loadHistory();
  }));
  if (root.offsetParent !== null) loadHistory();
  window.refreshNotificationDeliveryHistory = resetAndLoad;
})();