console.log('>>> RUNNING DUAL-SERVICE POP ADMIN BUILD V9 <<<');
(function () {
  'use strict';

  const API = '/api';
  const state = { pops: [], resellers: [], ipPools: [], activeView: null, busy: false };

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  }

  async function apiRequest(path, options) {
    const opts = Object.assign({ credentials: 'same-origin', cache: 'no-store' }, options || {});
    opts.headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    const response = await fetch(API + path, opts);
    let payload;
    try {
      payload = await response.json();
    } catch (error) {
      const parseError = new Error('The server returned an unreadable response (' + response.status + ').');
      parseError.status = response.status;
      parseError.cause = error;
      throw parseError;
    }
    if (!response.ok || payload.success === false) {
      const requestError = new Error(payload.message || payload.error || ('Request failed with HTTP ' + response.status + '.'));
      requestError.status = response.status;
      requestError.payload = payload;
      throw requestError;
    }
    return payload;
  }

  function formatMoney(value, type) {
    const amount = Number(value || 0);
    return (type === 'fixed' ? '৳' : '') + amount.toLocaleString('en-BD', { maximumFractionDigits: 2 }) + (type === 'percentage' ? '%' : '');
  }

  function statusPill(status) {
    const key = String(status || 'inactive').toLowerCase();
    const map = {
      pending: ['warning', 'Pending'],
      active: ['success', 'Active'],
      expired: ['danger', 'Expired'],
      inactive: ['secondary', 'Inactive']
    };
    const item = map[key] || map.inactive;
    return '<span class="badge rounded-pill text-bg-' + item[0] + '">' + item[1] + '</span>';
  }

  function statusButton(status, id, kind, activationLocked) {
    const active = String(status).toLowerCase() === 'active';
    const locked = !active && Boolean(activationLocked);
    return '<button type="button" class="btn btn-sm ' + (active ? 'btn-outline-warning' : 'btn-outline-success') +
      '" data-action="toggle-' + kind + '" data-id="' + escapeHtml(id) + '" data-status="' + (active ? 'inactive' : 'active') + '"' +
      (locked ? ' disabled title="This invitation must be accepted and a password set before activation."' : '') + '>' +
      (active ? 'Set Inactive' : 'Set Active') + '</button>';
  }

  function rootView(id, title) {
    const host = document.getElementById('dynamicPageContent');
    if (!host) throw new Error('Admin content container #dynamicPageContent is unavailable.');
    let section = document.getElementById(id);
    if (!section) {
      section = document.createElement('section');
      section.id = id;
      section.className = 'admin-view faz-pop-reseller-view';
      host.appendChild(section);
    }
    state.activeView = id;
    if (typeof window.switchView === 'function') window.switchView(id.replace(/^view-/, ''));
    if (typeof window.setPageTitleSafe === 'function') window.setPageTitleSafe(title);
    return section;
  }

  function errorBanner(message) {
    return '<div class="alert alert-danger d-flex align-items-start gap-2" role="alert"><i class="bi bi-exclamation-triangle-fill mt-1"></i><div>' +
      escapeHtml(message) + '</div></div>';
  }

  function showToast(message, type) {
    const tone = type === 'success' ? 'success' : (type === 'warning' ? 'warning' : 'danger');
    let host = document.getElementById('fprToastContainer');
    if (!host) {
      host = document.createElement('div');
      host.id = 'fprToastContainer';
      host.className = 'toast-container position-fixed top-0 end-0 p-3';
      host.style.zIndex = '1090';
      document.body.appendChild(host);
    }
    const toast = document.createElement('div');
    toast.className = 'toast align-items-center text-bg-' + tone + ' border-0';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.setAttribute('aria-atomic', 'true');
    const row = document.createElement('div');
    row.className = 'd-flex';
    const body = document.createElement('div');
    body.className = 'toast-body';
    body.textContent = message;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn-close btn-close-white me-2 m-auto';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', function () { toast.remove(); });
    row.appendChild(body);
    row.appendChild(close);
    toast.appendChild(row);
    host.appendChild(toast);
    if (window.bootstrap && window.bootstrap.Toast) {
      window.bootstrap.Toast.getOrCreateInstance(toast, { delay: 5000 }).show();
    } else {
      toast.classList.add('show');
      window.setTimeout(function () { toast.remove(); }, 5000);
    }
  }

  function clearFieldErrors(form) {
    form.querySelectorAll('.is-invalid').forEach(function (field) {
      field.classList.remove('is-invalid');
      field.removeAttribute('aria-invalid');
    });
    form.querySelectorAll('[data-fpr-field-error="1"]').forEach(function (node) { node.remove(); });
  }

  function mapPopFieldErrors(error, container) {
    const payload = error && error.payload ? error.payload : {};
    const supplied = payload.errors || payload.validationErrors || payload.details;
    const mapped = {};
    if (supplied && typeof supplied === 'object' && !Array.isArray(supplied)) {
      Object.keys(supplied).forEach(function (key) {
        const item = supplied[key];
        mapped[key] = Array.isArray(item) ? item.join(' ') : String(item && item.message ? item.message : item);
      });
    }
    const message = String(error && error.message || '');
    if (!Object.keys(mapped).length) {
      const rules = [
        ['name', /pop name|name is required|name.*100 characters/i],
        ['area_zone', /area.?zone/i],
        ['reseller_id', /reseller/i],
        ['vlan_id', /vlan/i],
        ['pppoe_ip_pool', /pppoe.*pool|ip pool/i],
        ['hotspot_ip_pool', /hotspot.*pool/i],
        ['hotspot_server', /hotspot server/i],
        ['commission_type', /commission_type|commission type/i],
        ['commission_rate', /commission_rate|commission rate|commission.*rate/i]
      ];
      const match = rules.find(function (rule) { return rule[1].test(message); });
      if (match) mapped[match[0]] = message;
    }
    Object.keys(mapped).forEach(function (name) {
      const field = container.querySelector('[name="' + name + '"]');
      if (!field || !field.classList) return;
      field.classList.add('is-invalid');
      field.setAttribute('aria-invalid', 'true');
      const feedback = document.createElement('div');
      feedback.className = 'invalid-feedback d-block';
      feedback.dataset.fprFieldError = '1';
      feedback.textContent = mapped[name];
      field.insertAdjacentElement('afterend', feedback);
    });
    return Object.keys(mapped).length > 0;
  }

  function sharedStyles() {
    return '<style id="fazPopResellerStyles">' +
      '.faz-pop-reseller-view{min-width:0;width:100%;max-width:100%;overflow-x:clip;color:#0f172a;font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-weight:400}' +
      '.faz-pop-reseller-view .fpr-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:18px}' +
      '.faz-pop-reseller-view .fpr-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}' +
      '.faz-pop-reseller-view .fpr-metric{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:16px;min-width:0;box-shadow:0 2px 8px rgba(15,23,42,.04)}.faz-pop-reseller-view .fpr-metric--pops{background:#eef2ff;border-color:#c7d2fe}.faz-pop-reseller-view .fpr-metric--customers{background:#ecfdf5;border-color:#a7f3d0}.faz-pop-reseller-view .fpr-metric--resellers{background:#f5f3ff;border-color:#ddd6fe}' +
      '.faz-pop-reseller-view .fpr-metric-label{font-size:12px;color:#64748b;font-weight:500;text-transform:uppercase;letter-spacing:.04em}' +
      '.faz-pop-reseller-view .fpr-metric-value{font-size:clamp(22px,3vw,30px);font-weight:700;color:#0f172a;overflow-wrap:anywhere;margin-top:5px}' +
      '.faz-pop-reseller-view .fpr-card{border:1px solid #e2e8f0;border-radius:14px;background:#fff;overflow:hidden}' +
      '.faz-pop-reseller-view .fpr-card-head{padding:14px 16px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;font-weight:500}' +
      '.faz-pop-reseller-view .fpr-heading p,.faz-pop-reseller-view .fpr-muted{font-weight:400}' +
      '.faz-pop-reseller-view .fpr-heading h1,.faz-pop-reseller-view .modal-title{font-weight:700}' +
      '.faz-pop-reseller-view .badge{font-weight:600}' +
      '.faz-pop-reseller-view .fpr-table{margin:0;min-width:980px;font-size:13px}' +
      '.faz-pop-reseller-view .fpr-table th{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.035em;color:#64748b;white-space:nowrap;background:#f8fafc}' +
      '.faz-pop-reseller-view .fpr-table td{vertical-align:middle;font-weight:400}' +
      '.faz-pop-reseller-view .fpr-actions{display:flex;gap:6px;flex-wrap:wrap;min-width:145px}' +
      '.faz-pop-reseller-view .fpr-badges{display:flex;gap:5px;flex-wrap:wrap;max-width:260px}' +
      '.faz-pop-reseller-view .fpr-badge{display:inline-flex;padding:4px 8px;border-radius:999px;background:#ecfdf5;color:#065f46;font-size:11px;font-weight:600;max-width:100%;overflow-wrap:anywhere}' +
      '.faz-pop-reseller-view .fpr-muted{color:#64748b}' +
      '.faz-pop-reseller-view .modal-content{border:0;border-radius:16px;overflow:hidden}' +
      '.faz-pop-reseller-view .modal-header{background:#f8fafc}' +
      '.faz-pop-reseller-view #fprPopModal .modal-body{padding:1.5rem}' +
      '.faz-pop-reseller-view #fprPopModal .modal-body .row.g-3{--bs-gutter-x:1rem;--bs-gutter-y:1rem;min-width:0}' +
      '.faz-pop-reseller-view #fprPopModal .modal-body [class*="col-"]{min-width:0}' +
      '.faz-pop-reseller-view #fprPopModal .form-label{display:block;width:100%;margin:0 0 .5rem;padding:0;line-height:1.45}' +
      '.faz-pop-reseller-view #fprPopModal .form-control,.faz-pop-reseller-view #fprPopModal .form-select{display:block;width:100%;min-width:0;box-sizing:border-box}' +
      '.faz-pop-reseller-view #fprPopModal .input-group{display:flex;flex-wrap:nowrap;width:100%;min-width:0}' +
      '.faz-pop-reseller-view #fprPopModal .border.rounded-3{min-width:0}' +
      '.faz-pop-reseller-view .form-label{font-size:13px;font-weight:500;color:#334155}' +
      '.faz-pop-reseller-view .form-control,.faz-pop-reseller-view .form-select{min-height:42px;font-weight:400}' +
      '.faz-pop-reseller-view .fpr-loading{padding:40px 16px;text-align:center;color:#64748b}' +
      '@media(max-width:767.98px){.faz-pop-reseller-view .fpr-metrics{grid-template-columns:1fr;gap:9px}.faz-pop-reseller-view .fpr-metric{padding:12px}.faz-pop-reseller-view .fpr-heading .btn{width:100%}.faz-pop-reseller-view .modal-dialog{margin:10px auto;max-width:calc(100% - 20px)}.faz-pop-reseller-view .modal-footer .btn{flex:1;min-height:42px}}' +
      '</style>';
  }

  function renderPopManagement(section, error) {
    document.querySelectorAll('#fprPopModal').forEach(function (element) {
      const instance = window.bootstrap && window.bootstrap.Modal && window.bootstrap.Modal.getInstance(element);
      if (instance) instance.dispose();
      element.remove();
    });
    const totalCustomers = state.pops.reduce(function (sum, pop) { return sum + Number(pop.customer_count || 0); }, 0);
    const rows = state.pops.map(function (pop) {
      const owner = pop.reseller_name || '—';
      const commission = formatMoney(pop.commission_rate, pop.commission_type);
      return '<tr>' +
        '<td class="text-secondary fw-semibold">' + escapeHtml(pop.id) + '</td>' +
        '<td><strong>' + escapeHtml(pop.name) + '</strong></td>' +
        '<td>' + escapeHtml(pop.area_zone || '—') + '</td>' +
        '<td>' + escapeHtml(owner) + '</td>' +
        '<td>' + escapeHtml(pop.pppoe_ip_pool || '—') + '</td>' +
        '<td>' + escapeHtml(pop.hotspot_ip_pool || '—') + '</td>' +
        '<td><div class="fpr-badges">' + (pop.pppoe_enabled ? '<span class="fpr-badge">PPPoE</span>' : '') + (pop.hotspot_enabled ? '<span class="fpr-badge">Hotspot</span>' : '') + ((!pop.pppoe_enabled && !pop.hotspot_enabled) ? '<span class="small fpr-muted">No service enabled</span>' : '') + '</div></td>' +
        '<td>' + escapeHtml(commission) + '</td>' +
        '<td>' + Number(pop.customer_count || 0).toLocaleString('en-BD') + '</td>' +
        '<td>' + statusPill(pop.status) + '</td>' +
        '<td><div class="fpr-actions"><button class="btn btn-sm btn-outline-primary" type="button" data-action="edit-pop" data-id="' + escapeHtml(pop.id) + '"><i class="bi bi-pencil me-1"></i>Edit</button>' +
        statusButton(pop.status, pop.id, 'pop') + '</div></td></tr>';
    }).join('');
    section.innerHTML = sharedStyles() +
      '<div class="fpr-heading"><div><div class="small text-success text-uppercase">Network Structure</div><h1 class="h4 fw-bold mb-1">POP Management</h1><p class="text-muted small mb-0">Manage POP ownership, PPPoE broadband pools, Hotspot wireless bindings and commission settings.</p></div>' +
      '<button class="btn btn-success" type="button" data-action="new-pop"><i class="bi bi-plus-lg me-2"></i>Create POP</button></div>' +
      (error ? errorBanner(error) : '') +
      '<div class="fpr-metrics">' +
      '<article class="fpr-metric fpr-metric--pops"><div class="fpr-metric-label">Total POPs</div><div class="fpr-metric-value">' + state.pops.length.toLocaleString('en-BD') + '</div></article>' +
      '<article class="fpr-metric fpr-metric--customers"><div class="fpr-metric-label">Total POP Customers</div><div class="fpr-metric-value">' + totalCustomers.toLocaleString('en-BD') + '</div><div class="small fpr-muted">All customer records assigned to POPs</div></article>' +
      '<article class="fpr-metric fpr-metric--resellers"><div class="fpr-metric-label">Total Resellers</div><div class="fpr-metric-value">' + state.resellers.length.toLocaleString('en-BD') + '</div></article></div>' +
      '<section class="fpr-card"><div class="fpr-card-head"><div>POP Directory</div><button class="btn btn-sm btn-outline-secondary" type="button" data-action="refresh-pops"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button></div>' +
      '<div class="table-responsive"><table class="table table-hover fpr-table"><thead><tr><th>#</th><th>Name</th><th>Area / Zone</th><th>Reseller Owner</th><th>PPPoE IP Pool</th><th>Hotspot IP Pool</th><th>Services</th><th>Commission</th><th>Customers</th><th>Status</th><th>Actions</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="11" class="text-center text-muted py-4">No POP records found.</td></tr>') +
      '</tbody></table></div></section>' +
      popModalHtml();
    bindSection(section, 'pop');
  }

  function popModalHtml() {
    return '<div class="modal fade" id="fprPopModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered modal-lg"><div class="modal-content">' +
      '<form id="fprPopForm" novalidate><div class="modal-header"><h5 class="modal-title fw-bold" id="fprPopModalTitle">Create POP</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
      '<div class="modal-body"><div id="fprPopFormError"></div><input type="hidden" name="id">' +
      '<div class="row g-3"><div class="col-12 col-md-6"><label class="form-label">POP Name *</label><input class="form-control" name="name" maxlength="100" required></div>' +
      '<div class="col-12 col-md-6"><label class="form-label">Area / Zone</label><input class="form-control" name="area_zone" maxlength="150"></div>' +
      '<div class="col-12 col-md-6"><label class="form-label">Assign Reseller</label><select class="form-select" name="reseller_id" id="fprPopReseller"><option value="">FAZ Direct / Unassigned</option>' +
      state.resellers.filter(function (r) { return r.status === 'active'; }).map(function (r) { return '<option value="' + escapeHtml(r.id) + '">' + escapeHtml(r.name) + ' — ' + escapeHtml(r.email || r.username || '') + '</option>'; }).join('') +
      '</select><div class="form-text" id="fprPopOwnerHelp">Only reseller-owned POPs are managed in this workspace.</div></div>' +
      '<div class="col-12"><div class="border rounded-3 p-3"><div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" name="pppoe_enabled" id="fprPppoeEnabled" checked><label class="form-check-label" for="fprPppoeEnabled">Enable PPPoE Broadband</label></div><label class="form-label" for="fprPppoeIpPool">PPPoE IP Pool</label><select class="form-select" name="pppoe_ip_pool" id="fprPppoeIpPool"><option value="">None / Unassigned</option></select><div class="form-text">Used only for PPPoE subscriber address assignment. Existing legacy POP pool values are migrated into this field.</div><label class="form-label mt-3" for="fprPopVlan">Legacy / PPPoE VLAN ID</label><input class="form-control" type="number" name="vlan_id" id="fprPopVlan" min="1" max="4094"></div></div>' +
      '<div class="col-12"><div class="border rounded-3 p-3"><div class="form-check form-switch mb-2"><input class="form-check-input" type="checkbox" name="hotspot_enabled" id="fprHotspotEnabled"><label class="form-check-label" for="fprHotspotEnabled">Enable Hotspot Wireless / Vouchers</label></div><div class="row g-3"><div class="col-12 col-md-6"><label class="form-label" for="fprHotspotServer">Hotspot Server *</label><input class="form-control" name="hotspot_server" id="fprHotspotServer" maxlength="100" placeholder="hotspot1"></div><div class="col-12 col-md-6"><label class="form-label" for="fprHotspotInterface">Hotspot Interface</label><input class="form-control" name="hotspot_interface" id="fprHotspotInterface" maxlength="100" placeholder="bridge-hotspot"></div><div class="col-12 col-md-6"><label class="form-label" for="fprHotspotIpPool">Hotspot IP Pool *</label><select class="form-select" name="hotspot_ip_pool" id="fprHotspotIpPool"><option value="">None / Unassigned</option></select></div><div class="col-12 col-md-6"><label class="form-label" for="fprHotspotVlan">Hotspot VLAN ID</label><input class="form-control" type="number" name="hotspot_vlan_id" id="fprHotspotVlan" min="1" max="4094"></div></div><div class="form-text mt-2">Hotspot pool is stored on the existing POP Hotspot binding and is never reused for PPPoE.</div></div></div>' +
      '<div class="col-6 col-md-3"><label class="form-label">Commission Type</label><select class="form-select" name="commission_type"><option value="percentage">Percentage</option><option value="fixed">Fixed (৳)</option></select></div>' +
      '<div class="col-6 col-md-3"><label class="form-label">Commission Rate</label><input class="form-control" type="number" name="commission_rate" min="0" step="0.01" value="0" required></div></div></div>' +
      '<div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="button" class="btn btn-success" id="fprPopSave" data-action="save-pop">Save POP</button></div></form></div></div></div>';
  }

  function renderResellerAccess(section, error) {
    const rows = state.resellers.map(function (reseller) {
      const pops = Array.isArray(reseller.assigned_pops) ? reseller.assigned_pops : [];
      const badges = pops.length ? pops.map(function (pop) { return '<span class="fpr-badge">' + escapeHtml(pop.name) + '</span>'; }).join('') : '<span class="small fpr-muted">No POP assigned</span>';
      const status = String(reseller.invite_status || 'inactive').toLowerCase();
      const resend = reseller.status !== 'active' ? '<button type="button" class="btn btn-sm btn-outline-primary" data-action="resend-invite" data-id="' + escapeHtml(reseller.id) + '">Resend Invite</button>' : '';
      const cancel = (status === 'pending' || status === 'expired') ? '<button type="button" class="btn btn-sm btn-outline-danger" data-action="cancel-invite" data-id="' + escapeHtml(reseller.id) + '">Cancel Invite</button>' : '';
      return '<tr><td><span>' + escapeHtml(reseller.name) + '</span><div class="small fpr-muted">#' + escapeHtml(reseller.id) + '</div></td>' +
        '<td><div>' + escapeHtml(reseller.email || reseller.username || '—') + '</div><div class="small fpr-muted">' + escapeHtml(reseller.phone || '') + '</div></td>' +
        '<td><div class="fpr-badges">' + badges + '</div></td><td>' + statusPill(status) + '</td>' +
        '<td><div class="fpr-actions">' + resend + cancel + statusButton(reseller.status, reseller.id, 'reseller', status === 'pending' || status === 'expired') + '</div></td></tr>';
    }).join('');
    section.innerHTML = sharedStyles() +
      '<div class="fpr-heading"><div><div class="small text-success text-uppercase">Access & Invitations</div><h1 class="h4 fw-bold mb-1">Reseller Accounts &amp; Access</h1><p class="text-muted small mb-0">Review reseller access, assigned POPs and invitation lifecycle.</p></div>' +
      '<button class="btn btn-success" type="button" data-action="new-reseller"><i class="bi bi-person-plus me-2"></i>Invite Reseller</button></div>' +
      (error ? errorBanner(error) : '') +
      '<section class="fpr-card"><div class="fpr-card-head"><div>Reseller Directory</div><button class="btn btn-sm btn-outline-secondary" type="button" data-action="refresh-resellers"><i class="bi bi-arrow-clockwise me-1"></i>Refresh</button></div>' +
      '<div class="table-responsive"><table class="table table-hover fpr-table"><thead><tr><th>Name</th><th>Email / Login ID &amp; Phone</th><th>Assigned POPs</th><th>Invite Status</th><th>Actions</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="5" class="text-center text-muted py-4">No reseller accounts found.</td></tr>') +
      '</tbody></table></div></section>' + resellerModalHtml();
    bindSection(section, 'reseller');
  }

  function resellerModalHtml() {
    const eligible = state.pops.filter(function (pop) {
      return pop.status === 'active' && pop.reseller_id == null && Number(pop.customer_count || 0) === 0;
    });
    return '<div class="modal fade" id="fprResellerModal" tabindex="-1" aria-hidden="true"><div class="modal-dialog modal-dialog-centered"><div class="modal-content">' +
      '<form id="fprResellerForm"><div class="modal-header"><h5 class="modal-title fw-bold">Invite Reseller</h5><button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button></div>' +
      '<div class="modal-body"><div id="fprResellerFormError"></div><div class="mb-3"><label class="form-label">Name *</label><input class="form-control" name="name" maxlength="100" required></div>' +
      '<div class="mb-3"><label class="form-label">Email *</label><input class="form-control" type="email" name="email" maxlength="254" required></div>' +
      '<div class="mb-3"><label class="form-label">Phone *</label><input class="form-control" name="phone" maxlength="40" required></div>' +
      '<div class="mb-2"><label class="form-label">Assign POP(s)</label><select class="form-select" name="assigned_pop_ids" id="fprInvitePops" multiple size="5">' +
      eligible.map(function (pop) { return '<option value="' + escapeHtml(pop.id) + '">' + escapeHtml(pop.name) + (pop.area_zone ? ' — ' + escapeHtml(pop.area_zone) : '') + '</option>'; }).join('') +
      '</select><div class="form-text">Only eligible unassigned POPs can be attached to an invitation. If none are available, leave this empty and assign a reseller-owned POP after the account is created.</div></div></div>' +
      '<div class="modal-footer"><button type="button" class="btn btn-light" data-bs-dismiss="modal">Cancel</button><button type="submit" class="btn btn-success" id="fprResellerSave">Queue Invitation</button></div></form></div></div></div>';
  }

  function bindSection(section, kind) {
    if (section.dataset.fprBound === '1') return;
    section.dataset.fprBound = '1';
    section.addEventListener('click', async function (event) {
      const button = event.target.closest('[data-action]');
      if (!button || !section.contains(button)) return;
      const action = button.dataset.action;
      const id = button.dataset.id;
      try {
        if (action === 'new-pop') return await openPopModal(null);
        if (action === 'edit-pop') return await openPopModal(state.pops.find(function (item) { return String(item.id) === String(id); }));
        if (action === 'new-reseller') return openResellerModal();
        if (action === 'refresh-pops') return window.loadPopManagement();
        if (action === 'refresh-resellers') return window.loadResellerAccess();
        if (action === 'toggle-pop') return toggleRecord('pop', id, button.dataset.status);
        if (action === 'toggle-reseller') return toggleRecord('reseller', id, button.dataset.status);
        if (action === 'resend-invite') {
          if (!window.confirm('Send a replacement invitation? The previous invitation link will be invalidated.')) return;
          button.disabled = true;
          await apiRequest('/resellers/' + encodeURIComponent(id) + '/resend-invite', { method: 'POST', body: {} });
          await window.loadResellerAccess();
          return;
        }
        if (action === 'cancel-invite') {
          if (!window.confirm('Cancel this reseller invitation? Its link will no longer work.')) return;
          button.disabled = true;
          await apiRequest('/resellers/' + encodeURIComponent(id) + '/cancel-invite', { method: 'POST', body: {} });
          await window.loadResellerAccess();
          return;
        }
      } catch (error) {
        const alertHost = section.querySelector('.fpr-heading');
        if (alertHost) alertHost.insertAdjacentHTML('afterend', errorBanner(error.message || 'The requested action failed.'));
        showToast(error.message || 'The requested action failed.', 'danger');
        console.error('[POP/Reseller Admin UI] Action failed:', error);
      }
    });


  }



  async function savePopForm(form, saveBtn, container) {
    container = container || form || (saveBtn && saveBtn.closest('.modal') ? saveBtn.closest('.modal').querySelector('.modal-body') : null) || document.querySelector('.modal.show .modal-body') || document.querySelector('#fprPopModal .modal-body');
    const lockTarget = form || container;
    if (!container) {
      console.error('[POP UI] POP editor container not found from Save button or open modal.');
      showToast('POP editor fields are unavailable. Close and reopen the POP editor.', 'danger');
      return;
    }
    if (lockTarget.dataset.submitting === '1') return;

    const nameInput = container.querySelector('[name="name"]');
    const name = nameInput ? nameInput.value.trim() : '';
    const errorHost = container.querySelector('#fprPopFormError') || document.querySelector('#fprPopFormError');
    if (errorHost) errorHost.innerHTML = '';
    clearFieldErrors(container);
    if (!name) {
      if (nameInput) {
        nameInput.classList.add('is-invalid');
        nameInput.setAttribute('aria-invalid', 'true');
        nameInput.focus();
      }
      showToast('POP Name is required', 'danger');
      if (errorHost) errorHost.innerHTML = errorBanner('POP Name is required. Please enter a name before saving.');
      return;
    }

    const areaInput = container.querySelector('[name="area_zone"]');
    const resellerSelect = container.querySelector('[name="reseller_id"]');
    const vlanInput = container.querySelector('[name="vlan_id"]');
    const pppoeEnabledInput = container.querySelector('[name="pppoe_enabled"]');
    const pppoePoolInput = container.querySelector('[name="pppoe_ip_pool"]');
    const hotspotEnabledInput = container.querySelector('[name="hotspot_enabled"]');
    const hotspotServerInput = container.querySelector('[name="hotspot_server"]');
    const hotspotInterfaceInput = container.querySelector('[name="hotspot_interface"]');
    const hotspotVlanInput = container.querySelector('[name="hotspot_vlan_id"]');
    const hotspotPoolInput = container.querySelector('[name="hotspot_ip_pool"]');
    const commTypeSelect = container.querySelector('[name="commission_type"]');
    const commRateInput = container.querySelector('[name="commission_rate"]');
    const idInput = container.querySelector('[name="id"]');
    const popId = idInput ? idInput.value : '';
    const current = popId ? state.pops.find(function (item) { return String(item.id) === String(popId); }) : null;
    const resellerId = resellerSelect && resellerSelect.value ? resellerSelect.value : null;

    if (current && Number(current.customer_count || 0) > 0 && String(current.reseller_id || '') !== String(resellerId || '')) {
      const message = 'Ownership cannot be changed while this POP has customer records.';
      if (resellerSelect) {
        resellerSelect.classList.add('is-invalid');
        resellerSelect.setAttribute('aria-invalid', 'true');
      }
      if (errorHost) errorHost.innerHTML = errorBanner(message);
      showToast(message, 'danger');
      return;
    }

    const payload = {
      name: name,
      area_zone: areaInput ? areaInput.value.trim() : '',
      reseller_id: resellerId,
      vlan_id: vlanInput && vlanInput.value ? Number(vlanInput.value) : null,
      pppoe_enabled: Boolean(pppoeEnabledInput && pppoeEnabledInput.checked),
      pppoe_ip_pool: pppoePoolInput && pppoePoolInput.value ? pppoePoolInput.value : null,
      commission_type: commTypeSelect ? commTypeSelect.value : 'percentage',
      commission_rate: commRateInput ? Number(commRateInput.value || 0) : 0
    };
    const currentHotspot = {
      enabled: Boolean(hotspotEnabledInput && hotspotEnabledInput.checked),
      server: hotspotServerInput ? hotspotServerInput.value.trim() : '',
      interface: hotspotInterfaceInput ? hotspotInterfaceInput.value.trim() : '',
      vlanId: hotspotVlanInput && hotspotVlanInput.value ? Number(hotspotVlanInput.value) : null,
      pool: hotspotPoolInput && hotspotPoolInput.value ? hotspotPoolInput.value : null
    };
    if (!popId) {
      payload.hotspot_enabled = currentHotspot.enabled;
      payload.hotspot_server = currentHotspot.server;
      payload.hotspot_interface = currentHotspot.interface;
      payload.hotspot_vlan_id = currentHotspot.vlanId;
      payload.hotspot_ip_pool = currentHotspot.pool;
    } else {
      const initialHotspot = form && form.dataset.hotspotInitial
        ? JSON.parse(form.dataset.hotspotInitial)
        : {
            enabled: Boolean(current && current.hotspot_enabled),
            server: current ? current.hotspot_server || '' : '',
            interface: current ? current.hotspot_interface || '' : '',
            vlanId: current && current.hotspot_vlan_id ? Number(current.hotspot_vlan_id) : null,
            pool: current ? current.hotspot_ip_pool || null : null
          };
      if (currentHotspot.enabled !== initialHotspot.enabled) {
        payload.hotspot_enabled = currentHotspot.enabled;
        if (currentHotspot.enabled) {
          payload.hotspot_server = currentHotspot.server;
          payload.hotspot_interface = currentHotspot.interface;
          payload.hotspot_vlan_id = currentHotspot.vlanId;
          payload.hotspot_ip_pool = currentHotspot.pool;
        }
      } else if (currentHotspot.enabled) {
        if (currentHotspot.server !== initialHotspot.server) payload.hotspot_server = currentHotspot.server;
        if (currentHotspot.interface !== initialHotspot.interface) payload.hotspot_interface = currentHotspot.interface;
        if (currentHotspot.vlanId !== initialHotspot.vlanId) payload.hotspot_vlan_id = currentHotspot.vlanId;
        if (currentHotspot.pool !== initialHotspot.pool) payload.hotspot_ip_pool = currentHotspot.pool;
      }
    }
    const endpoint = '/pops' + (popId ? '/' + encodeURIComponent(popId) : '');
    const method = popId ? 'PUT' : 'POST';
    const originalText = saveBtn ? saveBtn.textContent : 'Save POP';

    lockTarget.dataset.submitting = '1';
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.setAttribute('aria-busy', 'true');
      saveBtn.textContent = 'Saving...';
    }

    try {
      console.log('[POP UI] Dispatching save request:', { endpoint: '/api' + endpoint, method: method, payload: payload });
      const response = await apiRequest(endpoint, { method: method, body: payload });
      console.log('[POP UI] Save response received:', response);
      if (!response || response.success !== true || !response.pop || typeof response.pop !== 'object' || !response.pop.id || !response.pop.name) {
        throw new Error('The server did not confirm a valid POP save. The form remains open; verify the POP directory before retrying.');
      }

      closeModal('fprPopModal');
      if (response.hotspot_persisted === false) {
        showToast('POP saved, but Hotspot settings were not saved. Review the Hotspot Server and IP Pool, then retry.', 'warning');
      } else {
        showToast(popId ? 'POP and Hotspot settings updated successfully.' : 'POP created successfully.', 'success');
      }
      const refreshed = await window.loadPopManagement();
      if (refreshed === false) {
        showToast('POP was saved, but the POP table could not be refreshed. Use Refresh to reload the latest records.', 'warning');
      }
    } catch (error) {
      if (error.field) {
        const field = container.querySelector('[name="' + error.field + '"]');
        if (field) {
          field.classList.add('is-invalid');
          field.setAttribute('aria-invalid', 'true');
        }
      } else {
        mapPopFieldErrors(error, container);
      }
      if (errorHost) errorHost.innerHTML = errorBanner(error.message || 'Unable to save POP. Please try again.');
      showToast(error.message || 'Unable to save POP. Please try again.', 'danger');
      console.error('[POP UI] Save failed:', error);
    } finally {
      delete lockTarget.dataset.submitting;
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.removeAttribute('aria-busy');
        saveBtn.textContent = originalText;
      }
    }
  }

  // Enter-key submission is converted into the same direct async save path; native navigation is never allowed.
  document.addEventListener('submit', function (event) {
    const form = event.target;
    if (!form || (form.id !== 'fprPopForm' && form.id !== 'fprResellerForm')) return;
    event.preventDefault();
    if (form.id === 'fprPopForm') {
      event.stopImmediatePropagation();
      savePopForm(form, form.querySelector('#fprPopSave'));
    }
  }, true);

  document.addEventListener('click', function (event) {
    const target = event.target && event.target.nodeType === 1 ? event.target : event.target && event.target.parentElement;
    const saveBtn = target && target.closest ? target.closest('#fprPopSave') : null;
    if (!saveBtn) return;
    event.preventDefault();
    event.stopPropagation();
    const form = saveBtn.closest('form')
      || saveBtn.form
      || document.getElementById('fprPopForm')
      || document.querySelector('.modal.show form')
      || document.querySelector('#fprPopModal form');
    const container = form
      || document.querySelector('.modal.show .modal-body')
      || document.querySelector('#fprPopModal .modal-body');
    if (!container) {
      console.error('[POP UI] POP editor container not found from Save button or open modal.');
      showToast('POP editor fields are unavailable. Close and reopen the POP editor.', 'danger');
      return;
    }
    savePopForm(form, saveBtn, container);
  });

  document.addEventListener('submit', async function (event) {
    const form = event.target;
    if (!form || form.id !== 'fprResellerForm') return;
    event.preventDefault();
    if (form.dataset.submitting === '1') return;

    const submit = form.querySelector('[type="submit"]');
    const errorHost = form.querySelector('#fprResellerFormError');
    const originalLabel = submit ? submit.textContent : 'Queue Invitation';
    if (errorHost) errorHost.innerHTML = '';
    form.dataset.submitting = '1';
    if (submit) {
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Saving…';
    }

    try {
      const data = new FormData(form);
      const payload = {
        name: String(data.get('name') || '').trim(),
        email: String(data.get('email') || '').trim(),
        phone: String(data.get('phone') || '').trim(),
        assigned_pop_ids: Array.from(form.querySelector('#fprInvitePops').selectedOptions).map(function (option) { return Number(option.value); })
      };
      await apiRequest('/resellers/invite', { method: 'POST', body: payload });
      closeModal('fprResellerModal');
      await window.loadResellerAccess();
    } catch (error) {
      if (errorHost) errorHost.innerHTML = errorBanner(error.message || 'Unable to save changes.');
      showToast(error.message || 'Unable to save changes.', 'danger');
      console.error('[POP/Reseller Admin UI] Form submission failed:', error);
    } finally {
      delete form.dataset.submitting;
      if (submit) {
        submit.disabled = false;
        submit.removeAttribute('aria-busy');
        submit.textContent = originalLabel;
      }
    }
  });
  function modalInstance(id) {
    const element = document.getElementById(id);
    if (!element || !window.bootstrap || !window.bootstrap.Modal) throw new Error('Bootstrap modal support is unavailable.');
    return window.bootstrap.Modal.getOrCreateInstance(element);
  }

  function closeModal(id) {
    const element = document.getElementById(id);
    if (element && window.bootstrap && window.bootstrap.Modal) window.bootstrap.Modal.getOrCreateInstance(element).hide();
  }

  async function openPopModal(pop) {
    const section = document.getElementById('view-pop-management');
    const form = section && section.querySelector('#fprPopForm');
    if (!form) throw new Error('POP editor is not ready. Refresh the view and try again.');
    form.reset();
    form.elements.id.value = pop ? pop.id : '';
    form.elements.name.value = pop ? pop.name || '' : '';
    form.elements.area_zone.value = pop ? pop.area_zone || '' : '';
    const owner = form.querySelector('#fprPopReseller');
    if (pop && pop.reseller_id && !Array.from(owner.options).some(function (option) { return option.value === String(pop.reseller_id); })) {
      const currentOwner = state.resellers.find(function (item) { return String(item.id) === String(pop.reseller_id); });
      const option = document.createElement('option');
      option.value = String(pop.reseller_id);
      option.textContent = (currentOwner ? currentOwner.name : (pop.reseller_name || 'Current reseller')) + ' — current owner';
      owner.appendChild(option);
    }
    owner.value = pop && pop.reseller_id ? String(pop.reseller_id) : '';
    form.elements.vlan_id.value = pop && pop.vlan_id ? pop.vlan_id : '';
    form.elements.pppoe_enabled.checked = pop ? pop.pppoe_enabled !== false : true;
    form.elements.pppoe_ip_pool.value = pop ? pop.pppoe_ip_pool || '' : '';
    form.elements.hotspot_enabled.checked = Boolean(pop && pop.hotspot_enabled);
    form.elements.hotspot_server.value = pop ? pop.hotspot_server || '' : '';
    form.elements.hotspot_interface.value = pop ? pop.hotspot_interface || '' : '';
    form.elements.hotspot_vlan_id.value = pop && pop.hotspot_vlan_id ? pop.hotspot_vlan_id : '';
    form.elements.hotspot_ip_pool.value = pop ? pop.hotspot_ip_pool || '' : '';
    form.elements.commission_type.value = pop ? pop.commission_type || 'percentage' : 'percentage';
    form.elements.commission_rate.value = pop ? pop.commission_rate || 0 : 0;
    owner.disabled = Boolean(pop && Number(pop.customer_count || 0) > 0);
    form.querySelector('#fprPopOwnerHelp').textContent = owner.disabled
      ? 'Ownership is locked because this POP already has customer records.'
      : 'Only reseller-owned POPs appear in this workspace. Unassigned and core POPs are managed separately.';
    form.querySelector('#fprPopFormError').innerHTML = '';
    await loadPopIpPools(form, pop);
    form.dataset.hotspotInitial = JSON.stringify({
      enabled: Boolean(pop && pop.hotspot_enabled),
      server: pop ? pop.hotspot_server || '' : '',
      interface: pop ? pop.hotspot_interface || '' : '',
      vlanId: pop && pop.hotspot_vlan_id ? Number(pop.hotspot_vlan_id) : null,
      pool: pop ? pop.hotspot_ip_pool || null : null
    });
    const syncServiceFields = function () {
      form.elements.pppoe_ip_pool.disabled = !form.elements.pppoe_enabled.checked;
      ['hotspot_server','hotspot_interface','hotspot_vlan_id','hotspot_ip_pool'].forEach(function (name) { form.elements[name].disabled = !form.elements.hotspot_enabled.checked; });
    };
    form.elements.pppoe_enabled.onchange = syncServiceFields;
    form.elements.hotspot_enabled.onchange = syncServiceFields;
    syncServiceFields();
    section.querySelector('#fprPopModalTitle').textContent = pop ? 'Edit POP' : 'Create POP';
    modalInstance('fprPopModal').show();
  }

  async function loadPopIpPools(form, pop) {
    const selectors = [
      { element: form && form.querySelector('#fprPppoeIpPool'), value: String(pop && pop.pppoe_ip_pool || '').trim() },
      { element: form && form.querySelector('#fprHotspotIpPool'), value: String(pop && pop.hotspot_ip_pool || '').trim() }
    ];
    if (selectors.some(function (item) { return !item.element; })) throw new Error('Service-specific POP IP Pool selectors are unavailable.');
    selectors.forEach(function (item) { item.element.disabled = true; item.element.innerHTML = '<option value="">None / Unassigned</option>'; });
    try {
      state.ipPools = [];
      let poolLookupAvailable = true;
      const pools = await apiRequest('/ip-pools').catch(function (error) {
        poolLookupAvailable = false;
        console.warn('[POP Admin UI] Optional MikroTik IP Pool lookup failed.', {
          event: 'pop_ip_pool_lookup_failed',
          endpoint: '/api/ip-pools',
          popId: pop && pop.id != null ? String(pop.id) : null,
          status: error && error.status != null ? error.status : null,
          errorName: error && error.name ? error.name : 'Error',
          message: error && error.message ? error.message : String(error)
        });
        return [];
      });
      if (!Array.isArray(pools)) {
        poolLookupAvailable = false;
        console.warn('[POP Admin UI] Optional MikroTik IP Pool lookup returned an invalid response.', {
          event: 'pop_ip_pool_lookup_invalid_response',
          endpoint: '/api/ip-pools',
          popId: pop && pop.id != null ? String(pop.id) : null,
          errorName: 'InvalidResponse',
          message: 'Expected an array of configured IP Pools.'
        });
      } else {
        state.ipPools = pools.filter(function (pool) {
          return pool && String(pool.name || '').trim() && !/^default(?:[-_].*)?$/i.test(String(pool.name).trim());
        }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
      }
      selectors.forEach(function (item) {
        state.ipPools.forEach(function (pool) {
          const option = document.createElement('option');
          option.value = String(pool.name);
          option.textContent = String(pool.name) + (pool.ranges ? ' — ' + String(pool.ranges) : '');
          item.element.appendChild(option);
        });
        if (item.value && !state.ipPools.some(function (pool) { return String(pool.name).toLowerCase() === item.value.toLowerCase(); })) {
          const existing = document.createElement('option');
          existing.value = item.value;
          existing.textContent = item.value + (poolLookupAvailable ? ' — current assignment (not in active pool list)' : ' — current assignment (pool list unavailable)');
          existing.dataset.currentAssignment = 'true';
          item.element.appendChild(existing);
        }
        item.element.value = item.value;
      });
    } finally {
      selectors.forEach(function (item) { item.element.disabled = false; });
    }
  }

  function openResellerModal() {
    const section = document.getElementById('view-reseller-accounts');
    const form = section && section.querySelector('#fprResellerForm');
    if (!form) throw new Error('Reseller invitation form is not ready. Refresh the view and try again.');
    form.reset();
    form.querySelector('#fprResellerFormError').innerHTML = '';
    modalInstance('fprResellerModal').show();
  }

  async function toggleRecord(kind, id, nextStatus) {
    const label = kind === 'pop' ? 'POP' : 'reseller account';
    if (!window.confirm('Set this ' + label + ' to ' + nextStatus + '? Existing customer, POP and transaction records will be preserved.')) return;
    await apiRequest('/' + (kind === 'pop' ? 'pops' : 'resellers') + '/' + encodeURIComponent(id) + '/status', {
      method: 'PATCH', body: { status: nextStatus }
    });
    if (kind === 'pop') await window.loadPopManagement();
    else await window.loadResellerAccess();
  }

  async function loadPopManagement() {
    const section = rootView('view-pop-management', 'POP Management');
    section.innerHTML = sharedStyles() + '<div class="fpr-loading"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Loading POP and reseller data…</div>';
    try {
      const results = await Promise.all([apiRequest('/pops'), apiRequest('/resellers')]);
      state.pops = Array.isArray(results[0].pops) ? results[0].pops : [];
      state.resellers = Array.isArray(results[1].resellers) ? results[1].resellers : [];
      renderPopManagement(section, '');
    } catch (error) {
      renderPopManagement(section, error.message || 'Unable to load POP data.');
      console.error('[POP Admin UI] Initial data load failed:', error);
      return false;
    }
    return true;
  }

  async function loadResellerAccess() {
    const section = rootView('view-reseller-accounts', 'Reseller Accounts & Access');
    section.innerHTML = sharedStyles() + '<div class="fpr-loading"><span class="spinner-border spinner-border-sm me-2" role="status"></span>Loading reseller and POP data…</div>';
    try {
      const results = await Promise.all([apiRequest('/resellers'), apiRequest('/pops')]);
      state.resellers = Array.isArray(results[0].resellers) ? results[0].resellers : [];
      state.pops = Array.isArray(results[1].pops) ? results[1].pops : [];
      renderResellerAccess(section, '');
    } catch (error) {
      renderResellerAccess(section, error.message || 'Unable to load reseller data.');
      console.error('[Reseller Admin UI] Initial data load failed:', error);
    }
    return true;
  }

  window.loadPopManagement = loadPopManagement;
  window.loadResellerAccess = loadResellerAccess;
})();