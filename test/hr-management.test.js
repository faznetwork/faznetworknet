const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const adminView = read('views/admin.ejs');
const server = read('server.js');
const schema = read('db/schema.sql');
const controller = read('controllers/hrController.js');
const routes = read('routes/hrRoutes.js');

test('HR submenu paths restore the matching department and employee views', () => {
  assert.ok(adminView.includes("'/admin/hr/departments': { view: 'hr', section: 'departments' }"));
  assert.ok(adminView.includes("'/admin/hr/employees': { view: 'hr', section: 'employees' }"));
  assert.ok(adminView.includes("'/admin/hr/employees/added': { view: 'hr', section: 'added' }"));
  assert.ok(adminView.includes("case 'hr': return callIfAvailable('loadHRModule', [r.section]);"));
  assert.ok(adminView.includes("case 'loadHRModule': return { view: 'hr'"));
});

test('HR APIs are protected and mounted separately from customer billing APIs', () => {
  assert.ok(server.includes('app.use("/api/hr",require("./routes/hrRoutes"));'));
  assert.ok(server.includes('app.get(/^\\/admin\\/hr\\/.*/,requireRole(["super_admin","admin"])'));
  assert.ok(routes.includes("router.use(requireRole(['super_admin','admin']));"));
  for (const endpoint of ["router.get('/departments'", "router.post('/departments'", "router.put('/departments/:id'", "router.delete('/departments/:id'", "router.get('/employees'", "router.post('/employees'", "router.put('/employees/:id'", "router.delete('/employees/:id'"]) {
    assert.ok(routes.includes(endpoint), 'missing endpoint ' + endpoint);
  }
});

test('HR schema is separate and department deletion protects employee references', () => {
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS hr_departments'));
  assert.ok(schema.includes('CREATE TABLE IF NOT EXISTS hr_employees'));
  assert.ok(schema.includes('REFERENCES hr_departments(id) ON DELETE SET NULL'));
  assert.ok(controller.includes('Move employees to another department before deleting this department.'));
  assert.ok(controller.includes('employee_code'));
});

test('HR and placeholder pages preserve static admin views and use responsive Bootstrap layouts', () => {
  assert.ok(adminView.includes("root.id = 'fazDynamicModuleRoot'"));
  assert.ok(adminView.includes("root.innerHTML = '<section class=\"p-2 p-md-3\""));
  assert.ok(adminView.includes('class="col-12 col-md-6 col-xl-4"'));
  assert.ok(adminView.includes('class="table-responsive border rounded-3"'));
  assert.ok(adminView.includes("function showAdminModulePlaceholder(moduleKey)"));
  assert.ok(!adminView.includes("dynamic.innerHTML = `\n                    <section class=\"admin-view p-2 p-md-3\""));
});
