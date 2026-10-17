"use strict";
const test=require("node:test");const assert=require("node:assert/strict");const {syncHotspotProfileScripts}=require("../jobs/hotspotProfileScriptSync");
test("profile sync runs legacy scheduler cleanup and reports result",async()=>{
 const calls=[];const database={async query(sql){calls.push(sql);return {rows:[]};}};
 const router={async getHotspotProfiles(){return [];},async cleanupHotspotExpirationSchedulers(){calls.push("cleanup-schedulers");return {checked:5,removed:4,failed:0};}};
 const result=await syncHotspotProfileScripts({db:database,mikrotikService:router,logger:{log(){},warn(){}}});
 assert.ok(calls.includes("cleanup-schedulers"));assert.deepEqual(result.schedulerCleanup,{checked:5,removed:4,failed:0});assert.equal(result.failed,0);
});
test("profile sync surfaces scheduler cleanup failures",async()=>{
 const database={async query(){return {rows:[]};}};const warnings=[];
 const router={async getHotspotProfiles(){return [];},async cleanupHotspotExpirationSchedulers(){throw new Error("Router API timeout");}};
 const result=await syncHotspotProfileScripts({db:database,mikrotikService:router,logger:{log(){},warn(...args){warnings.push(args);}}});
 assert.equal(result.schedulerCleanup.failed,1);assert.equal(result.failed,1);assert.equal(warnings.length,1);
});
