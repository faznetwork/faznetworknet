'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const scope=require('../middleware/tenantScope');
const root=path.join(__dirname,'..');

test('reseller tenant scope permits only POPs owned by the authenticated reseller',()=>{
 const a=scope.buildTenantScope('reseller',41,[101,102]);
 assert.equal(scope.customerBelongsToScope({pop_id:101},a),true);
 assert.equal(scope.customerBelongsToScope({pop_id:102},a),true);
 assert.equal(scope.customerBelongsToScope({pop_id:201},a),false);
 assert.equal(scope.customerBelongsToScope({pop_id:null},a),false);
});
test('missing or invalid reseller identity fails closed',()=>{
 assert.throws(()=>scope.buildTenantScope('reseller',null,[]),e=>e.statusCode===403);
 assert.throws(()=>scope.buildTenantScope('reseller','not-an-id',[]),e=>e.statusCode===403);
});
test('super admin and admin retain unrestricted customer access',()=>{
 for(const role of ['super_admin','admin']){
  const tenant=scope.buildTenantScope(role,null);
  assert.equal(tenant.global,true);
  assert.equal(scope.customerBelongsToScope({pop_id:987654},tenant),true);
 }
});
test('staff read scope remains global for backward-compatible read-only access',()=>{
 const tenant=scope.buildTenantScope('staff',null);
 assert.equal(tenant.global,true);
});
test('customer list and live-session fallback apply reseller POP scoping',()=>{
 const source=fs.readFileSync(path.join(root,'controllers/customerController.js'),'utf8');
 assert.match(source,/c\.pop_id\s*=\s*ANY\(\$1::bigint\[\]\)/);
 const liveSession = source.slice(source.indexOf('async function getCustomerLiveSession'), source.indexOf('function usageDate'));
 assert.match(liveSession, /pop_id=ANY\(\$2::bigint\[\]\)/);
});
test('Customer 360, live metrics, and usage retrieval carry the authenticated POP predicate',()=>{
 const source=fs.readFileSync(path.join(root,'controllers/customerController.js'),'utf8');
 assert.match(source,/async function resolveCustomer360\(idValue,tenantScope\)/);
 assert.match(source,/AND \(\$2::bigint\[\] IS NULL OR pop_id=ANY\(\$2::bigint\[\]\)\)/);
 assert.match(source,/resolveCustomer360\(req\.params\.id,req\.tenantScope\)/);
});
test('ownership middleware rejects mismatched route and body customer identifiers',()=>{
 const source=fs.readFileSync(path.join(root,'middleware/tenantScope.js'),'utf8');
 assert.match(source,/const key=String\(req\.params\?\.id\?\?req\.query\?\.username\?\?req\.body\?\.id\?\?req\.body\?\.username/);
 const routes=fs.readFileSync(path.join(root,'routes/customerRoutes.js'),'utf8');
 assert.match(routes,/CUSTOMER_DELETE_IDENTITY_MISMATCH/);
});
test('customer creation remains administrator-only and assigns the canonical direct POP by default',()=>{
 const routes=fs.readFileSync(path.join(root,'routes/customerRoutes.js'),'utf8');
 const controller=fs.readFileSync(path.join(root,'controllers/customerController.js'),'utf8');
 assert.match(routes,/router\.post\('\/',requireAdminOnly,controller\.createCustomer\)/);
 assert.match(controller,/name='FAZ Main \(Direct\)' AND status='active'/);
 assert.match(controller,/customer\.popId = selectedPopResult\.rows\[0\]\.id/);
 assert.match(controller,/facebook_link, pop_id, created_at/);
});
test('POP and reseller lifecycle endpoints are soft status updates, not hard deletes',()=>{
 const pop=fs.readFileSync(path.join(root,'controllers/popController.js'),'utf8');
 const reseller=fs.readFileSync(path.join(root,'controllers/resellerController.js'),'utf8');
 assert.match(pop,/UPDATE pops SET status=\$1/);
 assert.match(reseller,/UPDATE resellers SET status=\$1/);
 assert.doesNotMatch(pop,/DELETE FROM pops/i);
 assert.doesNotMatch(reseller,/DELETE FROM resellers/i);
});
test('reseller role requires a verified server-side session ID and active database record',()=>{
 const rbac=fs.readFileSync(path.join(root,'middleware/rbac.js'),'utf8');
 assert.match(rbac,/req\.session\?\.isReseller\s*===\s*true/);
 assert.match(rbac,/req\.session\?\.resellerId\s*\?\?\s*req\.session\?\.reseller_id/);
 assert.match(rbac,/SELECT id,status FROM resellers WHERE id=\$1 LIMIT 1/);
});
