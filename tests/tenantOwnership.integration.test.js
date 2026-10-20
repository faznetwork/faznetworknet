'use strict';

// Real PostgreSQL isolation test. It is intentionally skipped without an explicit
// DATABASE_URL; it never targets production by default and rolls all fixtures back.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');

test('PostgreSQL tenant ownership keeps customer, voucher and billing rows isolated', {
  skip: !String(process.env.TENANT_TEST_DATABASE_URL || '').trim()
}, async () => {
  const pool = new Pool({
    connectionString: process.env.TENANT_TEST_DATABASE_URL,
    max: 1,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const columns = await client.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema='public'
        AND (table_name, column_name) IN
          (('customers','tenant_id'),('hotspot_vouchers','tenant_id'),('transactions','tenant_id'))
    `);
    const present = new Set(columns.rows.map(row => row.table_name + '.' + row.column_name));
    for (const required of ['customers.tenant_id','hotspot_vouchers.tenant_id','transactions.tenant_id']) {
      assert.ok(present.has(required), 'ownership migration must be applied before integration tests: ' + required);
    }

    const suffix = require('crypto').randomUUID();
    const tenantA = (await client.query(
      `INSERT INTO public.tenants(name,slug,status,modules) VALUES($1,$2,'active',$3::jsonb) RETURNING id`,
      ['Isolation Test A', 'test-a-' + suffix, JSON.stringify({ hotspot: true, billing: true })]
    )).rows[0].id;
    const tenantB = (await client.query(
      `INSERT INTO public.tenants(name,slug,status,modules) VALUES($1,$2,'active',$3::jsonb) RETURNING id`,
      ['Isolation Test B', 'test-b-' + suffix, JSON.stringify({ hotspot: true, billing: true })]
    )).rows[0].id;

    await client.query(
      `INSERT INTO public.customers(tenant_id,full_name,phone,connection_date,username,password,package_name,profile,monthly_bill)
       VALUES ($1,'Tenant A Customer',$2,CURRENT_DATE,$3,'test','Test','Test',100),
              ($4,'Tenant B Customer',$5,CURRENT_DATE,$6,'test','Test','Test',100)`,
      [tenantA, 'phone-a-' + suffix, 'user-a-' + suffix, tenantB, 'phone-b-' + suffix, 'user-b-' + suffix]
    );
    await client.query(
      `INSERT INTO public.transactions(tenant_id,channel,trx_id,amount,status)
       VALUES ($1,'bkash',$2,100,'unmatched'),($3,'nagad',$4,200,'unmatched')`,
      [tenantA, 'trx-a-' + suffix, tenantB, 'trx-b-' + suffix]
    );
    await client.query(
      `INSERT INTO public.hotspot_vouchers(tenant_id,username,password,profile,validity)
       VALUES ($1,$2,'test','Test','1d'),($3,$4,'test','Test','1d')`,
      [tenantA, 'voucher-a-' + suffix, tenantB, 'voucher-b-' + suffix]
    );

    for (const [table, marker] of [
      ['customers', 'user-a-' + suffix],
      ['transactions', 'trx-a-' + suffix],
      ['hotspot_vouchers', 'voucher-a-' + suffix]
    ]) {
      const column = table === 'customers' ? 'username' : table === 'transactions' ? 'trx_id' : 'username';
      const own = await client.query(`SELECT 1 FROM public.${table} WHERE tenant_id=$1 AND ${column}=$2`, [tenantA, marker]);
      const cross = await client.query(`SELECT 1 FROM public.${table} WHERE tenant_id=$1 AND ${column}=$2`, [tenantB, marker]);
      assert.equal(own.rowCount, 1, table + ': owner should see own row');
      assert.equal(cross.rowCount, 0, table + ': other tenant must not see row');
    }
    await client.query('ROLLBACK');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
});
