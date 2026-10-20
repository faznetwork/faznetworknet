'use strict';

// Uses only an explicitly configured test database and a transaction-local temp table.
// It never reads or mutates public.tenants.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');

test('tenant number allocation fills the smallest gap and compacts after deletion', {
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
    await client.query(`
      CREATE TEMP TABLE tenant_number_fixture (
        id BIGINT PRIMARY KEY,
        tenant_number INTEGER NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      ) ON COMMIT DROP
    `);
    await client.query(`
      INSERT INTO tenant_number_fixture(id, tenant_number)
      VALUES (101, 1), (103, 3)
    `);

    const gap = await client.query(`
      SELECT candidate AS tenant_number
      FROM generate_series(1, (SELECT COALESCE(MAX(tenant_number), 0) + 1 FROM tenant_number_fixture)) AS candidate
      WHERE NOT EXISTS (
        SELECT 1 FROM tenant_number_fixture t WHERE t.tenant_number = candidate
      )
      ORDER BY candidate ASC LIMIT 1
    `);
    assert.equal(Number(gap.rows[0].tenant_number), 2);
    await client.query('INSERT INTO tenant_number_fixture(id, tenant_number) VALUES (102, $1)', [Number(gap.rows[0].tenant_number)]);

    await client.query('DELETE FROM tenant_number_fixture WHERE id=102');
    const afterDeleteGap = await client.query(`
      SELECT candidate AS tenant_number
      FROM generate_series(1, (SELECT COALESCE(MAX(tenant_number), 0) + 1 FROM tenant_number_fixture)) AS candidate
      WHERE NOT EXISTS (
        SELECT 1 FROM tenant_number_fixture t WHERE t.tenant_number = candidate
      )
      ORDER BY candidate ASC LIMIT 1
    `);
    assert.equal(Number(afterDeleteGap.rows[0].tenant_number), 2);

    // Match the two-phase compaction used after deleting a tenant; negative staging
    // avoids transient collisions with the tenant_number unique index.
    await client.query(`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY tenant_number ASC, created_at ASC, id ASC)::INTEGER AS next_number
        FROM tenant_number_fixture
      )
      UPDATE tenant_number_fixture t SET tenant_number = -ordered.next_number
      FROM ordered WHERE ordered.id = t.id
    `);
    await client.query('UPDATE tenant_number_fixture SET tenant_number = -tenant_number WHERE tenant_number < 0');
    const ordered = await client.query('SELECT id, tenant_number FROM tenant_number_fixture ORDER BY tenant_number');
    assert.deepEqual(ordered.rows.map(row => Number(row.tenant_number)), [1, 2]);
    assert.deepEqual(ordered.rows.map(row => Number(row.id)), [101, 103]);

    await client.query('ROLLBACK');
  } finally {
    client.release();
    await pool.end();
  }
});
