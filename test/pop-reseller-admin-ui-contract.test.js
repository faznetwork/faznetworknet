'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminPath = path.join(__dirname, '..', 'views', 'admin.ejs');
const modulePath = path.join(__dirname, '..', 'public', 'js', 'pop-reseller-admin.js');
const admin = fs.readFileSync(adminPath, 'utf8');
const ui = fs.readFileSync(modulePath, 'utf8');

test('Sub-Staff navigation remains intact and separate from POP/reseller navigation', () => {
  assert.ok(admin.includes('<li><a href="/admin/resellers/sub-staff"><span data-key="sub_staff">Sub-Staff</span></a></li>'));
  assert.ok(admin.includes('href="/admin/network/pop-management"'));
  assert.ok(admin.includes('href="/admin/resellers/accounts"'));
  assert.ok(admin.indexOf('href="/admin/network/pop-management"') > admin.indexOf('href="/admin/resellers/sub-staff"'));
});

test('POP and reseller routes are registered in the existing SPA route lifecycle', () => {
  assert.ok(admin.includes("if (route.view === 'pop-management') return { view: 'pop-management' };"));
  assert.ok(admin.includes("if (route.view === 'reseller-accounts') return { view: 'reseller-accounts' };"));
  assert.ok(admin.includes("'/admin/network/pop-management': { view: 'pop-management' }"));
  assert.ok(admin.includes("'/admin/resellers/accounts': { view: 'reseller-accounts' }"));
  assert.ok(admin.includes("if (normalized.view === 'pop-management') return '/admin/network/pop-management';"));
  assert.ok(admin.includes("if (normalized.view === 'reseller-accounts') return '/admin/resellers/accounts';"));
  assert.ok(admin.includes("case 'pop-management': return callIfAvailable('loadPopManagement');"));
  assert.ok(admin.includes("case 'reseller-accounts': return callIfAvailable('loadResellerAccess');"));
  assert.ok(admin.includes('<script src="/js/pop-reseller-admin.js?v=pop-dual-pool-v12"></script>'));
});

