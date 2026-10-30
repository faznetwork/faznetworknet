(function () {
  'use strict';
  const api = '/api/reseller-portal';
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const money = value => '৳' + Number(value || 0).toLocaleString('en-BD', {minimumFractionDigits:2, maximumFractionDigits:2});
  const date = value => {
    if (!value) return '—';
    const raw = String(value).slice(0,10);
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return match ? match[3] + '/' + match[2] + '/' + match[1] : escapeHtml(raw);
  };
  async function getJson(url) {
    const response = await fetch(url, {headers:{Accept:'application/json'}, cache:'no-store'});
    let data;
    try { data = await response.json(); }
    catch (error) { throw new Error('The server returned an invalid response.'); }
    if (!response.ok || !data.success) throw new Error(data.message || 'Unable to load reseller data.');
    return data;
  }
  function showError(message) {
    const box = document.getElementById('workspaceError');
    if (!box) return;
    box.textContent = String(message || 'An unexpected error occurred.');
    box.classList.remove('d-none');
  }
  function clearError() {
    const box = document.getElementById('workspaceError');
    if (box) { box.textContent = ''; box.classList.add('d-none'); }
  }
  async function signOut() {
    const button = document.getElementById('logoutButton');
    if (!button) return;
    button.disabled = true;
    try {
      const response = await fetch('/api/resellers/logout', {method:'POST', headers:{Accept:'application/json'}});
      let result;
      try { result = await response.json(); }
      catch (error) { throw new Error('The server returned an invalid sign-out response.'); }
      if (!response.ok || !result.success) throw new Error(result.message || 'Sign out failed.');
      window.location.assign('/reseller/login');
    } catch (error) {
      showError(error.message);
      button.disabled = false;
    }
  }
  function initializeSidebar() {
    const toggle = document.getElementById('resellerSidebarToggle');
    const backdrop = document.getElementById('resellerSidebarBackdrop');
    const close = () => {
      document.body.classList.remove('reseller-sidebar-open');
      backdrop?.classList.remove('show');
      toggle?.setAttribute('aria-expanded','false');
    };
    toggle?.addEventListener('click', () => {
      const open = !document.body.classList.contains('reseller-sidebar-open');
      document.body.classList.toggle('reseller-sidebar-open', open);
      backdrop?.classList.toggle('show', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    backdrop?.addEventListener('click', close);
    document.querySelectorAll('.reseller-nav a').forEach(link => link.addEventListener('click', close));
    document.addEventListener('keydown', event => { if (event.key === 'Escape') close(); });
  }
  window.ResellerWorkspace = {api, escapeHtml, money, date, getJson, showError, clearError};
  document.addEventListener('DOMContentLoaded', () => {
    initializeSidebar();
    document.getElementById('logoutButton')?.addEventListener('click', signOut);
  });
})();
