'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

test('reseller workspace uses its defined heading and body typography', () => {
  const css=read('public/css/reseller-workspace.css');
  assert.match(css,/family=Outfit/);
  assert.match(css,/--reseller-font:'Inter'/);
  assert.match(css,/--reseller-heading-font:'Outfit'/);
  assert.match(css,/\.reseller-section-heading h2[^}]*font-family:var\(--reseller-heading-font\)/);
  for(const view of ['reseller-login.ejs','reseller-accept-invite.ejs','reseller-voucher-print.ejs','reseller-customer-profile.ejs']) {
    const template=read('views/'+view);
    assert.match(template,/family=Outfit|font-family:Outfit|--heading-font:Outfit|Noto\+Sans\+Bengali/);
  }
});

test('dashboard KPI cards use solid fills with no gradients', () => {
  const css=read('public/css/reseller-workspace.css');
  for(const selector of ['pops','active','inactive','renewals','account']) {
    const rule=css.match(new RegExp('\\.metric-card--'+selector+'\\{([^}]*)\\}'));
    assert.ok(rule, 'missing metric card '+selector);
    assert.match(rule[1],/background:#[0-9a-f]{6}/i);
    assert.doesNotMatch(rule[1],/gradient/i);
  }
});

test('voucher reprint and generated voucher cards shrink and wrap safely on narrow screens', () => {
  const print=read('views/reseller-voucher-print.ejs');
  const generator=read('views/reseller-vouchers.ejs');
  assert.ok(print.includes('.voucher-grid{grid-template-columns:minmax(0,1fr)}'));
  assert.match(print,/grid-template-columns:minmax\(0,1fr\) 70px/);
  assert.match(print,/overflow-wrap:anywhere/);
  assert.match(print,/word-break:break-word/);
  assert.match(generator,/\.pos-voucher\{[^}]*grid-template-columns:minmax\(64px,80px\) minmax\(0,1fr\)/);
  assert.match(generator,/\.pos-credential\{[^}]*overflow-wrap:anywhere;word-break:break-word/);
  assert.match(generator,/\.pos-voucher-grid\{grid-template-columns:minmax\(0,1fr\)/);
});
