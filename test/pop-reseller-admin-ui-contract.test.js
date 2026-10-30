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
  assert.ok(admin.includes('<script src="/js/pop-reseller-admin.js?v=pop-fix-v3"></script>'));
});

test('POP UI uses stable POP totals, direct POP protection and soft status toggles only', () => {
  assert.ok(ui.includes('Total POP Customers'));
  assert.ok(ui.includes('Number(pop.customer_count || 0)'));
  assert.ok(ui.includes("const DIRECT_POP_NAME = 'FAZ Main (Direct)'"));
  assert.ok(ui.includes("pop.name !== DIRECT_POP_NAME"));
  assert.ok(ui.includes("method: 'PATCH', body: { status: nextStatus }"));
  assert.ok(ui.includes("if (!id || String(current.reseller_id || '') !== String(owner || '')) payload.reseller_id = owner;"));
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
  assert.ok(ui.includes("method: id ? 'PUT' : 'POST'"));
  assert.ok(ui.includes("apiRequest('/pops' + (id ? '/' + encodeURIComponent(id) : '')"));
});

test('POP save failures preserve the modal and expose field-level and toast feedback', () => {
  assert.ok(ui.includes("if (saveError.field)"));
  assert.ok(ui.includes('mapPopFieldErrors(saveError, form)'));
  assert.ok(ui.includes('field.classList.add(\'is-invalid\')'));
  assert.ok(ui.includes("showToast(saveError.message || 'Unable to save POP. Please try again.', 'danger')"));
  assert.ok(ui.includes("closeModal('fprPopModal')"));
  const saveCatch = ui.slice(ui.indexOf('} catch (saveError) {'), ui.indexOf("closeModal('fprPopModal')"));
  assert.ok(saveCatch.includes('return;'));
  assert.ok(!saveCatch.includes("closeModal('fprPopModal')"));
});

test('POP submit lifecycle blocks duplicate submissions and always restores the save button', () => {
  assert.ok(ui.includes("if (form.dataset.submitting === '1') return;"));
  assert.ok(ui.includes("form.dataset.submitting = '1'"));
  assert.ok(ui.includes("submit.disabled = true"));
  assert.ok(ui.includes("delete form.dataset.submitting"));
  assert.ok(ui.includes("submit.disabled = false"));
  assert.ok(ui.includes("submit.removeAttribute('aria-busy')"));
});

test('POP insert success and table reload failure are reported as separate outcomes', () => {
  assert.ok(ui.includes("showToast(id ? 'POP updated successfully.' : 'POP created successfully.', 'success')"));
  assert.ok(ui.includes('const reloaded = await window.loadPopManagement();'));
  assert.ok(ui.includes('if (reloaded === false)'));
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

test('POP and reseller form submissions use stable document-level delegation with a native-validation-safe button fallback', () => {
  assert.ok(ui.includes("document.addEventListener('submit', async function (event) {"));
  assert.ok(!ui.includes("section.addEventListener('submit'"));
  assert.ok(ui.includes("document.addEventListener('click', function (event)"));
  assert.ok(ui.includes("closest('#fprPopSave, [data-action=\"save-pop\"]')"));
  assert.ok(ui.includes("form.requestSubmit()"));
  assert.ok(ui.includes("event.preventDefault();"));
  assert.ok(ui.includes("id=\"fprPopSave\" data-action=\"save-pop\""));
});

test('POP modal closes only after an explicit successful API response with a valid POP record', () => {
  assert.ok(ui.includes("response.success !== true"));
  assert.ok(ui.includes("!response.pop || typeof response.pop !== 'object' || !response.pop.id || !response.pop.name"));
  const responseGate = ui.indexOf("if (!response || response.success !== true");
  const closeModal = ui.indexOf("closeModal('fprPopModal')");
  assert.ok(responseGate >= 0 && closeModal > responseGate);
  for (const trace of ['[POP DEBUG] Form Submit Intercepted', '[POP DEBUG] Payload dispatched', '[POP DEBUG] Response received']) {
    assert.ok(ui.includes(trace), trace + ' trace exists');
  }
});

test('Raw POP diagnostics execute before selector guards in top-level document listeners', () => {
  const clickListener = ui.indexOf("document.addEventListener('click', function (event) {");
  const submitListener = ui.indexOf("document.addEventListener('submit', async function (event) {");
  assert.ok(clickListener >= 0 && submitListener > clickListener);
  assert.ok(ui.indexOf("console.log('[POP DEBUG CLICK] Document click observed:") > clickListener);
  assert.ok(ui.indexOf("console.log('[POP DEBUG SUBMIT] Raw submit fired on element:") > submitListener);
  assert.ok(ui.indexOf("console.log('[POP DEBUG SUBMIT] Raw submit fired on element:") < ui.indexOf("if (!form || (form.id !== 'fprPopForm'"));
  assert.ok(!ui.includes('function bindGlobalFormLifecycle'));
});

test('POP modal disables native focus-blocking validation and validates its required name explicitly', () => {
  assert.ok(ui.includes('<form id="fprPopForm" novalidate>'));
  assert.ok(ui.includes("const nameField = form.elements.namedItem('name');"));
  assert.ok(ui.includes("!String(nameField.value || '').trim()"));
  assert.ok(ui.includes("nameField.classList.add('is-invalid')"));
  assert.ok(ui.includes("showToast(message, 'danger')"));
});

test('POP modal event fallback targets the active modal and stale modal instances are removed before rendering', () => {
  assert.ok(ui.includes("document.querySelector('#fprPopModal.show, #fprPopModal')"));
  assert.ok(ui.includes("activeModal.querySelector('form#fprPopForm')"));
  assert.ok(ui.includes("document.querySelectorAll('#fprPopModal').forEach"));
  assert.ok(ui.includes("if (instance) instance.dispose();"));
  assert.ok(ui.includes("element.remove();"));
});

test('POP admin asset uses a new cache-busting version and announces the loaded build', () => {
  assert.ok(admin.includes('<script src="/js/pop-reseller-admin.js?v=pop-fix-v3"></script>'));
  assert.ok(ui.startsWith("console.log('>>> RUNNING LATEST POP-RESELLER-ADMIN.JS BUILD V3 <<<');"));
});

test('POP save click falls back to a bubbling submit event when requestSubmit is unavailable or not intercepted', () => {
  assert.ok(ui.includes("delete form.dataset.fprSubmitIntercepted;"));
  assert.ok(ui.includes("form.requestSubmit();"));
  assert.ok(ui.includes("if (form.dataset.fprSubmitIntercepted !== '1')"));
  assert.ok(ui.includes("new Event('submit', { bubbles: true, cancelable: true })"));
  assert.ok(ui.includes("form.dispatchEvent(fallbackSubmitEvent);"));
  assert.ok(ui.includes("form.dataset.fprSubmitIntercepted = '1';"));
});
