"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {normalizeProfileValidity,parseStoredValidity,buildHotspotOnLoginScript}=require("../services/hotspotProfileConfig");
test("normalizes arbitrary time values",()=>{assert.equal(normalizeProfileValidity(15,"minutes").validity,"15m");assert.equal(normalizeProfileValidity(6,"hours").validity,"6h");assert.equal(normalizeProfileValidity(30,"days").validity,"30d");});
test("GB is byte quota with no uptime limit",()=>{const v=normalizeProfileValidity(50,"gb");assert.equal(v.validity,"");assert.equal(v.limitBytesTotal,53687091200);assert.equal(v.validityLabel,"50 GB");});
test("parses RouterOS compound timeout 4w2d as a 30-day package",()=>{const v=parseStoredValidity({sessionTimeout:"4w2d"});assert.equal(v.validity,"30d");assert.equal(v.value,30);assert.equal(v.unit,"days");});
test("rejects invalid values and unsafe quotas",()=>{assert.throws(()=>normalizeProfileValidity(0,"days"));assert.throws(()=>normalizeProfileValidity(1.5,"hours"));assert.throws(()=>normalizeProfileValidity(Number.MAX_SAFE_INTEGER,"gb"));assert.throws(()=>normalizeProfileValidity(5,"weeks"));});
test("timed on-login hook only performs session MAC binding",()=>{
 const s=buildHotspotOnLoginScript({name:"30-Day",sharedUsers:1,validityValue:30,validityUnit:"days"});
 assert.match(s,/FAZ_HOTSPOT_SESSION_BINDING_V4/);
 assert.match(s,/mac-address=\$uMac/);
 assert.doesNotMatch(s,/system scheduler|scheduler add|EXP_|hotspot active remove|cookie remove|hotspot host remove|hotspot user remove|get .*uid comment/i);
});
test("one-hour package does not create an expiry scheduler",()=>{
 const s=buildHotspotOnLoginScript({name:"1-Hour",sharedUsers:1,validityValue:1,validityUnit:"hours"});
 assert.match(s,/mac-address/);
 assert.doesNotMatch(s,/system scheduler|scheduler add|EXP_|start-time=|interval=1h/i);
});
test("GB package does not create a scheduler or alter user quota",()=>{
 const s=buildHotspotOnLoginScript({name:"Profile-50GB",sharedUsers:1,validityValue:50,validityUnit:"gb"});
 assert.doesNotMatch(s,/system scheduler|scheduler add|interval=|limit-bytes-total/i);
});
test("shared-user profiles do not bind one MAC to the whole profile",()=>{
 const s=buildHotspotOnLoginScript({sharedUsers:2,validityValue:1,validityUnit:"hours"});
 assert.doesNotMatch(s,/hotspot user set \$uid mac-address/);
 assert.match(s,/FAZ_HOTSPOT_SESSION_BINDING_V4/);
});
