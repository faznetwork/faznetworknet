'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('reseller customer directory exposes the approved seven-column fixed-width contract', () => {
  const view = read('views/reseller-customers.ejs');
  const js = read('public/js/reseller-customers.js');
  const css = read('public/css/reseller-workspace.css');
  assert.match(view, /id="customerDirectoryTable"/);
  assert.match(view, /<col style="width:18%"><col style="width:14%"><col style="width:16%"><col style="width:16%"><col style="width:14%"><col style="width:10%"><col style="width:12%">/);
  for (const heading of ['Customer','Username','Package','Expiration Date','Assigned POP','Live Status','Account &amp; Actions']) assert.ok(view.includes('>'+heading+'</th>'), 'Missing directory heading '+heading);
  assert.match(view, /id="customerRows"><tr><td colspan="7"/);
  assert.match(js, /<td colspan="7"><div class="empty-state"/);
  assert.match(js, /customer-account-actions/);
  assert.match(js, /View profile/);
  assert.match(js, /badge-soft/);
  assert.match(css, /\.reseller-customer-directory-table\{width:100%;min-width:1040px;table-layout:fixed/);
  assert.match(css, /justify-content:flex-end/);
});

test('customer directory preserves customer profile routing and live-status lookup contract', () => {
  const js = read('public/js/reseller-customers.js');
  assert.ok(js.includes(`href="/reseller/customers/'+encodeURIComponent(c.id)+'"`));
  assert.ok(js.includes(`api+'/customers/'+encodeURIComponent(c.id)+'/live-session'`));
  assert.ok(js.includes("state.customers.filter"));
});