test('POP UI uses stable POP totals, direct POP protection and soft status toggles only', () => {
  assert.ok(ui.includes('Total POP Customers'));
  assert.ok(ui.includes('Number(pop.customer_count || 0)'));
  assert.ok(!ui.includes('DIRECT_POP_NAME'));
  assert.ok(!ui.includes('FAZ Main (Direct)'));
  assert.ok(ui.includes("const owner = pop.reseller_name || '—';"));
  assert.ok(ui.includes("state.pops.reduce(function (sum, pop) { return sum + Number(pop.customer_count || 0); }, 0)"));
  assert.ok(ui.includes("method: 'PATCH', body: { status: nextStatus }"));
  assert.ok(ui.includes("if (current && Number(current.customer_count || 0) > 0 && String(current.reseller_id || '') !== String(resellerId || ''))"));
  assert.ok(ui.includes("option.textContent = (currentOwner ? currentOwner.name : (pop.reseller_name || 'Current reseller')) + ' — current owner';"));
  assert.ok(!/method\s*:\s*['"]DELETE['"]/i.test(ui));
  assert.ok(!/api\/pops\/[^'"]+['"]\s*,\s*\{\s*method\s*:\s*['"]DELETE/i.test(ui));
});

test('Reseller UI consumes assigned POP projection and invitation lifecycle actions', () => {
  for (const status of ['pending', 'active', 'expired', 'inactive']) assert.ok(ui.includes(status));
  assert.ok(ui.includes('reseller.assigned_pops'));
  assert.ok(ui.includes("apiRequest('/resellers/invite'"));
  assert.ok(ui.includes("'/resellers/' + encodeURIComponent(id) + '/resend-invite'"));
  assert.ok(ui.includes("'/resellers/' + encodeURIComponent(id) + '/cancel-invite'"));
  assert.ok(ui.includes('assigned_pop_ids:'));
});

test('UI exposes API failures and prevents activation before invitation acceptance', () => {
  assert.ok(ui.includes('role="alert"'));
  assert.ok(ui.includes("console.error('[POP/Reseller Admin UI]"));
  assert.ok(ui.includes("This invitation must be accepted and a password set before activation."));
  assert.ok(ui.includes('spinner-border'));
});


test('Admin customer directory exposes a POP filter and ownership badges without a duplicate reseller filter', () => {
  assert.ok(admin.includes('id="customerPopFilter"'));
  assert.ok(admin.includes('data-pop-id='));
  assert.ok(admin.includes('data-reseller-id='));
  assert.ok(admin.includes('matchesStatus&&matchesSearch&&matchesPop'));
  assert.ok(!admin.includes('id="customerResellerFilter"'));
  assert.ok(admin.includes('networkBadges'));
});

test('Admin Customer 360 network card is informational and uses the POP projection', () => {
  for (const field of ['cpPopName', 'cpResellerName', 'cpVlanId', 'cpMikrotikPool', 'cpCommissionType', 'cpCommissionRate']) {
    assert.ok(admin.includes('id="' + field + '"'), field + ' card field exists');
  }
  assert.ok(admin.includes('Informational only'));
  assert.ok(admin.includes('customer.commission_rate'));
  assert.ok(admin.includes('customer.pop_name'));
});

test('Customer directory and Customer 360 add only read-only POP/reseller joins', () => {
  const controller = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'customerController.js'), 'utf8');
  assert.ok(controller.includes('LEFT JOIN pops pop ON pop.id=c.pop_id'));
  assert.ok(controller.includes('LEFT JOIN resellers reseller ON reseller.id=pop.reseller_id'));
  assert.ok(controller.includes('FROM pops p LEFT JOIN resellers r ON r.id=p.reseller_id'));
  assert.ok(controller.includes('commission_type'));
  assert.ok(controller.includes('mikrotik_ip_pool'));
});


test('POP create serializes every API contract field, including an explicit reseller assignment', () => {
  const fields = ['name', 'area_zone', 'reseller_id', 'vlan_id', 'pppoe_enabled', 'pppoe_ip_pool', 'commission_type', 'commission_rate'];
  for (const field of fields) {
    assert.match(ui, new RegExp('\\b' + field + ':'));
  }
  assert.ok(ui.includes("const method = popId ? 'PUT' : 'POST';"));
  assert.ok(ui.includes("apiRequest(endpoint, { method: method, body: payload })"));
});

test('POP save failures preserve the modal and expose field-level and toast feedback', () => {
  assert.ok(ui.includes("mapPopFieldErrors(error, container)"));
  assert.ok(ui.includes("field.classList.add('is-invalid')"));
  assert.ok(ui.includes("showToast(error.message || 'Unable to save POP. Please try again.', 'danger')"));
  assert.ok(ui.includes("closeModal('fprPopModal')"));
});

test('POP submit lifecycle blocks duplicate submissions and always restores the save button', () => {
  assert.ok(ui.includes("if (form.dataset.submitting === '1') return;"));
  assert.ok(ui.includes("form.dataset.submitting = '1'"));
  assert.ok(ui.includes("saveBtn.disabled = true"));
  assert.ok(ui.includes("delete form.dataset.submitting"));
  assert.ok(ui.includes("saveBtn.disabled = false"));
  assert.ok(ui.includes("saveBtn.removeAttribute('aria-busy')"));
});

test('POP insert success and table reload failure are reported as separate outcomes', () => {
  assert.ok(ui.includes("showToast(popId ? 'POP and Hotspot settings updated successfully.' : 'POP created successfully.', 'success')"));
  assert.ok(ui.includes("showToast('POP saved, but Hotspot settings were not saved. Review the Hotspot Server and IP Pool, then retry.', 'warning')"));
  assert.ok(ui.includes('const refreshed = await window.loadPopManagement();'));
  assert.ok(ui.includes('if (refreshed === false)'));
  assert.ok(ui.includes('POP was saved, but the POP table could not be refreshed.'));
  const reloadFailure = ui.indexOf("renderPopManagement(section, error.message || 'Unable to load POP data.')");
  assert.ok(reloadFailure >= 0);
  assert.ok(ui.indexOf('return false;', reloadFailure) > reloadFailure);
});

