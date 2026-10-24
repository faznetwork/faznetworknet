const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const adminTemplate = fs.readFileSync(
  path.join(__dirname, '..', 'views', 'admin.ejs'),
  'utf8'
);

function getMainDashboardMarkup(source) {
  const start = source.indexOf('<section id="view-main-dashboard"');
  const end = source.indexOf('<!-- VIEW: HOTSPOT DASHBOARD', start);
  assert.notEqual(start, -1, 'main dashboard section must exist');
  assert.notEqual(end, -1, 'main dashboard must end before the Hotspot dashboard');
  return source.slice(start, end);
}

function findStructuralTagMismatches(markup) {
  const stack = [];
  const mismatches = [];
  const tags = /<\/?(div|section|article)\b[^>]*>/gi;
  let match;

  while ((match = tags.exec(markup)) !== null) {
    const token = match[0];
    const tag = match[1].toLowerCase();

    if (token.startsWith('</')) {
      const opened = stack.pop();
      if (!opened || opened.tag !== tag) {
        mismatches.push({
          offset: match.index,
          closingTag: tag,
          openedTag: opened ? opened.tag : null
        });
      }
    } else if (!token.endsWith('/>')) {
      stack.push({ tag, offset: match.index });
    }
  }

  return { mismatches, unclosed: stack };
}

test('main dashboard has balanced div, section and article markup', () => {
  const markup = getMainDashboardMarkup(adminTemplate);
  const result = findStructuralTagMismatches(markup);

  assert.deepEqual(result.mismatches, [], 'structural tags must close in nesting order');
  assert.deepEqual(result.unclosed, [], 'all structural tags must be closed');
});

test('retired optical telemetry cards are absent from dashboard markup', () => {
  const markup = getMainDashboardMarkup(adminTemplate);

  for (const retiredLabel of [
    'OPTICAL / FIBER HEALTH',
    'OLT Status',
    'Urgent Optical &amp; Fiber Health',
    'nocUrgentBody',
    'nocOltStatus'
  ]) {
    assert.equal(markup.includes(retiredLabel), false, `dashboard must not render ${retiredLabel}`);
  }
});

test('sidebar and content layout contract remains in place', () => {
  assert.match(adminTemplate, /--sidebar-width:\s*260px/);
  assert.match(adminTemplate, /\.sidebar\s*\{[^}]*position:\s*fixed/s);
  assert.match(adminTemplate, /\.main-content\s*\{[^}]*margin-left:\s*var\(--sidebar-width\)/s);
  assert.match(adminTemplate, /#dynamicPageContent\s*\{[^}]*width:\s*100%[^}]*min-width:\s*0/s);
});
