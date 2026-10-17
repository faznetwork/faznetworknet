#!/usr/bin/env node
'use strict';

/**
 * FAZ NETWORK Render -> Supabase PostgreSQL migration.
 *
 * Safe defaults:
 *   node migrate-database.js              # read-only preflight / dry run
 *   node migrate-database.js --execute    # performs a single destination transaction
 *
 * Required environment variables:
 *   RENDER_DATABASE_URL
 *   SUPABASE_DATABASE_URL
 *   MIGRATION_CONFIRM=YES                  # required with --execute
 *
 * This script intentionally refuses to merge into an existing public schema.
 * Run it from a clean checkout with db/schema.sql from the reviewed branch.
 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('pg');

const BATCH_SIZE = Math.max(25, Math.min(1000, Number(process.env.MIGRATION_BATCH_SIZE || 250)));
const EXECUTE = process.argv.includes('--execute');
const SOURCE_URL = process.env.RENDER_DATABASE_URL;
const DEST_URL = process.env.SUPABASE_DATABASE_URL;
const EXPECTED_CONFIRMATION = 'YES';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function quoteIdent(value) {
  return '"' + String(value).replace(/"/g, '""') + '"';
}
function qualified(schema, table) {
  return quoteIdent(schema) + '.' + quoteIdent(table);
}
function stable(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stable).join(',') + ']';
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + stable(value[k])).join(',') + '}';
}
function hashRow(hash, row) {
  hash.update(stable(row));
  hash.update('\n');
}
async function connect(url, applicationName) {
  const client = new Client({
    connectionString: url,
    application_name: applicationName,
    connectionTimeoutMillis: 10000,
    statement_timeout: 120000,
    query_timeout: 120000,
    ssl: { rejectUnauthorized: process.env.PGSSL_REJECT_UNAUTHORIZED !== 'false' }
  });
  await client.connect();
  return client;
}
async function listPublicTables(client) {
  const { rows } = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  return rows.map(r => r.table_name);
}
async function tableColumns(client, table) {
  const { rows } = await client.query(`
    SELECT column_name, data_type, udt_name, is_nullable, column_default,
           is_identity, identity_generation, ordinal_position
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = $1
    ORDER BY ordinal_position
  `, [table]);
  return rows;
}
async function primaryKeyColumns(client, table) {
  const { rows } = await client.query(`
    SELECT a.attname AS column_name, k.ordinality
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality) ON TRUE
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
    WHERE n.nspname = 'public' AND t.relname = $1 AND i.indisprimary
    ORDER BY k.ordinality
  `, [table]);
  return rows.map(r => r.column_name);
}
async function foreignKeyDependencies(client, tables) {
  const { rows } = await client.query(`
    SELECT tc.table_name AS child_table, ccu.table_name AS parent_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_catalog = tc.constraint_catalog
     AND ccu.constraint_schema = tc.constraint_schema
     AND ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_schema = 'public'
  `);
  const names = new Set(tables);
  return rows.filter(r => names.has(r.child_table) && names.has(r.parent_table) && r.child_table !== r.parent_table);
}
function dependencyOrder(tables, dependencies) {
  const remaining = new Set(tables);
  const ordered = [];
  while (remaining.size) {
    const ready = [...remaining].filter(t =>
      !dependencies.some(d => d.child_table === t && remaining.has(d.parent_table))
    ).sort();
    assert(ready.length, 'Foreign-key dependency cycle detected. Migration stopped safely; review cyclic constraints before retrying.');
    for (const t of ready) {
      ordered.push(t);
      remaining.delete(t);
    }
  }
  return ordered;
}
async function readRowsInBatches(client, table, columns, pk, callback) {
  const order = (pk.length ? pk : columns.map(c => c.column_name)).map(quoteIdent).join(', ');
  let offset = 0;
  while (true) {
    const { rows } = await client.query(
      `SELECT ${columns.map(c => quoteIdent(c.column_name)).join(', ')} FROM public.${quoteIdent(table)} ORDER BY ${order} LIMIT $1 OFFSET $2`,
      [BATCH_SIZE, offset]
    );
    if (!rows.length) break;
    await callback(rows);
    offset += rows.length;
  }
}
async function countRows(client, table) {
  const { rows } = await client.query(`SELECT count(*)::bigint AS count FROM public.${quoteIdent(table)}`);
  return Number(rows[0].count);
}
async function checksumTable(client, table, columns, pk) {
  const digest = crypto.createHash('sha256');
  let count = 0;
  await readRowsInBatches(client, table, columns, pk, async rows => {
    for (const row of rows) {
      const ordered = {};
      for (const col of columns) ordered[col.column_name] = row[col.column_name];
      hashRow(digest, ordered);
      count++;
    }
  });
  return { count, sha256: digest.digest('hex') };
}
async function verifyColumnCompatibility(source, destination, table) {
  const sourceCols = await tableColumns(source, table);
  const destCols = await tableColumns(destination, table);
  const destByName = new Map(destCols.map(c => [c.column_name, c]));
  for (const col of sourceCols) {
    const dest = destByName.get(col.column_name);
    assert(dest, `Destination schema is missing ${table}.${col.column_name}; no data was copied.`);
    assert(
      col.udt_name === dest.udt_name || (col.data_type === dest.data_type && col.data_type === 'USER-DEFINED'),
      `Type mismatch for ${table}.${col.column_name}: source ${col.udt_name}, destination ${dest.udt_name}.`
    );
  }
  for (const col of destCols) {
    if (sourceCols.some(s => s.column_name === col.column_name)) continue;
    assert(col.is_nullable === 'YES' || col.column_default !== null || col.is_identity === 'YES',
      `Destination-only column ${table}.${col.column_name} is required and has no default; migration stopped.`);
  }
  return sourceCols;
}
async function setSequences(destination, tables) {
  const aligned = [];
  for (const table of tables) {
    const cols = await tableColumns(destination, table);
    for (const col of cols) {
      const { rows } = await destination.query(
        'SELECT pg_get_serial_sequence($1, $2) AS sequence_name',
        [`public.${table}`, col.column_name]
      );
      const sequenceName = rows[0]?.sequence_name;
      if (!sequenceName) continue;
      const { rows: maxRows } = await destination.query(
        `SELECT max(${quoteIdent(col.column_name)}) AS max_value FROM public.${quoteIdent(table)}`
      );
      const maxValue = maxRows[0].max_value;
      // is_called=false for an empty table means the next nextval() returns the sequence start value.
      await destination.query(
        'SELECT setval($1::regclass, $2::bigint, $3::boolean)',
        [sequenceName, maxValue === null ? 1 : maxValue, maxValue !== null]
      );
      aligned.push({ table, column: col.column_name, sequence: sequenceName, maxValue });
    }
  }
  return aligned;
}

async function main() {
  assert(SOURCE_URL && DEST_URL, 'Set RENDER_DATABASE_URL and SUPABASE_DATABASE_URL in the secure runner environment.');
  assert(SOURCE_URL !== DEST_URL, 'Source and destination URLs must be different.');
  if (EXECUTE) {
    assert(process.env.MIGRATION_CONFIRM === EXPECTED_CONFIRMATION,
      'Write mode requires MIGRATION_CONFIRM=YES in the secure runner environment.');
  }

  const source = await connect(SOURCE_URL, 'faznetwork-migration-source-readonly');
  const destination = await connect(DEST_URL, 'faznetwork-migration-destination');
  let sourceTransaction = false;
  let destinationTransaction = false;

  try {
    await source.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    sourceTransaction = true;

    const sourceTables = await listPublicTables(source);
    assert(sourceTables.length > 0, 'Source public schema contains no tables.');
    const before = {};
    for (const table of sourceTables) {
      const result = await source.query(`SELECT count(*)::bigint AS count FROM public.${quoteIdent(table)}`);
      before[table] = Number(result.rows[0].count);
    }
    const sourceDependencies = await foreignKeyDependencies(source, sourceTables);
    const order = dependencyOrder(sourceTables, sourceDependencies);
    const sourceChecksums = {};
    const sourceColumns = {};
    for (const table of sourceTables) {
      sourceColumns[table] = await tableColumns(source, table);
      sourceChecksums[table] = await checksumTable(source, table, sourceColumns[table], await primaryKeyColumns(source, table));
    }

    const existingDestinationTables = await listPublicTables(destination);
    const schemaPath = path.join(__dirname, 'db', 'schema.sql');
    assert(fs.existsSync(schemaPath), 'db/schema.sql not found. Run from repository root.');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log(JSON.stringify({
      mode: EXECUTE ? 'EXECUTE' : 'DRY_RUN',
      sourceTables: sourceTables.length,
      sourceRows: Object.values(before).reduce((a, b) => a + b, 0),
      destinationPublicTablesBefore: existingDestinationTables.length,
      tableCountsBefore: before,
      dependencyOrder: order,
      note: 'No destination writes occur in dry-run mode.'
    }, null, 2));

    if (!EXECUTE) return;
    assert(existingDestinationTables.length === 0,
      'Destination public schema is not empty. Refusing to merge or overwrite existing application tables.');

    await destination.query('BEGIN');
    destinationTransaction = true;
    await destination.query("SET LOCAL lock_timeout = '10s'");
    await destination.query("SET LOCAL statement_timeout = '120s'");
    await destination.query(schemaSql);

    const destinationTablesAfterSchema = await listPublicTables(destination);
    const missingTables = sourceTables.filter(t => !destinationTablesAfterSchema.includes(t));
    assert(missingTables.length === 0, `Schema did not create source tables: ${missingTables.join(', ')}`);

    // db/schema.sql seeds default app_settings keys. The target was proven to have no public
    // tables before this transaction, so remove only those schema-bootstrap rows before copying
    // the authoritative source rows. The surrounding transaction rolls this back on any error.
    if (sourceTables.includes('app_settings')) {
      await destination.query('DELETE FROM public.app_settings');
    }
    for (const table of destinationTablesAfterSchema) {
      const n = await countRows(destination, table);
      assert(n === 0, `Schema initialization unexpectedly populated public.${table}; refusing to continue.`);
    }

    const columnsByTable = {};
    for (const table of sourceTables) {
      columnsByTable[table] = await verifyColumnCompatibility(source, destination, table);
    }

    for (const table of order) {
      const columns = columnsByTable[table];
      const pk = await primaryKeyColumns(source, table);
      await readRowsInBatches(source, table, columns, pk, async rows => {
        for (let start = 0; start < rows.length; start += BATCH_SIZE) {
          const batch = rows.slice(start, start + BATCH_SIZE);
          if (!batch.length) continue;
          const colNames = columns.map(c => quoteIdent(c.column_name)).join(', ');
          const params = [];
          const values = batch.map(row => '(' + columns.map(c => {
            params.push(row[c.column_name]);
            return '$' + params.length;
          }).join(', ') + ')').join(', ');
          await destination.query(
            `INSERT INTO public.${quoteIdent(table)} (${colNames}) VALUES ${values}`,
            params
          );
        }
      });
    }

    // Verify exact counts and canonical row checksums before commit.
    const after = {};
    const destinationChecksums = {};
    for (const table of sourceTables) {
      after[table] = await countRows(destination, table);
      destinationChecksums[table] = await checksumTable(
        destination, table, columnsByTable[table], await primaryKeyColumns(source, table)
      );
      assert(after[table] === before[table],
        `Row-count mismatch in ${table}: source=${before[table]}, destination=${after[table]}.`);
      assert(destinationChecksums[table].sha256 === sourceChecksums[table].sha256,
        `Checksum mismatch in ${table}; transaction will roll back.`);
    }

    const sequences = await setSequences(destination, sourceTables);
    await destination.query('COMMIT');
    destinationTransaction = false;

    console.log(JSON.stringify({
      status: 'SUCCESS',
      sourceRows: Object.values(before).reduce((a, b) => a + b, 0),
      destinationRows: Object.values(after).reduce((a, b) => a + b, 0),
      droppedRows: 0,
      tableCountsAfter: after,
      checksums: Object.fromEntries(sourceTables.map(t => [t, {
        source: sourceChecksums[t].sha256,
        destination: destinationChecksums[t].sha256,
        match: sourceChecksums[t].sha256 === destinationChecksums[t].sha256
      }])),
      sequencesAligned: sequences
    }, null, 2));
  } catch (error) {
    if (destinationTransaction) {
      try { await destination.query('ROLLBACK'); } catch (_) {}
    }
    throw error;
  } finally {
    if (sourceTransaction) {
      try { await source.query('ROLLBACK'); } catch (_) {}
    }
    await Promise.allSettled([source.end(), destination.end()]);
  }
}

main().catch(error => {
  console.error('[Migration stopped safely]', error.message);
  process.exitCode = 1;
});
