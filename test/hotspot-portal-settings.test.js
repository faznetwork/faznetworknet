"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const js=fs.readFileSync(path.join(__dirname,"..","public","js","hotspot-portal-settings.js"),"utf8");
const controller=fs.readFileSync(path.join(__dirname,"..","controllers","hotspotPortalSettingsController.js"),"utf8");
const login=fs.readFileSync(path.join(__dirname,"..","public","login.html"),"utf8");
const routes=fs.readFileSync(path.join(__dirname,"..","routes","hotspotPortalSettingsRoutes.js"),"utf8");

test("hotspot portal package selector is read-only and safely handles API failure",()=>{
 assert.doesNotThrow(()=>new vm.Script(js,{filename:"hotspot-portal-settings.js"}));
 assert.doesNotMatch(js,/portal-package-name|portal-package-price" type="number|portal-package-validity" maxlength/);
 assert.match(js,/Profile Name/);
 assert.match(js,/Price \(৳\)/);
 assert.match(js,/Validity/);
 assert.match(js,/Show on Portal/);
 assert.match(js,/async function loadProfiles\(\)/);
 assert.match(js,/Retry profile loading/);
 assert.match(js,/Could not load MikroTik profiles/);
 assert.match(js,/renderPackageRows\(savedPackages/);
});

test("settings save only enabled profile names, and public config resolves existing metadata",()=>{
 assert.match(js,/enabledProfiles:readEnabledProfiles\(\)/);
 assert.match(js,/function readEnabledProfiles\(\)/);
 assert.doesNotMatch(js,/packages:readPackages\(\)/);
 assert.match(controller,/enabledProfiles/);
 assert.match(controller,/hotspot_profile_metadata/);
 assert.match(controller,/packages/);
 assert.match(login,/config\.packages/);
 assert.ok(controller.includes("if(!Number.isFinite(price)||price<=0)return null;"));
});

test("admin hotspot portal settings reports configuration-store failures",()=>{
 assert.match(controller,/async function getSettings\(_q,res\)\{try\{let settings=\{\.\.\.defaults\}/);
 assert.match(controller,/Dedicated settings store unavailable; using safe defaults/);
 assert.match(controller,/Public config unavailable; retaining safe settings/);
 assert.match(controller,/GET handler failed; returning empty settings/);
 assert.match(controller,/return res\.status\(200\)\.json\(\{success:true,settings:\{\}\}\)/);
 assert.match(controller,/async function readPublicConfig\(\).*Unable to read hotspot portal configuration/);
 assert.doesNotMatch(controller,/DELETE FROM (?:app_settings|hotspot_portal_settings)/i);
});

test("dashboard live traffic retries interface discovery after transient router/API failures",()=>{
 const admin=fs.readFileSync(path.join(__dirname,"..","views","admin.ejs"),"utf8");
 assert.match(admin,/async function retryLoadTrafficInterfaces\(\)/);
 assert.match(admin,/trafficInterfaceLoadInFlight/);
 assert.match(admin,/trafficInterfaceRetryTimer = setInterval/);
 assert.match(admin,/dataset\.nocOptionsLoaded !== '1'/);
 assert.match(admin,/textContent = 'LIVE'/);
 assert.match(admin,/nocTrafficHistory\.push\(\{ rx: downloadMbps, tx: uploadMbps \}\)/);
});

test("single-tenant hotspot settings schema does not require tenant_id",()=>{
 const schema=fs.readFileSync(path.join(__dirname,"..","db","schema.sql"),"utf8");
 assert.match(schema,/CREATE TABLE IF NOT EXISTS hotspot_portal_settings/);
 assert.match(schema,/INSERT INTO hotspot_portal_settings\(id\) VALUES\(1\)/);
 assert.doesNotMatch(schema,/tenant_id/);
 assert.doesNotMatch(controller,/tenant_id/);
 assert.match(controller,/WHERE id=1/);
});

test("public portal config exposes saved branding, feature flags and only enabled priced profiles",async()=>{
 const db=require("../db");
 const portal=require("../controllers/hotspotPortalSettingsController");
 const originalQuery=db.query;
 db.query=async(sql)=>{
  if(sql.startsWith("INSERT INTO hotspot_portal_settings"))return {rows:[]};
  if(sql.includes("SELECT * FROM hotspot_portal_settings"))return {rows:[{display_mode:"banner",portal_logo_url:"/uploads/branding/logo.png",banner_url:"/uploads/branding/banner.png",brand_title:"FAZ Test Portal",enable_online_payment:false,enable_voucher_pin:true,enable_qr_scan:false}]};
  if(sql.includes("hotspot_public_portal_config"))return {rows:[{value:JSON.stringify({portalTitle:"FAZ Test Portal",enabledProfiles:["Pack 525","Free"],mfs:[{enabled:true,number:"01711111111"},{enabled:false,number:"01822222222"}]})}]};
  if(sql.includes("hotspot_profile_metadata"))return {rows:[{value:JSON.stringify({"Pack 525":{price:525,validityLabel:"30 days",limitBytesTotal:0},Hidden:{price:650,validityLabel:"30 days"},Free:{price:0,validityLabel:"1 day"}})}]};
  throw new Error("Unexpected portal-config query: "+sql);
 };
 const response={headers:{},payload:null,set(key,value){this.headers[key]=value;return this;},status(code){this.statusCode=code;return this;},json(payload){this.payload=payload;return this;}};
 try {
  await portal.publicPortalConfig({},response);
  assert.equal(response.statusCode,undefined);
  assert.equal(response.payload.success,true);
  assert.equal(response.payload.display_mode,"banner");
  assert.equal(response.payload.logoUrl,"/uploads/branding/logo.png");
  assert.equal(response.payload.bannerUrl,"/uploads/branding/banner.png");
  assert.deepEqual(response.payload.features,{online_payment:false,voucher_pin:true,qr_scan:false,enable_online_purchase:false,enable_voucher_login:true,enable_qr_scanner:false});
  assert.deepEqual(response.payload.packages.map(item=>item.profileId),["Pack 525"]);
  assert.equal(response.payload.packages[0].price,525);
  assert.equal(response.payload.packages[0].validity,"30 days");
  assert.equal(response.payload.packages[0].enabled,true);
  assert.equal(response.payload.packages[0].isPublic,true);
  assert.deepEqual(response.payload.mfs,[{enabled:true,number:"01711111111"}]);
 } finally {
  db.query=originalQuery;
 }
});
test("hotspot login page uses one script and preserves verified voucher, payment and RouterOS CHAP flows",()=>{
 const scripts=[...login.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
 assert.equal(scripts.length,1,"legacy competing script flows should be consolidated");
 assert.doesNotThrow(()=>new vm.Script(scripts[0][1],{filename:"public/login.html script"}));
 assert.match(login,/id="voucher_pin"/);
 assert.match(login,/id="voucher_password"/);
 assert.match(login,/claim-voucher/);
 assert.doesNotMatch(login,/api\/hotspot\/verify-voucher/);
 assert.doesNotMatch(login,/member_username|m-btn-member|btn-master-action/);
 assert.ok(login.includes("config.display_mode||'default'"));
 assert.match(login,/portalSettingEnabled\(features,config,\['online_payment','enable_online_purchase','enable_online_payment'\]\)/);
 assert.match(login,/portalSettingEnabled\(features,config,\['voucher_pin','enable_voucher_login','enable_voucher_pin'\]\)/);
 assert.match(login,/portalSettingEnabled\(features,config,\['qr_scan','enable_qr_scanner','enable_qr_scan'\]\)/);
 assert.match(login,/\.filter\(p=>p&&\(p\.enabled===true\|\|p\.isPublic===true\)\)/);
 assert.match(login,/window\.location\.hostname/);
 assert.match(login,/Payment settings unavailable/);
 assert.match(login,/chapIdentifierByte/);
 assert.match(login,/decodeChapChallenge/);
 assert.match(login,/qr-scanner-modal/);
 assert.match(login,/config\.packages\|\|\[\]/);
 assert.match(login,/showStatus\(error\.message/);
});

test("voucher and payment connection only follow successful verification responses",()=>{
 const script=[...login.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)][0][1];
 const voucher=script.slice(script.indexOf("async function handleVoucherLogin"),script.indexOf("document.addEventListener('DOMContentLoaded'"));
 const payment=script.slice(script.indexOf("async function handleVerification"),script.indexOf("function parseQrCredentials"));
 assert.ok(voucher.indexOf("await requestJson")<voucher.indexOf("submitMikrotikLogin"));
 assert.match(voucher,/if\(!result\.username\|\|!result\.password\)/);
 assert.ok(payment.indexOf("await requestJson")<payment.indexOf("submitMikrotikLogin"));
 assert.match(payment,/profile_id:selectedPackage\.profile/);
});

const brandingDir=path.join(__dirname,"..","public","uploads","branding");
const tinyPng=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAwMCAO+ip1sAAAAASUVORK5CYII=","base64");
function brandingFileName(){return "banner-"+Date.now()+"-"+Math.random().toString(16).slice(2,10)+".png";}
function writeBrandingFile(name,contents){fs.mkdirSync(brandingDir,{recursive:true});const filePath=path.join(brandingDir,name);fs.writeFileSync(filePath,contents||tinyPng);return filePath;}
function removeBrandingFile(filePath){try{fs.unlinkSync(filePath);}catch(error){if(error.code!=="ENOENT")throw error;}}
function mockUploadResponse(){return {headers:{},payload:null,statusCode:undefined,set(key,value){this.headers[key]=value;return this;},status(code){this.statusCode=code;return this;},json(payload){this.payload=payload;return this;}};}
function installUploadDbMock(state,seen){const db=require("../db");const originalQuery=db.query;db.query=async(sql,params)=>{seen.push({sql,params:params||null});if(sql.startsWith("INSERT INTO hotspot_portal_settings"))return {rows:[]};if(sql.includes("SELECT * FROM hotspot_portal_settings"))return {rows:[state.settingsRow||{}]};if(sql.startsWith("UPDATE hotspot_portal_settings"))return {rows:[]};if(sql.includes("hotspot_public_portal_config"))return {rows:[{value:"{}"}]};if(sql.includes("hotspot_profile_metadata"))return {rows:[{value:"{}"}]};throw new Error("Unexpected portal upload query: "+sql);};return originalQuery;}
function stubBrandLogo(){const appSettings=require("../services/appSettings");const original=appSettings.getBrandSettings;appSettings.getBrandSettings=async()=>({logo_url:""});return original;}

test("logo upload stores the file under public/uploads/branding, saves its URL and exposes it in the public payload",async()=>{
 const portal=require("../controllers/hotspotPortalSettingsController");
 const db=require("../db");
 const appSettings=require("../services/appSettings");
 const seen=[];const state={settingsRow:{portal_logo_url:"/uploads/branding/banner-old-logo.png"}};
 const originalQuery=installUploadDbMock(state,seen);const originalBrand=stubBrandLogo();
 const oldPath=writeBrandingFile("banner-old-logo.png");
 const fileName=brandingFileName();const filePath=writeBrandingFile(fileName);
 try {
  const response=mockUploadResponse();
  await portal.uploadLogo({file:{filename:fileName,path:filePath,mimetype:"image/png",size:tinyPng.length}},response);
  assert.equal(response.statusCode,201);
  assert.equal(response.payload.success,true);
  assert.equal(response.payload.portal_logo_url,"/uploads/branding/"+fileName);
  assert.ok(fs.existsSync(filePath),"uploaded logo file must land under public/uploads/branding");
  assert.ok(!fs.existsSync(oldPath),"previous logo file must be removed after replacement");
  const update=seen.find(entry=>entry.sql.startsWith("UPDATE hotspot_portal_settings"));
  assert.ok(update.sql.includes("portal_logo_url=$1"));
  assert.equal(update.params[0],"/uploads/branding/"+fileName);
  state.settingsRow={portal_logo_url:"/uploads/branding/"+fileName};
  const payloadResponse=mockUploadResponse();
  await portal.publicPortalConfig({},payloadResponse);
  assert.equal(payloadResponse.payload.success,true);
  assert.equal(payloadResponse.payload.logoUrl,"/uploads/branding/"+fileName);
  assert.equal(payloadResponse.payload.portal_logo_url,"/uploads/branding/"+fileName);
  assert.equal(payloadResponse.payload.bannerUrl,null);
 } finally {
  db.query=originalQuery;appSettings.getBrandSettings=originalBrand;
  removeBrandingFile(filePath);removeBrandingFile(oldPath);
 }
});

test("banner upload stores the file under public/uploads/branding, saves its URL and exposes it in the public payload",async()=>{
 const portal=require("../controllers/hotspotPortalSettingsController");
 const db=require("../db");
 const appSettings=require("../services/appSettings");
 const seen=[];const state={settingsRow:{banner_url:null}};
 const originalQuery=installUploadDbMock(state,seen);const originalBrand=stubBrandLogo();
 const fileName=brandingFileName();const filePath=writeBrandingFile(fileName);
 try {
  const response=mockUploadResponse();
  await portal.uploadBanner({file:{filename:fileName,path:filePath,mimetype:"image/png",size:tinyPng.length}},response);
  assert.equal(response.statusCode,201);
  assert.equal(response.payload.success,true);
  assert.equal(response.payload.banner_url,"/uploads/branding/"+fileName);
  assert.ok(fs.existsSync(filePath),"uploaded banner file must land under public/uploads/branding");
  const update=seen.find(entry=>entry.sql.startsWith("UPDATE hotspot_portal_settings"));
  assert.ok(update.sql.includes("banner_url=$1"));
  assert.equal(update.params[0],"/uploads/branding/"+fileName);
  state.settingsRow={banner_url:"/uploads/branding/"+fileName};
  const payloadResponse=mockUploadResponse();
  await portal.publicPortalConfig({},payloadResponse);
  assert.equal(payloadResponse.payload.success,true);
  assert.equal(payloadResponse.payload.bannerUrl,"/uploads/branding/"+fileName);
  assert.equal(payloadResponse.payload.banner_url,"/uploads/branding/"+fileName);
  assert.equal(payloadResponse.payload.mobileBannerUrl,null);
 } finally {
  db.query=originalQuery;appSettings.getBrandSettings=originalBrand;
  removeBrandingFile(filePath);
 }
});

test("mobile banner upload stores the file under public/uploads/branding, saves its URL and exposes it in the public payload",async()=>{
 const portal=require("../controllers/hotspotPortalSettingsController");
 const db=require("../db");
 const appSettings=require("../services/appSettings");
 const seen=[];const state={settingsRow:{mobile_banner_url:null}};
 const originalQuery=installUploadDbMock(state,seen);const originalBrand=stubBrandLogo();
 const fileName=brandingFileName();const filePath=writeBrandingFile(fileName);
 try {
  const response=mockUploadResponse();
  await portal.uploadMobileBanner({file:{filename:fileName,path:filePath,mimetype:"image/png",size:tinyPng.length}},response);
  assert.equal(response.statusCode,201);
  assert.equal(response.payload.success,true);
  assert.equal(response.payload.mobile_banner_url,"/uploads/branding/"+fileName);
  assert.ok(fs.existsSync(filePath),"uploaded mobile banner file must land under public/uploads/branding");
  const update=seen.find(entry=>entry.sql.startsWith("UPDATE hotspot_portal_settings"));
  assert.ok(update.sql.includes("mobile_banner_url=$1"));
  assert.equal(update.params[0],"/uploads/branding/"+fileName);
  state.settingsRow={mobile_banner_url:"/uploads/branding/"+fileName};
  const payloadResponse=mockUploadResponse();
  await portal.publicPortalConfig({},payloadResponse);
  assert.equal(payloadResponse.payload.success,true);
  assert.equal(payloadResponse.payload.mobileBannerUrl,"/uploads/branding/"+fileName);
  assert.equal(payloadResponse.payload.mobile_banner_url,"/uploads/branding/"+fileName);
  assert.equal(payloadResponse.payload.bannerUrl,null);
 } finally {
  db.query=originalQuery;appSettings.getBrandSettings=originalBrand;
  removeBrandingFile(filePath);
 }
});

test("delete logo, banner and mobile banner clear the stored URL and remove the old file",async()=>{
 const portal=require("../controllers/hotspotPortalSettingsController");
 const db=require("../db");
 const cases=[
  {handler:"deleteLogo",column:"portal_logo_url",field:"portal_logo_url"},
  {handler:"deleteBanner",column:"banner_url",field:"banner_url"},
  {handler:"deleteMobileBanner",column:"mobile_banner_url",field:"mobile_banner_url"}
 ];
 for(const item of cases){
  const seen=[];const state={settingsRow:{}};
  const fileName=brandingFileName();const filePath=writeBrandingFile(fileName);
  state.settingsRow[item.column]="/uploads/branding/"+fileName;
  const originalQuery=installUploadDbMock(state,seen);
  try {
   const response=mockUploadResponse();
   await portal[item.handler]({},response);
   assert.equal(response.payload.success,true);
   assert.equal(response.payload[item.field],null);
   assert.ok(seen.some(entry=>entry.sql.includes("SET "+item.column+"=NULL")),"delete must clear "+item.column);
   assert.ok(!fs.existsSync(filePath),"deleted "+item.column+" file must be removed from public/uploads/branding");
  } finally {
   db.query=originalQuery;removeBrandingFile(filePath);
  }
 }
});

test("logo, banner and mobile banner uploads without a file return 400",async()=>{
 const portal=require("../controllers/hotspotPortalSettingsController");
 for(const handler of ["uploadLogo","uploadBanner","uploadMobileBanner"]){
  const response=mockUploadResponse();
  await portal[handler]({},response);
  assert.equal(response.statusCode,400);
  assert.equal(response.payload.success,false);
 }
});

test("verifyImageContent accepts a real PNG and rejects bytes that do not match the claimed type",async()=>{
 const portal=require("../controllers/hotspotPortalSettingsController");
 const goodName=brandingFileName();const goodPath=writeBrandingFile(goodName);
 const badName=brandingFileName();const badPath=writeBrandingFile(badName,Buffer.from("this is not an image","utf8"));
 try {
  let nextCalled=false;
  await portal.verifyImageContent({file:{path:goodPath,mimetype:"image/png"}},{},()=>{nextCalled=true;});
  assert.equal(nextCalled,true);
  assert.ok(fs.existsSync(goodPath),"a valid image must be kept on disk");
  const response=mockUploadResponse();
  let rejectedNext=false;
  await portal.verifyImageContent({file:{path:badPath,mimetype:"image/png"}},response,()=>{rejectedNext=true;});
  assert.equal(rejectedNext,false);
  assert.equal(response.statusCode,415);
  assert.match(response.payload.error,/does not match/);
  assert.ok(!fs.existsSync(badPath),"a rejected upload must be deleted from disk");
 } finally {
  removeBrandingFile(goodPath);removeBrandingFile(badPath);
 }
});

test("admin panel has the logo and banner upload inputs and the settings script calls the upload and delete endpoints",()=>{
 const admin=fs.readFileSync(path.join(__dirname,"..","views","admin.ejs"),"utf8");
 assert.match(admin,/id="general-settings-panel-hotspot-portal"/);
 assert.match(admin,/id="portalLogoFile"/);
 assert.match(admin,/id="portalBannerFile"/);
 assert.match(admin,/id="portalMobileBannerFile"/);
 assert.match(admin,/id="portalLogoUploadBtn"/);
 assert.match(admin,/id="portalBannerUploadBtn"/);
 assert.match(admin,/id="portalMobileBannerUploadBtn"/);
 assert.match(admin,/name="portalDisplayMode" value="banner"/);
 assert.match(js,/api\+'\/upload-logo'/);
 assert.match(js,/api\+'\/upload-banner'/);
 assert.match(js,/api\+'\/upload-mobile-banner'/);
 assert.match(js,/api\+'\/logo'/);
 assert.match(js,/api\+'\/banner'/);
 assert.match(js,/api\+'\/mobile-banner'/);
 assert.match(routes,/upload-banner',c\.upload\.single\('banner'\),c\.verifyImageContent,c\.uploadErrorHandler,c\.uploadBanner/);
 assert.match(routes,/upload-mobile-banner',c\.upload\.single\('banner'\),c\.verifyImageContent,c\.uploadErrorHandler,c\.uploadMobileBanner/);
 assert.match(routes,/upload-logo',c\.upload\.single\('banner'\),c\.verifyImageContent,c\.uploadErrorHandler,c\.uploadLogo/);
});

test("branding uploads are stored under public/uploads/branding with a 2 MB JPG/PNG/WEBP limit",()=>{
 assert.match(controller,/public','uploads','branding/);
 assert.match(controller,/fileSize:2097152/);
 assert.match(controller,/'banner-'\s*\+Date\.now\(\)/);
 assert.match(controller,/'image\/jpeg','image\/png','image\/webp'/);
 assert.match(controller,/137,80,78,71,13,10,26,10/);
});
