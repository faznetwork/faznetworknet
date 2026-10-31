'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const view = fs.readFileSync(path.join(__dirname, '..', 'views', 'reseller-customers.ejs'), 'utf8');
const script = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'reseller-customers.js'), 'utf8');
const portalController = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'resellerPortalController.js'), 'utf8');
const portalRoutes = fs.readFileSync(path.join(__dirname, '..', 'routes', 'resellerPortalRoutes.js'), 'utf8');
const customerController = fs.readFileSync(path.join(__dirname, '..', 'controllers', 'customerController.js'), 'utf8');

test('reseller form sends connection and expiry dates using the existing customer contract', () => {
  assert.match(view, /name="activationDate" type="date"/);
  assert.match(view, /id="newCustomerExpiryDate" type="hidden" name="expirationDate"/);
  assert.match(view, /id="newCustomerExpiryPreview"[^>]*readonly/);
  assert.doesNotMatch(view, /name="expirationDate" type="date"/);
  assert.match(script, /addCalendarMonths\(connection,months\)/);
  assert.match(script, /data-duration-months/);
  assert.match(script, /payload\.pop_id=popId/);
  assert.match(script, /payload\.packageProfile=packageOption\.dataset\.profile/);
  assert.match(customerController, /normalizeDate\(body\.activationDate \|\| body\.activation_date \|\| body\.connectionDate \|\| body\.connection_date\)/);
  assert.match(customerController, /normalizeDate\(body\.expirationDate \|\| body\.expiration_date\)/);
});

test('VLAN and IP Pool are display-only and browser-supplied values are removed server-side', () => {
  assert.match(view, /id="newCustomerVlan"[^>]*readonly/);
  assert.match(view, /id="newCustomerIpPool"[^>]*readonly/);
  assert.match(view, /Inherited PPPoE IP Pool/);
  assert.doesNotMatch(script, /payload\.(vlan_id|mikrotik_ip_pool|pppoe_ip_pool)\s*=/);
  assert.match(script, /p\?\.pppoe_ip_pool/);
  assert.match(script, /pppoe_enabled===true/);
  assert.match(portalController, /delete body\.vlan_id/);
  assert.match(portalController, /delete body\.mikrotik_ip_pool/);
  assert.match(portalController, /delete body\.pppoe_ip_pool/);
  assert.match(customerController, /SELECT id,reseller_id,status,pppoe_enabled,pppoe_ip_pool FROM pops WHERE id=\$1 AND status='active' FOR UPDATE/);
  assert.match(customerController, /PPPOE_SERVICE_NOT_CONFIGURED/);
  assert.match(customerController, /Number\(selectedPop\.reseller_id\) !== Number\(req\.auth\.resellerId\)/);
});

test('package catalog is mounted behind the reseller authentication and tenant-scope middleware', () => {
  assert.match(portalRoutes, /router\.use\(requireRole\(\['reseller'\]\)\)/);
  assert.match(portalRoutes, /router\.use\(loadTenantScope\)/);
  assert.match(portalRoutes, /router\.get\('\/packages', controller\.packages\)/);
  assert.match(portalController, /async function packages\(req, res\)/);
  assert.match(portalController, /FROM packages/);
});

test('customer creation is an isolated page and uses explicit HTTP 201 handling', () => {
  assert.match(view, /pageMode === 'directory'/);
  assert.match(view, /id="customerCreateForm"/);
  assert.match(script, /response\.status!==201/);
  assert.match(script, /customerCreateSuccess/);
  assert.match(script, /customerCreateError/);
});
test('customer creation UI exposes validation and user-visible result feedback', () => {
  assert.match(script, /form\.checkValidity\(\)/);
  assert.match(script, /form\.reportValidity\(\)/);
  assert.match(script, /showInvalidField\(form\)/);
  assert.match(script, /isStrictIsoDate\(expiry\)/);
  assert.match(script, /payload\.expirationDate=expiry/);
  assert.match(view, /customerCreateError/);
  assert.match(view, /customerCreateSuccess/);
  assert.match(script, /finally\s*\{\s*button\.innerHTML=/);
});


test('customer submit is not gated by asynchronous catalog loading and exposes retry feedback', () => {
  assert.doesNotMatch(view, /id="submitCustomerCreate"[^>]*disabled/);
  assert.match(view, /id="retryCustomerCatalog"/);
  assert.match(script, /Promise\.allSettled/);
  assert.match(script, /catalogStatus==='loading'/);
  assert.match(script, /catalogErrors/);
  assert.match(script, /retryCustomerCatalog/);
  assert.match(script, /button\.disabled=false/);
  assert.match(script, /workspace dependency did not load/);
});

test('customer onboarding wires submit dispatch and clears stale catalogue failure once usable data is present', () => {
  assert.match(script, /form\.addEventListener\('submit',submitCustomer\)/);
  assert.match(script, /function catalogReady\(\)\{return activePops\(\)\.length>0&&state\.packages\.length>0;\}/);
  assert.match(script, /if\(catalogReady\(\)\)[\s\S]*?state\.catalogStatus='ready'[\s\S]*?state\.catalogErrors=\[\]/);
  assert.match(script, /if\(retry\)retry\.hidden=ready/);
  assert.match(script, /newCustomerPackage'\)\.addEventListener\('change',updateExpiryPreview\)/);
  assert.match(script, /byId\('newCustomerExpiryDate'\)\.value=expiry/);
  assert.match(script, /payload\.expirationDate=expiry/);
});
