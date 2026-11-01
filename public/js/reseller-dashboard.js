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
        grid.innerHTML = '<div class="empty-state"><i class="bi bi-diagram-3 d-block mb-2"></i>No POPs are currently assigned to this account.</div>';
        return;
      }
      grid.innerHTML = pops.map(pop => {
        const status = String(pop.status || 'active').toLowerCase();
        const statusClass = status === 'active' ? 'is-active' : 'is-inactive';
        const ipPool = pop.pppoe_ip_pool || pop.mikrotik_ip_pool || '—';
        return '<article class="pop-card"><div class="pop-card-content">' +
          '<div class="pop-card-heading"><div class="pop-name">' + escapeHtml(pop.name) + '</div>' +
          '<span class="pop-status-badge ' + statusClass + '">' + escapeHtml(status) + '</span></div>' +
          '<div class="pop-meta"><span><i class="bi bi-geo-alt me-1"></i>' + escapeHtml(pop.area_zone || 'Area not specified') + '</span>' +
          '<span><i class="bi bi-diagram-2 me-1"></i>VLAN: ' + escapeHtml(pop.vlan_id ?? '—') + '</span>' +
          '<span><i class="bi bi-hdd-network me-1"></i>IP Pool: ' + escapeHtml(ipPool) + '</span></div></div></article>';
      }).join('');
    } catch (error) {
      showError(error.message);
      grid.innerHTML = '<div class="col-12 text-danger small">Assigned POPs and network metrics could not be loaded.</div>';
    }
  }
  document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('popGrid')) loadDashboard(); });
})();
