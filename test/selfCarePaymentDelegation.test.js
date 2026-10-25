"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

test("self-care PPPoE TrxID renewal delegates to the guarded manual-match path after identity and amount checks",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../controllers/customerSelfCareController.js"),"utf8");
 const renew=source.slice(source.indexOf("async function renew(req,res)"),source.indexOf("\nmodule.exports="));
 assert.match(renew,/tx\.used\s*\|\|\s*String\(tx\.status\|\|""\)\.trim\(\)\.toLowerCase\(\)!=="unmatched"/);
 assert.match(renew,/referenceMatches/);
 assert.match(renew,/Math\.round\(Number\(tx\.amount\)\*100\)!==Math\.round\(expected\*100\)/);
 assert.match(renew,/return require\("\.\/paymentController"\)\.manualMatch\(req,res\)/);
});

test("manual PPPoE match uses a conditional atomic claim and preserves partial provisioning for reconciliation",()=>{
 const source=fs.readFileSync(path.join(__dirname,"../controllers/paymentController.js"),"utf8");
 const start=source.indexOf("async function manualMatch(req,res)");
 const end=source.indexOf("\nasync function forceProvisionHotspot",start);
 const handler=source.slice(start,end);
 assert.match(handler,/COALESCE\(used,FALSE\)=FALSE AND LOWER\(TRIM\(status\)\)='unmatched' RETURNING id/);
 assert.match(handler,/PARTIAL_PROVISION_REQUIRES_RECONCILIATION/);
 assert.match(handler,/needs_reconciliation=true/);
});
