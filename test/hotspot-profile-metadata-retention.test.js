"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const settingsSource = fs.readFileSync(path.join(__dirname, "../controllers/settingsController.js"), "utf8");
const hotspotSource = fs.readFileSync(path.join(__dirname, "../controllers/hotspotController.js"), "utf8");

function functionBody(source, signature, nextSignature) {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Missing function: ${signature}`);
  const end = source.indexOf(nextSignature, start + signature.length);
  assert.notEqual(end, -1, `Missing function boundary: ${nextSignature}`);
  return source.slice(start, end);
}

test("profile sync rebuilds metadata only from the successfully fetched live RouterOS profiles", () => {
  const body = functionBody(
    settingsSource,
    "async function syncMikrotikProfilesInternal()",
    "async function saveMikrotik("
  );
  assert.match(body, /await Promise\.all\(\[mikrotikService\.fetchExistingProfiles\(\),mikrotikService\.getHotspotProfiles\(\)\]\)/);
  assert.match(body, /const liveMetadata=\{\}/);
  assert.match(body, /liveMetadata\[name\]=/);
  assert.match(body, /upsertSetting\("hotspot_profile_metadata",JSON\.stringify\(liveMetadata\)\)/);
  assert.doesNotMatch(body, /for\(const p of hotspotProfiles\)\{const name=String\(p\.name\|\|""\);if\(!metadata\[name\]\)metadata\[name\]=\{\};\}/);
});

test("profile sync does not swallow RouterOS API failure or purge metadata before a successful profile fetch", () => {
  const body = functionBody(
    settingsSource,
    "async function syncMikrotikProfilesInternal()",
    "async function saveMikrotik("
  );
  const routerFetch = body.indexOf("mikrotikService.getHotspotProfiles()");
  const metadataWrite = body.indexOf('upsertSetting("hotspot_profile_metadata"');
  assert.ok(routerFetch >= 0 && metadataWrite > routerFetch, "metadata write must follow the awaited RouterOS fetch");
  assert.doesNotMatch(body, /getHotspotProfiles\(\)\.catch\(/);
});

test("Hotspot profile listing has no metadata-generated fallback and returns an error on RouterOS failure", () => {
  const body = functionBody(
    hotspotSource,
    "async function profiles(req,res)",
    "function previewProfileScript("
  );
  assert.match(body, /mikrotikService\.getHotspotProfiles\(\)/);
  assert.match(body, /catch\(e\)\{return errorResponse\(res,e\);\}/);
  assert.doesNotMatch(body, /getHotspotProfiles\(\)\.catch\(\(\)=>\[\]\)/);
  assert.doesNotMatch(body, /Object\.entries\(meta\)\.map/);
});

test("successful RouterOS deletion always awaits PostgreSQL metadata persistence before success response", () => {
  const body = functionBody(
    hotspotSource,
    "async function deleteProfile(req,res)",
    "let hotspotListCache="
  );
  const routerDelete = body.indexOf("await mikrotikService.deleteHotspotProfile(name)");
  const metadataRead = body.indexOf("await readProfileMetadata()");
  const keyDelete = body.indexOf("delete meta[name]");
  const metadataWrite = body.indexOf("await writeProfileMetadata(meta)");
  const successResponse = body.indexOf("return res.json({success:true");
  assert.ok(routerDelete >= 0 && metadataRead > routerDelete);
  assert.ok(keyDelete > metadataRead);
  assert.ok(metadataWrite > keyDelete);
  assert.ok(successResponse > metadataWrite);
  assert.match(body, /catch\(e\)[\s\S]*HOTSPOT_PROFILE_DELETE_FAILED/);
});
