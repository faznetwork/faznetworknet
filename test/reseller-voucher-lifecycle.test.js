'use strict';
const test=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const db=require('../db');
const mikrotik=require('../services/mikrotikService');
const lifecycle=require('../services/resellerVoucherLifecycleService');
test('lifecycle query joins batch mapping and enforces authenticated reseller tenant predicate',async t=>{
 let captured;t.mock.method(db,'query',async(sql,values)=>{captured={sql,values};return{rows:[]};});
 t.mock.method(mikrotik,'getActiveHotspotSessions',async()=>[]);
 const result=await lifecycle.listForReseller(41,100);
 assert.deepEqual(result.vouchers,[]);
 assert.match(captured.sql,/reseller_voucher_batches b/);
 assert.match(captured.sql,/reseller_voucher_issuance_items i ON i\.batch_id=b\.id/);
 assert.match(captured.sql,/hotspot_vouchers v ON v\.id=i\.voucher_id/);
 assert.match(captured.sql,/WHERE b\.reseller_id=\$1/);
 assert.deepEqual(captured.values,[41,100]);
});
test('UNUSED requires persisted unused state, no first login, and successful telemetry',()=>{
 const row={status:'unused',first_login_at:null,expires_at:null};
 assert.equal(lifecycle.classifyVoucher(row,null,true),'UNUSED');
 assert.equal(lifecycle.classifyVoucher(row,null,false),'ACTIVE');
});
test('ACTIVE is projected for live session or persisted first-login countdown',()=>{
 const row={status:'unused',first_login_at:null};
 assert.equal(lifecycle.classifyVoucher(row,{uptime:'2m'},true),'ACTIVE');
 assert.equal(lifecycle.classifyVoucher({...row,first_login_at:new Date().toISOString()},null,true),'ACTIVE');
});
test('EXPIRED is projected for persisted expiry, elapsed validity, and exhausted active quota',()=>{
 const now=Date.now();
 assert.equal(lifecycle.classifyVoucher({status:'expired'},null,true,now),'EXPIRED');
 assert.equal(lifecycle.classifyVoucher({status:'active',expires_at:new Date(now-1000).toISOString()},null,true,now),'EXPIRED');
 assert.equal(lifecycle.classifyVoucher({status:'active',data_limit:'1M'},{uptime:'1m',bytesIn:600000,bytesOut:500000},true,now),'EXPIRED');
});
test('remaining time prefers RouterOS session countdown and falls back to persisted expiry',()=>{
 const now=Date.now();
 assert.equal(lifecycle.remainingTime({expires_at:new Date(now+60000).toISOString()},{sessionTimeLeft:'00:01:00'},'ACTIVE',now),'00:01:00');
 assert.equal(lifecycle.remainingTime({expires_at:new Date(now+60000).toISOString()},null,'ACTIVE',now),'60s');
});
test('tenant identity is validated before lifecycle reads',async()=>{
 await assert.rejects(lifecycle.listForReseller(0),error=>error.code==='RESELLER_ID_REQUIRED');
});

test('RouterOS duration formats are parsed for countdown and uptime comparisons',()=>{
 assert.equal(lifecycle.durationSeconds('00:02:00'),120);
 assert.equal(lifecycle.durationSeconds('1d02:03:04'),93784);
 assert.equal(lifecycle.durationSeconds('1h30m'),5400);
});
test('reseller voucher print template has no inline handlers and renders a server-generated QR',()=>{
 const template=fs.readFileSync(path.join(__dirname,'..','views','reseller-voucher-print.ejs'),'utf8');
 const script=fs.readFileSync(path.join(__dirname,'..','public','js','reseller-voucher-print.js'),'utf8');
 assert.doesNotMatch(template,/<script>\s*\(/i);
 assert.doesNotMatch(template,/\sonclick=/i);
 assert.match(template,/v\.qrDataUrl/);
 assert.doesNotMatch(template,/cdnjs\.cloudflare\.com/);
 assert.match(template,/reseller-voucher-print\.js/);
 assert.match(script,/data-print-format/);
});
test('reseller history view exposes all four lifecycle filters and a dedicated table',()=>{
 const template=fs.readFileSync(path.join(__dirname,'..','views','reseller-vouchers.ejs'),'utf8');
 const script=fs.readFileSync(path.join(__dirname,'..','public','js','reseller-vouchers.js'),'utf8');
 for(const filter of ['all','UNUSED','ACTIVE','EXPIRED'])assert.match(template,new RegExp('data-lifecycle-filter="'+filter+'"'));
 assert.match(template,/id="voucherLifecycleRows"/);
 assert.match(script,/hotspot\/vouchers\/lifecycle/);
 assert.match(script,/window\.setInterval\(loadLifecycle,30000\)/);
});
