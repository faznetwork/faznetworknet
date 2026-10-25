"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const controller = fs.readFileSync(path.join(__dirname, "..", "controllers", "hotspotController.js"), "utf8");
const admin = fs.readFileSync(path.join(__dirname, "..", "views", "admin.ejs"), "utf8");
const createUserStart = controller.indexOf("async function createUser");
const createUserEnd = controller.indexOf("\nasync function ", createUserStart + 1);
const createUser = controller.slice(createUserStart, createUserEnd > createUserStart ? createUserEnd : controller.length);
const formStart = admin.indexOf("form.addEventListener('submit', async event =>", admin.indexOf("addHotspotUserForm"));
const formEnd = admin.indexOf("\n            await loadOptions();", formStart);
const submitHandler = admin.slice(formStart, formEnd);

test("createUser uses a correctly escaped 11-digit Bangladesh phone regex", () => {
  assert.match(createUser, /!\/\^01\[0-9\]\{9\}\$\//);
  assert.doesNotMatch(createUser, /!\/\^01\\\\d\{9\}\$\//);
});

test("createUser validates optional PIN digits and returns a specific error code", () => {
  assert.match(createUser, /!\/\^\\d\{6,8\}\$\//);
  assert.match(createUser, /code:"INVALID_VOUCHER_PIN",message:"Voucher PIN must contain 6 to 8 digits\."/);
  assert.match(createUser, /code:"PROFILE_REQUIRED",message:"Select a Hotspot package\/profile\."/);
});

test("profile ID resolution prioritizes exact metadata identifiers then exact RouterOS names", () => {
  assert.match(createUser, /metadataIdentifierMatches=availableProfiles\.filter/);
  assert.match(createUser, /identifiers\.some\(identifier=>.*String\(identifier\)\.trim\(\)===requestedProfile/s);
  assert.ok(createUser.indexOf("let candidates=metadataIdentifierMatches") < createUser.indexOf('String(item.name).trim()===requestedProfile'));
  assert.match(createUser, /PROFILE_NOT_FOUND_OR_AMBIGUOUS/);
  assert.match(createUser, /matches multiple saved Hotspot profiles/);
});

test("frontend renders backend error code and message rather than phone validation feedback", () => {
  assert.match(submitHandler, /apiError\.code = response\?\.code/);
  assert.match(submitHandler, /console\.error\('\[Hotspot user creation\] API request failed'/);
  assert.match(submitHandler, /codePrefix \+ \(error\?\.message/);
  assert.match(submitHandler, /response\?\.message/);
});


test("createUser INSERT assigns distinct parameters to price and time_limit and logs column mapping on query failure", () => {
  assert.match(createUser, /VALUES\(\$1,\$1,\$2,\$3::text,\$4::numeric,'unused',\$5,\$6,'all',\$7::text,\$8::text,\$9,NULL,\$10,\$11/);
  assert.match(createUser, /\$4.*price/);
  assert.match(createUser, /\$7.*time_limit/);
  assert.match(createUser, /voucher INSERT failed/);
  assert.match(createUser, /message:error\?\.message\|\|String\(error\)/);
});
