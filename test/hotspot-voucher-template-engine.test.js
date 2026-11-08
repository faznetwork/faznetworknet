'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ejs=require('ejs');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('reseller voucher print view supports readable localized templates and global logo',()=>{
 const view=read('views/reseller-voucher-print.ejs');
 const script=read('public/js/reseller-voucher-print.js');
 ejs.compile(view,{filename:'reseller-voucher-print.ejs'});
 const rendered=ejs.render(view,{title:'Preview',resellerName:'Reseller',brandSettings:{company_name:'FAZ Preview',logo_url:'/uploads/branding/logo.png'},portalBranding:{banner_url:'/uploads/branding/desktop.png',mobile_banner_url:'/uploads/branding/mobile.png'},batch:{batchKey:'batch-1',dnsName:'login.example',createdAt:'2026-01-01',packageName:'Package',quantity:1,validity:'1 day'},vouchers:[{username:'DEMO123',password:'DEMO-PASSWORD',validity:'1 day',qrDataUrl:'data:image/png;base64,cXRlc3Q='}]});
 for(const template of ['basic','standard','pro']){
  assert.match(view,new RegExp('<option value="'+template+'">'));
  assert.match(view,new RegExp('voucher-'+template));
 }
 assert.match(view,/brandName/);
 assert.match(view,/<img src="<%= brandLogo %>" alt="<%= brandName %>">/);
 assert.doesNotMatch(view,/voucher-banner|portalBranding/);
 assert.match(view,/@media print/);
 assert.match(view,/break-inside:avoid/);
 assert.match(rendered,/FAZ Preview/);
 assert.match(rendered,/<img src="\/uploads\/branding\/logo\.png" alt="FAZ Preview">/);
 assert.match(rendered,/<img src="data:image\/png;base64,cXRlc3Q=" alt="ভাউচার QR কোড">/);
 assert.doesNotMatch(view,/cdnjs\.cloudflare\.com/);
 for(const label of ['ইউজারনেম / পিন','পাসওয়ার্ড','প্যাকেজ','মেয়াদ','FAZ NETWORK ওয়াই-ফাই কানেক্ট করে QR স্ক্যান করুন অথবা পিন দিন।'])assert.match(rendered,new RegExp(label));
 assert.match(view,/grid-template-columns:minmax\(0,1fr\) 70px/);
 assert.match(view,/\.voucher-standard\{[^}]*background:#17634f!important;color:#fff!important/);
 assert.match(view,/\.voucher-pro\{[^}]*background:#284e70!important;color:#fff!important/);
 assert.match(script,/document\.body\.dataset\.template=template/);
 assert.match(script,/getElementById\('voucherTemplate'\)/);
 assert.match(script,/window\.print\(\)/);
});

test('admin voucher generator exposes persistent template selection and logo branding',()=>{
 const admin=read('views/admin.ejs');
 assert.match(admin,/id="adminVoucherTemplate"/);
 assert.match(admin,/id="saveVoucherTemplate"/);
 assert.match(admin,/voucher_template:currentVoucherTemplate/);
 assert.match(admin,/currentVoucherBranding\.logoUrl/);
 assert.match(admin,/data-voucher-logo=/);
 assert.match(admin,/voucher_template/);
 assert.match(admin,/#voucherPrintArea \.voucher-card\.template-standard\{background:#17634f!important;color:#fff!important/);
 assert.match(admin,/print-color-adjust:exact/);
});

test('voucher preferred template is validated and included in centralized brand settings',()=>{
 const settingsController=read('controllers/settingsController.js');
 const appSettings=read('services/appSettings.js');
 assert.match(settingsController,/voucher_template:\{oneOf:\["basic","standard","pro"\]\}/);
 assert.match(appSettings,/voucher_template:"standard"/);
 assert.match(appSettings,/voucher_template:s\.voucher_template/);
});

test('reseller print controller passes text brand settings to the EJS voucher sheet',()=>{
 const controller=read('controllers/resellerHotspotController.js');
 assert.match(controller,/appSettingsService\.getBrandSettings\(\)/);
 assert.match(controller,/QRCode\.toDataURL\(loginUrl\.toString\(\)/);
 assert.match(controller,/brandSettings,/);
 assert.doesNotMatch(controller,/portalBranding|hotspot_portal_settings/);
});