test('POP API errors retain HTTP status and structured validation details for UI mapping', () => {
  assert.ok(ui.includes('requestError.status = response.status'));
  assert.ok(ui.includes('requestError.payload = payload'));
  assert.ok(ui.includes('payload.errors || payload.validationErrors || payload.details'));
  assert.ok(ui.includes("['commission_rate', /commission_rate|commission rate|commission.*rate/i]"));
});

test('POP save uses a direct click handler and preserves the reseller submit lifecycle', () => {
  assert.ok(ui.includes("document.addEventListener('click', function (event) {"));
  assert.ok(ui.includes("target.closest ? target.closest('#fprPopSave') : null"));
  assert.ok(ui.includes('async function savePopForm(form, saveBtn, container)'));
  assert.ok(ui.includes("const response = await apiRequest(endpoint, { method: method, body: payload });"));
  assert.ok(ui.includes("const refreshed = await window.loadPopManagement();") || ui.includes("const refreshed = await window.loadPopManagement();"));
  assert.ok(ui.includes("saveBtn.closest('form')"));
  assert.ok(ui.includes("if (form.id === 'fprPopForm')"));
  assert.ok(ui.includes("event.stopImmediatePropagation();"));
  assert.ok(ui.includes("document.addEventListener('submit', async function (event) {"));
  assert.ok(ui.includes("if (!form || form.id !== 'fprResellerForm') return;"));
  assert.ok(!ui.includes('requestSubmit()'));
  assert.ok(!ui.includes('fprSubmitIntercepted'));
});

test('POP modal closes only after an explicit successful API response with a valid POP record', () => {
  assert.ok(ui.includes("response.success !== true"));
  assert.ok(ui.includes("!response.pop || typeof response.pop !== 'object' || !response.pop.id || !response.pop.name"));
  const responseGate = ui.indexOf("if (!response || response.success !== true");
  const closeModal = ui.indexOf("closeModal('fprPopModal')");
  assert.ok(responseGate >= 0 && closeModal > responseGate);
});

test('POP modal disables native focus-blocking validation and validates its required name explicitly', () => {
  assert.ok(ui.includes('<form id="fprPopForm" novalidate>'));
  assert.ok(ui.includes("const nameInput = container.querySelector('[name=\"name\"]');"));
  assert.ok(ui.includes("if (!name)"));
  assert.ok(ui.includes("nameInput.classList.add('is-invalid')"));
  assert.ok(ui.includes("showToast('POP Name is required', 'danger')"));
});

test('POP admin asset uses the direct-save cache version and announces the loaded build', () => {
  assert.ok(admin.includes('<script src="/js/pop-reseller-admin.js?v=pop-dual-pool-v12"></script>'));
  assert.ok(ui.startsWith("console.log('>>> RUNNING DUAL-SERVICE POP ADMIN BUILD V10 <<<');"));
});

test('POP click handler reads controls directly and dispatches create or update without page reload', () => {
  for (const selector of ["[name=\"name\"]", "[name=\"area_zone\"]", "[name=\"reseller_id\"]", "[name=\"vlan_id\"]", "[name=\"pppoe_ip_pool\"]", "[name=\"commission_type\"]", "[name=\"commission_rate\"]", "[name=\"id\"]"]) {
    assert.ok(ui.includes("container.querySelector('" + selector + "')"), selector + ' is read from the resolved editor container');
  }
  assert.ok(ui.includes("const endpoint = '/pops' + (popId ? '/' + encodeURIComponent(popId) : '');"));
  assert.ok(ui.includes("const method = popId ? 'PUT' : 'POST';"));
  assert.ok(ui.includes("await window.loadPopManagement();"));
  assert.ok(!ui.includes('location.reload()'));
  assert.ok(!ui.includes('loadPopDirectory'));
});

