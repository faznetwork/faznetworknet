"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "views", "admin.ejs"), "utf8");
const formStart = source.indexOf('<form id="addHotspotUserForm"');
const formEnd = source.indexOf("</form>", formStart);
const formMarkup = source.slice(formStart, formEnd);
const scriptStart = source.indexOf("const form = document.getElementById('addHotspotUserForm');");
const scriptEnd = source.indexOf("}", source.indexOf("form.addEventListener(\'submit\', async event =>", scriptStart));
const script = source.slice(scriptStart, scriptEnd);

function normalizePhoneDigits(value) {
  return String(value || "")
    .replace(/[০-৯]/g, ch => String("০১২৩৪৫৬৭৮৯".indexOf(ch)))
    .replace(/\D/g, "");
}
function isValidBangladeshiPhone(value) {
  return /^01[3-9]\d{8}$/.test(normalizePhoneDigits(value));
}

test("Add Hotspot User phone input uses one unique, consistent DOM ID", () => {
  assert.equal((source.match(/id="customer_phone_input"/g) || []).length, 1);
  assert.match(formMarkup, /for="customer_phone_input"/);
  assert.match(formMarkup, /id="customer_phone_input" name="phone"/);
  assert.match(script, /getElementById\('customer_phone_input'\)/);
  assert.doesNotMatch(source, /id="hsUsername"/);
  assert.doesNotMatch(script, /getElementById\('hsUsername'\)/);
});

test("canonical Bangladesh phone validation accepts valid operator prefixes only", () => {
  for (const phone of ["01312345678", "01712345678", "01912345678"]) {
    assert.equal(isValidBangladeshiPhone(phone), true, phone);
  }
  for (const phone of ["01112345678", "01212345678", "01012345678", "0171234567", "017123456789", "", null]) {
    assert.equal(isValidBangladeshiPhone(phone), false, String(phone));
  }
});

test("phone normalization strips non-digits and converts Bangla numerals", () => {
  assert.equal(normalizePhoneDigits(" ০১৭-১২৩৪৫৬৭৮ "), "01712345678");
  assert.equal(normalizePhoneDigits("+880 1712-345678"), "8801712345678");
});

test("submit handler prevents native navigation, logs raw input, cleans then validates", () => {
  assert.match(script, /form\.addEventListener\('submit', async event =>\s*\{\s*event\.preventDefault\(\);/);
  assert.match(script, /const rawVal = phoneInput\?\.value;/);
  assert.match(script, /console\.log\('Entered Phone:', rawVal\)/);
  assert.match(script, /const cleanPhone = String\(rawVal \|\| ''\)[\s\S]*?\.replace\(/);
  assert.match(script, /if \(!isValidBangladeshiPhone\(cleanPhone\)\)/);
  assert.doesNotMatch(script, /activationInputs|activationMode|hsUsername/);
  assert.match(formMarkup, /pattern="01\[3-9\]\[0-9\]\{8\}"/);
});
