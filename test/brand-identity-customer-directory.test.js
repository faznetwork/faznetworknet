'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('brand assets are admin protected, content checked, and rendered through shared brand settings',()=>{
 const server=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const controller=fs.readFileSync(path.join(root,'controllers/brandAssetController.js'),'utf8');
 const settings=fs.readFileSync(path.join(root,'services/appSettings.js'),'utf8');
 const admin=fs.readFileSync(path.join(root,'views/admin.ejs'),'utf8');
 const reseller=fs.readFileSync(path.join(root,'views/partials/reseller-sidebar.ejs'),'utf8');
 assert.match(server,/\/api\/settings\/brand-assets.*requireRole\(\["super_admin"\]\)/);
 assert.match(controller,/detectImage\(req\.file\.buffer\)/);
 assert.match(controller,/LIMIT_FILE_SIZE/);
 assert.match(settings,/admin_avatar_url:s\.admin_avatar_url/);
 assert.match(admin,/setLogoUpload/);
 assert.match(admin,/setAvatarUpload/);
 assert.match(reseller,/brandSettings\.logo_url/);
});

test('customer directory displays POP and reseller names supplied by the customer list joins',()=>{
 const controller=fs.readFileSync(path.join(root,'controllers/customerController.js'),'utf8');
 const admin=fs.readFileSync(path.join(root,'views/admin.ejs'),'utf8');
 assert.match(controller,/LEFT JOIN pops pop ON pop\.id=c\.pop_id/);
 assert.match(controller,/LEFT JOIN resellers reseller ON reseller\.id=pop\.reseller_id/);
 assert.match(controller,/pop\.name AS pop_name/);
 assert.match(controller,/reseller\.name AS reseller_name/);
 assert.match(admin,/<th>POP<\/th>\s*<th>Reseller<\/th>/);
 assert.match(admin,/escapeHtml\(popName\)[\s\S]*escapeHtml\(resellerName\)/);
});

test('desktop and mobile hotspot banners have a responsive configured fallback',()=>{
 const portalController=fs.readFileSync(path.join(root,'controllers/hotspotPortalSettingsController.js'),'utf8');
 const schema=fs.readFileSync(path.join(root,'db/schema.sql'),'utf8');
 const login=fs.readFileSync(path.join(root,'public/login.html'),'utf8');
 const settingsJs=fs.readFileSync(path.join(root,'public/js/hotspot-portal-settings.js'),'utf8');
 assert.match(schema,/ADD COLUMN IF NOT EXISTS mobile_banner_url/);
 assert.match(portalController,/mobileBannerUrl:settings\.mobile_banner_url\|\|null/);
 assert.match(login,/portal-banner-mobile-source/);
 assert.match(login,/config\.mobileBannerUrl\|\|config\.mobile_banner_url/);
 assert.match(settingsJs,/upload-mobile-banner/);
});
