'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const db=require('../db');const controller=require('../controllers/resellerPortalController');
test('overview returns finance snapshot scoped to verified reseller id',async t=>{
 const calls=[];t.mock.method(db,'query',async(sql,values=[])=>{calls.push({sql,values});if(sql.includes('reseller_billing_accounts'))return{rows:[{id:81,billing_mode:'postpaid',wallet_balance:'0.00',credit_limit:'500.00',receivable_balance:'125.50',currency:'BDT',account_status:'active'}]};if(sql.includes('FROM pops'))return{rows:[]};if(sql.includes('FROM customers'))return{rows:[{}]};if(sql.includes('FROM transactions'))return{rows:[{}]};throw Error('Unexpected SQL '+sql)});
 let body;const res={json(x){body=x;return this},status(n){this.statusCode=n;return this}};
 await controller.overview({auth:{resellerId:41},tenantScope:{popIds:[]}},res);
 const q=calls.find(x=>x.sql.includes('SELECT id,reseller_id,billing_mode') && x.sql.includes('reseller_billing_accounts'));assert.deepEqual(q.values,[41]);assert.match(q.sql,/WHERE reseller_id=\$1/);
 assert.equal(body.billingAccount.billing_mode,'postpaid');assert.equal(body.walletBalance,'0.00');assert.equal(body.creditLimit,'500.00');assert.equal(body.receivableBalance,'125.50');assert.equal(body.availableCredit,'374.50');
});
test('overview rejects missing verified reseller identity before database access',async t=>{
 let queried=false;t.mock.method(db,'query',async()=>{queried=true;return{rows:[]}});
 let status;const res={status(n){status=n;return this},json(){return this}};
 await controller.overview({auth:{},tenantScope:{popIds:[]}},res);assert.equal(status,403);assert.equal(queried,false);
});
test('dashboard balance card, topbar and route are wired to the authenticated snapshot',()=>{
 const root=path.join(__dirname,'..');const view=fs.readFileSync(path.join(root,'views/reseller-dashboard.ejs'),'utf8');const top=fs.readFileSync(path.join(root,'views/partials/reseller-topbar.ejs'),'utf8');const js=fs.readFileSync(path.join(root,'public/js/reseller-dashboard.js'),'utf8');const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 assert.match(server,/resellerPortalController\.renderDashboard/);assert.match(view,/ACCOUNT &amp; BALANCE/);assert.match(view,/metricAccountBalance/);assert.match(top,/billingAccount\.billing_mode === 'prepaid'/);assert.match(top,/Wallet:/);assert.match(top,/Available Credit:/);assert.match(top,/Due:/);assert.match(js,/overview\.billingAccount/);assert.match(js,/account\.availableCredit/);
});
