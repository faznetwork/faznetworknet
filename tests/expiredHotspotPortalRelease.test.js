"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const portalPath=path.join(root,"public","login.html");
const portalAvailable=fs.existsSync(portalPath)&&fs.readFileSync(portalPath,"utf8").trim().length>0;

test("expired portal lookup exposes recharge state and releases only uncompleted direct subscribers",()=>{
 const auth=read("controllers/hotspotAuthController.js");
 assert.match(auth,/expired:true,can_recharge:true,session_released:true/);
 assert.match(auth,/disableExpiredDirectHotspotUser\(row\.username\|\|mac,row\.mac_address\|\|mac\)/);
 assert.match(auth,/row\.cleanup_status\|\|""\)\.toLowerCase\(\)!=="completed"/);
 const service=read("services/mikrotikService.js");
 assert.match(service,/async disableExpiredDirectHotspotUser/);
 assert.match(service,/\/ip\/hotspot\/active\/remove/);
 assert.match(service,/\/ip\/hotspot\/cookie\/remove/);
 assert.match(service,/=disabled=yes/);
 assert.match(service,/=profile=expired_profile/);

});

test("expired portal UI exposes device lookup and recharge state when the replacement page is present",{skip:!portalAvailable&&"public/login.html is intentionally absent pending the replacement portal"},()=>{
 const portal=read("public/login.html");
 assert.match(portal,/requestJson\(DEVICE_LOOKUP_URL/);
 assert.match(portal,/result\.expired&&result\.can_recharge/);
});
