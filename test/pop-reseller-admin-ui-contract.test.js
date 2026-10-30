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
  assert.ok(admin.includes('<script src="/js/pop-reseller-admin.js?v=pop-ip-pool-v5"></script>'));
});

test('POP UI uses stable POP totals, direct POP protection and soft status toggles only', () => {
  assert.ok(ui.includes('Total POP Customers'));
  assert.ok(ui.includes('Number(pop.customer_count || 0)'));
  assert.ok(ui.includes("const DIRECT_POP_NAME = 'FAZ Main (Direct)'"));
  assert.ok(ui.includes("pop.name !== DIRECT_POP_NAME"));
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


test('Admin customer directory exposes composable POP and reseller filters and badges', () => {
  assert.ok(admin.includes('id="customerPopFilter"'));
  assert.ok(admin.includes('id="customerResellerFilter"'));
  assert.ok(admin.includes('data-pop-id='));
  assert.ok(admin.includes('data-reseller-id='));
  assert.ok(admin.includes('matchesStatus&&matchesSearch&&matchesPop&&matchesReseller'));
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
  const fields = ['name', 'area_zone', 'reseller_id', 'vlan_id', 'mikrotik_ip_pool', 'commission_type', 'commission_rate'];
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
  assert.ok(ui.includes("showToast(popId ? 'POP updated successfully.' : 'POP created successfully.', 'success')"));
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
  assert.ok(admin.includes('<script src="/js/pop-reseller-admin.js?v=pop-ip-pool-v5"></script>'));
  assert.ok(ui.startsWith("console.log('>>> RUNNING LATEST POP-RESELLER-ADMIN.JS BUILD V5 <<<');"));
});

test('POP click handler reads controls directly and dispatches create or update without page reload', () => {
  for (const selector of ["[name=\"name\"]", "[name=\"area_zone\"]", "[name=\"reseller_id\"]", "[name=\"vlan_id\"]", "[name=\"mikrotik_ip_pool\"]", "[name=\"commission_type\"]", "[name=\"commission_rate\"]", "[name=\"id\"]"]) {
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
  assert.ok(ui.includes('id="fprPopIpPool"'));
  assert.ok(ui.includes('name="mikrotik_ip_pool" id="fprPopIpPool"'));
  assert.ok(!ui.includes('name="mikrotik_ip_pool" maxlength="150"'));
  assert.ok(ui.includes("const pools = await apiRequest('/ip-pools');"));
  assert.ok(ui.includes("select.innerHTML = '<option value=\"\">None / Unassigned</option>';"));
  assert.ok(ui.includes("await loadPopIpPools(form, pop);"));
  assert.ok(ui.includes("select.value = selectedName;"));
  assert.ok(ui.includes('current assignment (not in active pool list)'));
  assert.ok(ui.includes('Existing POP assignment was preserved.'));
  assert.ok(ui.includes('mikrotik_ip_pool: poolInput && poolInput.value ? poolInput.value : null'));
  assert.ok(admin.includes('pop-ip-pool-v5'));
});
