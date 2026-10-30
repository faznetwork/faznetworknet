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
  assert.doesNotMatch(script, /payload\.(vlan_id|mikrotik_ip_pool)\s*=/);
  assert.match(portalController, /delete body\.vlan_id/);
  assert.match(portalController, /delete body\.mikrotik_ip_pool/);
  assert.match(customerController, /SELECT id,reseller_id,status FROM pops WHERE id=\$1 AND status='active' FOR UPDATE/);
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
  assert.match(script, /form\.reportValidity\(\)/);
  assert.match(view, /customerCreateError/);
  assert.match(view, /customerCreateSuccess/);
  assert.match(script, /finally \{ button\.innerHTML=/);
});
