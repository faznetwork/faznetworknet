const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminView = fs.readFileSync(path.join(__dirname, '..', 'views', 'admin.ejs'), 'utf8');
const recovery = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'customer-submenu-recovery.js'), 'utf8');

test('admin loads the independent customer submenu recovery script', () => {
  assert.match(adminView, /customer-submenu-recovery\.js\?v=20261022/);
});

test('customer submenu clicks are intercepted before fragile inline handlers', () => {
  assert.match(recovery, /document\.addEventListener\('click',[\s\S]*?\}, true\)/);
  assert.match(recovery, /event\.stopImmediatePropagation\(\)/);
  assert.match(recovery, /window\.loadCustomerSection/);
  assert.match(recovery, /window\.showAddCustomerForm/);
});

test('missing handlers and rejected navigation render a visible friendly error', () => {
  assert.match(recovery, /function showCustomerRecoveryError/);
  assert.match(recovery, /The admin navigation script did not initialize correctly/);
  assert.match(recovery, /view\.appendChild\(alert\)/);
  assert.match(recovery, /Promise\.resolve\(\)[\s\S]*?\.catch\(showCustomerRecoveryError\)/);
});

test('customer error details are inserted as text, not executable HTML', () => {
  assert.match(recovery, /detail\.textContent = message/);
  assert.match(recovery, /heading\.textContent = 'Customer page could not load\.'/);
  assert.match(recovery, /view\.replaceChildren\(\)/);
});