test('POP save resolves a form from the clicked button and falls back to open modal fields', () => {
  assert.ok(ui.includes("saveBtn.closest('form')"));
  assert.ok(ui.includes('|| saveBtn.form'));
  assert.ok(ui.includes("|| document.getElementById('fprPopForm')"));
  assert.ok(ui.includes("|| document.querySelector('.modal.show form')"));
  assert.ok(ui.includes("|| document.querySelector('#fprPopModal form')"));
  assert.ok(ui.includes("document.querySelector('.modal.show .modal-body')"));
  assert.ok(ui.includes("document.querySelector('#fprPopModal .modal-body')"));
  assert.ok(ui.includes('savePopForm(form, saveBtn, container)'));
  assert.ok(ui.includes("container.querySelector('[name=\"name\"]')"));
  assert.ok(ui.includes("container.querySelector('[name=\"id\"]')"));
  assert.ok(ui.includes('mapPopFieldErrors(error, container)'));
});

test('POP IP Pool editor loads configured MikroTik pools dynamically and preserves the current assignment', () => {
  assert.ok(ui.includes('id="fprPppoeIpPool"'));
  assert.ok(ui.includes('name="pppoe_ip_pool" id="fprPppoeIpPool"'));
  assert.ok(ui.includes('name="hotspot_ip_pool" id="fprHotspotIpPool"'));
  assert.ok(ui.includes('name="pppoe_enabled" id="fprPppoeEnabled"'));
  assert.ok(ui.includes('name="hotspot_enabled" id="fprHotspotEnabled"'));
  assert.ok(!ui.includes('name="mikrotik_ip_pool" id="fprPopIpPool"'));
  assert.ok(ui.includes("const pools = await apiRequest('/ip-pools').catch(function (error) {"));
  assert.ok(ui.includes("item.element.innerHTML = '<option value=\"\">None / Unassigned</option>';"));
  assert.ok(ui.includes("await loadPopIpPools(form, pop);"));
  assert.ok(ui.includes('item.element.value = item.value;'));
  assert.ok(ui.includes('current assignment (not in active pool list)'));
  assert.ok(ui.includes('state.ipPools = [];'));
  assert.ok(ui.includes('pppoe_ip_pool: pppoePoolInput && pppoePoolInput.value ? pppoePoolInput.value : null'));
  assert.ok(ui.includes('payload.hotspot_ip_pool = currentHotspot.pool;'));
  assert.ok(ui.includes('payload.hotspot_server = currentHotspot.server;'));
  assert.ok(ui.includes('payload.hotspot_interface = currentHotspot.interface;'));
  assert.ok(ui.includes('payload.hotspot_vlan_id = currentHotspot.vlanId;'));
  assert.ok(ui.includes('pop.hotspot_ip_pool'));
  assert.ok(ui.includes('pop.pppoe_ip_pool'));
  assert.ok(ui.includes('pop.hotspot_enabled'));
  assert.ok(ui.includes('pop.pppoe_enabled'));
  assert.ok(admin.includes('pop-dual-pool-v12'));
});


test('POP service pools remain segregated and legacy pool is not rendered as a shared assignment', () => {
  assert.ok(ui.includes('PPPoE IP Pool'));
  assert.ok(ui.includes('Hotspot IP Pool'));
  assert.ok(ui.includes('Used only for PPPoE subscriber address assignment.'));
  assert.ok(ui.includes('is never reused for PPPoE.'));
  assert.ok(!ui.includes('pop.mikrotik_ip_pool'));
  const controller = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'popController.js'), 'utf8');
  assert.ok(controller.includes('pppoe_ip_pool'));
  assert.ok(controller.includes("hb.data->>'ip_pool' AS hotspot_ip_pool"));
  assert.ok(controller.includes('status=\'inactive\''));
  const migration = fs.readFileSync(path.join(__dirname, '..', 'db', 'migrations', '20261031_dual_service_pop_ip_pools.sql'), 'utf8');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS pppoe_ip_pool/);
  assert.match(migration, /SET pppoe_ip_pool = NULLIF\(BTRIM\(mikrotik_ip_pool\)/);
  assert.doesNotMatch(migration, /\\bDROP\\s+(TABLE|COLUMN)\\b/i);
});


