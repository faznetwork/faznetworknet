'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('voucher lifecycle abbreviates batch UUID and retains escaped full UUID in title', () => {
  const js = read('public/js/reseller-vouchers.js');
  assert.match(js, /batchKey\.slice\(0,8\)\+'…'/);
  assert.match(js, /title="'\+escapeHtml\(batchKey\)\+'"/);
});

test('voucher lifecycle table clips overflowing content and defines balanced seven-column widths', () => {
  const view = read('views/reseller-vouchers.ejs');
  assert.match(view, /voucher-lifecycle-table th,.voucher-history-page \.voucher-lifecycle-table td\{[^}]*overflow:hidden;text-overflow:ellipsis/);
  assert.ok(view.includes('width:15%') && view.includes('width:17%') && view.includes('width:14%'));
  assert.match(view, /voucherLifecycleTelemetry[^>]*padding-inline:1\.5rem/);
});

test('mobile topbar uses CSS-owned shrinking and wrapping rather than utility classes', () => {
  const topbar = read('views/partials/reseller-topbar.ejs');
  const css = read('public/css/reseller-workspace.css');
  assert.doesNotMatch(topbar, /min-w-0/);
  assert.match(topbar, /reseller-topbar-actions/);
  assert.match(css, /\.reseller-topbar-actions\{[^}]*flex-wrap:nowrap/);
  assert.match(css, /@media\(max-width:575\.98px\)\{[^}]*flex-wrap:wrap/);
});
