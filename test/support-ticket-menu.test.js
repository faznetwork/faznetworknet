const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs');
const controller = read('controllers/adminSecurityController.js');
const schema = read('db/schema.sql');
const routes = read('routes/adminSecurityRoutes.js');

test('support submenu paths open the correct filtered ticket view', () => {
  assert.ok(adminView.includes("'/admin/support/tickets': { view: 'support', category: 'all' }"));
  assert.ok(adminView.includes("'/admin/support/software': { view: 'support', category: 'software' }"));
  assert.ok(adminView.includes("'/admin/support/website': { view: 'support', category: 'website' }"));
  assert.ok(adminView.includes("case 'support': return callIfAvailable('loadSupportTickets', [r.category || 'all']);"));
});

test('support ticket UI calls the existing authenticated ticket APIs', () => {
  assert.ok(adminView.includes("window.jsonFetch('/api/admin/security/tickets?category=' + encodeURIComponent(currentSupportCategory)"));
  assert.ok(adminView.includes("window.jsonFetch('/api/admin/security/tickets', {method:'POST'"));
  assert.ok(adminView.includes("method: 'PATCH', body: JSON.stringify({status, assigned_to_user_id: assignee})"));
  assert.ok(routes.includes('router.get(\'/tickets\',requireRole([\'super_admin\',\'admin\',\'staff\']),controller.listTickets)'));
});

test('ticket categories are validated and safely migrated for existing databases', () => {
  assert.ok(schema.includes("category VARCHAR(40) NOT NULL DEFAULT 'general' CHECK (category IN ('general','software','website'))"));
  assert.ok(schema.includes('ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category'));
  assert.ok(controller.includes("if(!['all','general','software','website'].includes(category))"));
  assert.ok(controller.includes("if(!['general','software','website'].includes(category))"));
  assert.ok(controller.includes('t.category'));
});
