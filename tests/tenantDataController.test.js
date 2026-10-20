'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../db');
const controller = require('../controllers/tenantDataController');

function response() {
  return {
    statusCode: 200, body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}
function request({ tenantId = 41, tenantAdmin = true, params = {}, body = {} } = {}) {
  return { session: { tenantId, tenantAdmin, isAdmin: false }, params, body };
}
async function withQueryStub(fn, handler) {
  const original = db.query;
  const calls = [];
  db.query = async (sql, params) => { calls.push({ sql: String(sql), params }); return fn(String(sql), params); };
  try { await handler(calls); } finally { db.query = original; }
}

test('customer list and writes always scope SQL to the authenticated tenant', async () => {
  await withQueryStub(async () => ({ rows: [{ id: 1 }], rowCount: 1 }), async calls => {
    let res = response();
    await controller.listCustomers(request({ tenantId: 41 }), res);
    assert.equal(res.statusCode, 200);
    assert.match(calls[0].sql, /FROM public\.customers WHERE tenant_id=\$1/i);
    assert.deepEqual(calls[0].params, [41]);

    res = response();
    await controller.updateCustomer(request({ tenantId: 41, params: { id: '9' }, body: { full_name: 'A' } }), res);
    assert.match(calls[1].sql, /WHERE tenant_id=\$1 AND id=\$2/i);
    assert.deepEqual(calls[1].params.slice(0, 2), [41, 9]);

    res = response();
    await controller.deleteCustomer(request({ tenantId: 41, params: { id: '9' } }), res);
    assert.match(calls[2].sql, /DELETE FROM public\.customers WHERE tenant_id=\$1 AND id=\$2/i);
    assert.deepEqual(calls[2].params, [41, 9]);
  });
});

test('new customer rows inherit tenant_id from session, never from request body', async () => {
  await withQueryStub(async () => ({ rows: [{ id: 2, tenant_id: 41 }], rowCount: 1 }), async calls => {
    const res = response();
    await controller.createCustomer(request({
      tenantId: 41,
      body: { full_name: 'Test', phone: 'test-phone', username: 'test-user', password: 'pw', package_name: 'basic', profile: 'basic', monthly_bill: 10, tenant_id: 999 }
    }), res);
    assert.equal(res.statusCode, 201);
    assert.match(calls[0].sql, /INSERT INTO public\.customers\s*\(tenant_id,/i);
    assert.equal(calls[0].params[0], 41);
    assert.equal(calls[0].params.includes(999), false);
  });
});

test('voucher and billing list/create/update/delete SQL is tenant-scoped', async () => {
  await withQueryStub(async () => ({ rows: [{ id: 1, tenant_id: 41 }], rowCount: 1 }), async calls => {
    await controller.listVouchers(request({ tenantId: 41 }), response());
    assert.match(calls[0].sql, /FROM public\.hotspot_vouchers WHERE tenant_id=\$1/i);
    assert.deepEqual(calls[0].params, [41]);

    await controller.createVoucher(request({ tenantId: 41, body: { username: 'v', password: 'p', profile: 'basic', validity: '1d', tenant_id: 999 } }), response());
    assert.match(calls[1].sql, /INSERT INTO public\.hotspot_vouchers\(tenant_id,/i);
    assert.equal(calls[1].params[0], 41);

    await controller.listTransactions(request({ tenantId: 41 }), response());
    assert.match(calls[2].sql, /FROM public\.transactions WHERE tenant_id=\$1/i);
    assert.deepEqual(calls[2].params, [41]);

    await controller.createTransaction(request({ tenantId: 41, body: { channel: 'bkash', trx_id: 't', amount: 5, tenant_id: 999 } }), response());
    assert.match(calls[3].sql, /INSERT INTO public\.transactions\(tenant_id,/i);
    assert.equal(calls[3].params[0], 41);

    await controller.updateVoucher(request({ tenantId: 41, params: { id: '5' }, body: { status: 'active' } }), response());
    assert.match(calls[4].sql, /WHERE tenant_id=\$1 AND id=\$2/i);
    assert.deepEqual(calls[4].params.slice(0, 2), [41, 5]);

    await controller.deleteVoucher(request({ tenantId: 41, params: { id: '5' } }), response());
    assert.match(calls[5].sql, /DELETE FROM public\.hotspot_vouchers WHERE tenant_id=\$1 AND id=\$2/i);
    assert.deepEqual(calls[5].params, [41, 5]);
  });
});

test('tenant endpoints reject missing tenant identity without querying database', async () => {
  await withQueryStub(async () => { throw new Error('must not query'); }, async calls => {
    const res = response();
    await controller.listCustomers(request({ tenantId: null, tenantAdmin: false }), res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.body.code, 'TENANT_CONTEXT_REQUIRED');
    assert.equal(calls.length, 0);
  });
});