test('optional POP IP Pool lookup failure is structured, non-blocking, and does not emit toast spam', () => {
  const lookupStart = ui.indexOf('async function loadPopIpPools(form, pop)');
  const lookupEnd = ui.indexOf('function openResellerModal()', lookupStart);
  assert.ok(lookupStart >= 0 && lookupEnd > lookupStart);
  const lookup = ui.slice(lookupStart, lookupEnd);
  assert.ok(lookup.includes("console.warn('[POP Admin UI] Optional MikroTik IP Pool lookup failed.'"));
  assert.ok(lookup.includes("event: 'pop_ip_pool_lookup_failed'"));
  assert.ok(lookup.includes("endpoint: '/api/ip-pools'"));
  assert.ok(lookup.includes("popId: pop && pop.id != null ? String(pop.id) : null"));
  assert.ok(lookup.includes('current assignment (pool list unavailable)'));
  assert.ok(lookup.includes('state.ipPools = [];'));
  assert.ok(lookup.includes(".catch(function (error) {"));
  assert.ok(!lookup.includes('showToast('));
  assert.ok(lookup.includes('finally {'));
});


test('POP bootstrap failures remain inline and never emit action toasts', () => {
  const start = ui.indexOf('async function loadPopManagement()');
  const end = ui.indexOf('async function loadResellerAccess()', start);
  assert.ok(start >= 0 && end > start);
  assert.ok(!ui.slice(start, end).includes('showToast('));
  const resellerEnd = ui.indexOf('window.loadPopManagement = loadPopManagement;', end);
  assert.ok(resellerEnd > end);
  assert.ok(!ui.slice(end, resellerEnd).includes('showToast('));
});

test('optional POP IP Pool lookup defaults to an empty list and only warns', () => {
  const start = ui.indexOf('async function loadPopIpPools(form, pop)');
  const end = ui.indexOf('function openResellerModal()', start);
  assert.ok(start >= 0 && end > start);
  const lookup = ui.slice(start, end);
  assert.ok(lookup.includes('state.ipPools = [];'));
  assert.ok(lookup.includes(".catch(function (error) {"));
  assert.ok(lookup.includes("event: 'pop_ip_pool_lookup_failed'"));
  assert.ok(lookup.includes("console.warn('[POP Admin UI] Optional MikroTik IP Pool lookup failed.'"));
  assert.ok(!lookup.includes('showToast('));
  assert.ok(!lookup.includes('errorBanner('));
});

test('POP action failures remain toast-visible only inside the explicit action handler', () => {
  const start = ui.indexOf("section.addEventListener('click', async function (event) {");
  const end = ui.indexOf('function savePopForm(', start);
  assert.ok(start >= 0 && end > start);
  assert.ok(ui.slice(start, end).includes("showToast(error.message || 'The requested action failed.', 'danger')"));
});

test('POP directory uses a dedicated numeric ID column and clean POP name column', () => {
  assert.ok(ui.includes('const rows = state.pops.map(function (pop, index) {'));
  assert.ok(ui.includes(`'<td class="text-secondary">' + (index + 1) + '</td>' +`));
  assert.ok(!ui.includes(`'<td class="text-secondary fw-semibold">' + escapeHtml(pop.id) + '</td>' +`));
  assert.ok(ui.includes(`'<td><strong>' + escapeHtml(pop.name) + '</strong></td>' +`));
  assert.ok(ui.includes('<th>#</th><th>Name</th>'));
  assert.ok(ui.includes('colspan="16"'));
  assert.ok(ui.includes('fpr-metric--pops'));
  assert.ok(ui.includes('fpr-metric--customers'));
  assert.ok(ui.includes('fpr-metric--resellers'));
  assert.ok(!ui.includes('linear-gradient(135deg,#f5f3ff,#fffbeb)'));
});

