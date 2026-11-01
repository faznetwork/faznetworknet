const test=require('node:test');
const assert=require('node:assert/strict');
const db=require('../db');
const controller=require('../controllers/dashboardController');

test('business overview runs KPI queries concurrently and returns normalized metrics',async(t)=>{
  const calls=[];
  t.mock.method(db,'query',async(sql)=>{
    calls.push(sql);
    if(sql.includes('AS monthly_income'))return{rows:[{monthly_income:'1200.00',yearly_income:'14400.00',today_collection:'300.00',outstanding_due:'900.00',due_accounts:2}]};
    if(sql.includes('AS active_pppoe'))return{rows:[{total_pppoe:8,active_pppoe:8,active_pppoe_current:7}]};
    if(sql.includes('AS active_hotspot'))return{rows:[{active_hotspot:5,total_hotspot:12}]};
    if(sql.includes('AS active_pops'))return{rows:[{active_pops:3,active_resellers:2,active_staff:4}]};
    if(sql.includes('AS expiring_soon'))return{rows:[{expiring_soon:1,expiring_hotspot:2,open_tickets:6}]};
    throw new Error('Unexpected KPI query');
  });
  let statusCode=200,payload;
  const res={set(){},status(code){statusCode=code;return this;},json(value){payload=value;return this;}};
  await controller.businessOverview({},res);
  assert.equal(statusCode,200);
  assert.equal(calls.length,5);
  assert.deepEqual(payload.financial,{monthlyIncome:1200,yearlyIncome:14400,todayCollection:300,outstandingDue:900,dueAccounts:2});
  assert.deepEqual(payload.customers,{activePppoe:7,totalPppoe:8,activeHotspot:5,totalHotspot:12});
  assert.deepEqual(payload.infrastructure,{activePops:3,activeResellers:2,activeStaff:4});
  assert.deepEqual(payload.operations,{expiringSoon:3,openTickets:6});
});

test('business overview query and UI remain available behind the existing admin read-only guards',async()=>{
  const fs=require('node:fs');
  const server=fs.readFileSync(require.resolve('../server'),'utf8');
  const view=fs.readFileSync(require.resolve('../views/admin.ejs'),'utf8');
  assert.match(server,/\/api\/dashboard\/business-overview",requireAdmin,requireRole\(\["super_admin","admin","staff"\]\),requireStaffReadOnly,dashboardController\.businessOverview/);
  assert.match(view,/id="businessOverviewGrid" class="business-kpi-grid"/);
  assert.match(view,/business-kpi-grid\{grid-template-columns:1fr/);
  assert.match(view,/family=Outfit/);
});
