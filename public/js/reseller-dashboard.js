(function () {
  'use strict';
  const {api,escapeHtml,money,getJson,showError,clearError} = window.ResellerWorkspace;
  async function loadDashboard() {
    clearError();
    const grid = document.getElementById('popGrid');
    try {
      const overview = await getJson(api + '/overview');
      const metrics = overview.metrics || {};
      document.getElementById('metricPops').textContent = metrics.assignedPopCount ?? 0;
      document.getElementById('metricActive').textContent = metrics.activeCustomerCount ?? 0;
      document.getElementById('metricInactive').textContent = metrics.inactiveExpiredCustomerCount ?? 0;
      document.getElementById('metricRenewals').textContent = metrics.monthlyRenewalCount ?? 0;
      document.getElementById('metricCollection').textContent = 'Collection: ' + money(metrics.monthlyCollectionAmount);
      const pops = overview.pops || [];
      document.getElementById('popCount').textContent = pops.length + ' POP' + (pops.length === 1 ? '' : 's');
      if (!pops.length) {
        grid.innerHTML = '<div class="col-12"><div class="empty-state"><i class="bi bi-diagram-3 d-block mb-2"></i>No POPs are currently assigned to this account.</div></div>';
        return;
      }
      grid.innerHTML = pops.map(pop => '<div class="col-12 col-md-6 col-xl-4"><div class="pop-card"><div class="d-flex justify-content-between gap-2"><div class="pop-name">' + escapeHtml(pop.name) + '</div><span class="badge badge-soft">' + escapeHtml(pop.status || 'active') + '</span></div><div class="pop-meta">' + escapeHtml(pop.area_zone || 'Area not specified') + '</div><div class="pop-meta"><i class="bi bi-diagram-2 me-1"></i>VLAN: ' + escapeHtml(pop.vlan_id ?? '—') + '</div><div class="pop-meta"><i class="bi bi-hdd-network me-1"></i>IP Pool: ' + escapeHtml(pop.mikrotik_ip_pool || '—') + '</div></div></div>').join('');
    } catch (error) {
      showError(error.message);
      grid.innerHTML = '<div class="col-12 text-danger small">Assigned POPs and network metrics could not be loaded.</div>';
    }
  }
  document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('popGrid')) loadDashboard(); });
})();