test('POP and reseller typography uses the approved semantic weight hierarchy', () => {
  const stylesStart = ui.indexOf('function sharedStyles()');
  const stylesEnd = ui.indexOf('function renderPopManagement', stylesStart);
  const styles = ui.slice(stylesStart, stylesEnd);
  assert.ok(styles.includes('fpr-metric-label{font-size:12px;color:#fff;font-weight:500'));
  assert.ok(styles.includes('fpr-metric-value{font-size:clamp(22px,3vw,30px);font-weight:500;color:#fff'));
  assert.ok(styles.includes('fpr-metric--pops{background:#397568}'));
  assert.ok(styles.includes('fpr-metric--customers{background:#4f7953}'));
  assert.ok(styles.includes('fpr-metric--resellers{background:#317c7a}'));
  assert.ok(styles.includes('.fpr-metric:hover{background:#64748b'));
  assert.ok(!styles.includes('linear-gradient'));
  assert.ok(styles.includes('fpr-table th{font-size:11px;font-weight:600'));
  assert.ok(styles.includes('fpr-table td{vertical-align:middle;font-weight:400'));
  assert.ok(styles.includes('.form-label{font-size:13px;font-weight:500'));
  const workspaceCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'reseller-workspace.css'), 'utf8');
  assert.ok(workspaceCss.includes('body{background:var(--fzn-bg);color:var(--fzn-ink);font-family:var(--reseller-font);font-size:14px;font-weight:400'));
  assert.ok(workspaceCss.includes('.metric-label{font-size:.75rem;color:var(--fzn-muted);font-weight:500'));
  assert.ok(workspaceCss.includes('.metric-value{min-width:0;overflow-wrap:anywhere;font-size:1.65rem;line-height:1.25;font-weight:700'));
  assert.ok(workspaceCss.includes('.table thead th{font-weight:600;font-size:.69rem'));
  assert.ok(workspaceCss.includes('.table tbody td{font-weight:400;vertical-align:middle;font-size:.82rem'));
  const profile = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-customer-profile.ejs'), 'utf8');
  assert.ok(profile.includes('.section-title{font-size:1.125rem;line-height:1.35;font-weight:600'));
  assert.ok(profile.includes('font-size:14px;font-weight:400;line-height:1.55'));
  assert.ok(profile.includes('.label{font-size:.7rem;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:500'));
  assert.ok(profile.includes('.value{font-weight:400'));
  assert.ok(profile.includes('font-family:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif'));
  assert.ok(!profile.includes("Plus Jakarta Sans"));
});


test('POP save surfaces Hotspot persistence failures and refreshes the directory', () => {
  assert.ok(ui.includes('response.hotspot_persisted === false'));
  assert.ok(ui.includes('Hotspot settings were not saved'));
  assert.ok(ui.includes('const refreshed = await window.loadPopManagement();'));
  assert.ok(ui.includes('payload.hotspot_vlan_id = currentHotspot.vlanId;'));
});

test('Admin and shared portal shells use Inter as the UI font', () => {
  const fontStack = "'Inter', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif";
  assert.ok(admin.includes('family=Inter'));
  assert.ok(admin.includes(fontStack));
  assert.ok(!admin.includes('Plus Jakarta Sans'));
  const layout = fs.readFileSync(path.join(__dirname, '..', 'views', 'layout.ejs'), 'utf8');
  assert.ok(layout.includes('family=Inter'));
  assert.ok(layout.includes(fontStack));
});

