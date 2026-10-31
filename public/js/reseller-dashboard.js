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
      const account = overview.billingAccount || {};
      const prepaid = account.billing_mode === 'prepaid';
      const amount = prepaid ? account.wallet_balance : account.availableCredit;
      document.getElementById('metricAccountBalance').textContent = amount == null ? 'Unavailable' : money(amount);
      document.getElementById('metricAccountFoot').textContent = prepaid
        ? 'Status: ' + (account.account_status || 'Unknown')
        : 'Credit Limit: ' + money(account.credit_limit);
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

  document.addEventListener('click', function (event) {
    const trigger = event.target.closest('#resellerBalanceGuidance');
    if (!trigger) return;
    const message = document.getElementById('resellerBalanceGuidanceText');
    if (message && trigger.dataset.billingMode === 'postpaid') {
      message.textContent = 'Your account uses postpaid credit. Contact your FAZ NETWORK administrator to confirm the outstanding receivable and arrange settlement. This action does not submit a payment or create a request.';
    } else if (message) {
      message.textContent = 'For prepaid wallet top-up, contact your FAZ NETWORK administrator and share the payment method, amount and TxID/reference after payment. An administrator must verify and credit your wallet. This action does not submit a payment or create a request.';
    }
    const modal = document.getElementById('resellerBalanceGuidanceModal');
    if (!modal || !window.bootstrap || !window.bootstrap.Modal) {
      showError('Balance guidance dialog is unavailable. Please refresh the page and try again.');
      console.error('[Reseller Dashboard] Bootstrap modal support is unavailable for balance guidance.');
      return;
    }
    window.bootstrap.Modal.getOrCreateInstance(modal).show();
  });

  document.addEventListener('DOMContentLoaded', () => { if (document.getElementById('popGrid')) loadDashboard(); });
})();