test('POP modal form controls use full-width layout and balanced one-rem gutters', () => {
  assert.ok(ui.includes('#fprPopModal .modal-body{padding:1.5rem}'));
  assert.ok(ui.includes('--bs-gutter-x:1rem;--bs-gutter-y:1rem'));
  assert.ok(ui.includes('#fprPopModal .form-control,.faz-pop-reseller-view #fprPopModal .form-select{display:block;width:100%;min-width:0;box-sizing:border-box}'));
});

test('POP editor preserves established Hotspot state and sends only intentional binding changes', () => {
  assert.ok(ui.includes("form.dataset.hotspotInitial = JSON.stringify({"));
  assert.ok(ui.includes("const initialHotspot = form && form.dataset.hotspotInitial"));
  assert.ok(ui.includes("if (currentHotspot.enabled !== initialHotspot.enabled)"));
  assert.ok(ui.includes("if (currentHotspot.enabled) {"));
  assert.ok(ui.includes("payload.hotspot_enabled = currentHotspot.enabled;"));
  assert.ok(ui.includes("if (currentHotspot.pool !== initialHotspot.pool) payload.hotspot_ip_pool = currentHotspot.pool;"));
  assert.ok(ui.includes("if (currentHotspot.interface !== initialHotspot.interface) payload.hotspot_interface = currentHotspot.interface;"));
});


test('Admin POP summary cards use distinct solid surfaces and the directory serial is 1-based', () => {
  const stylesStart = ui.indexOf('function sharedStyles()');
  const stylesEnd = ui.indexOf('function renderPopManagement', stylesStart);
  const styles = ui.slice(stylesStart, stylesEnd);
  assert.ok(styles.includes('.fpr-metric--pops{background:#397568}'));
  assert.ok(styles.includes('.fpr-metric--customers{background:#4f7953}'));
  assert.ok(styles.includes('.fpr-metric--resellers{background:#317c7a}'));
  assert.ok(styles.includes('.fpr-metric-label{font-size:12px;color:#fff;font-weight:500'));
  assert.ok(styles.includes('.fpr-metric-value{font-size:clamp(22px,3vw,30px);font-weight:500;color:#fff'));
  assert.doesNotMatch(styles, /\.fpr-metric--(?:pops|customers|resellers)\{[^}]*linear-gradient/i);
  const renderStart = ui.indexOf('function renderPopManagement');
  const renderEnd = ui.indexOf('function popModalHtml', renderStart);
  const render = ui.slice(renderStart, renderEnd);
  for (const label of ['Total POPs', 'Total POP Customers', 'Total Resellers']) assert.ok(render.includes(label));
  assert.ok(render.includes("'<td class=\"text-secondary\">' + (index + 1) + '</td>'"));
  assert.ok(!render.includes("'<td class=\"text-secondary\">' + index + '</td>'"));
});

test('Reseller workspace uses one shared panel gutter and consolidated Inter typography roles', () => {
  const workspaceCss = fs.readFileSync(path.join(__dirname, '..', 'public', 'css', 'reseller-workspace.css'), 'utf8');
  assert.ok(workspaceCss.includes('--reseller-panel-gutter:24px'));
  assert.ok(workspaceCss.includes('padding:20px var(--reseller-panel-gutter) 0'));
  assert.ok(workspaceCss.includes('padding:0 var(--reseller-panel-gutter) 20px'));
  assert.ok(workspaceCss.includes('.reseller-panel.reseller-assigned-pops{padding:24px}'));
  assert.ok(workspaceCss.includes('.reseller-panel.reseller-assigned-pops>.reseller-section-heading{padding:0'));
  assert.ok(workspaceCss.includes('--reseller-panel-gutter:16px'));
  assert.ok(workspaceCss.includes('--reseller-panel-gutter:12px'));
  assert.ok(!workspaceCss.includes('/* Shared reseller page grid and typography roles. */'));
  assert.ok(workspaceCss.includes('font-family:var(--reseller-font);font-size:var(--reseller-body-size)'));
});
