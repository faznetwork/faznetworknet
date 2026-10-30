'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('composite POP/reseller runner requires an explicit non-production database target', () => {
  const runner = fs.readFileSync(path.join(root, 'scripts/apply-pop-reseller-migrations.ps1'), 'utf8');
  assert.match(runner, /ExpectedDatabaseName/);
  assert.match(runner, /ConfirmNonProductionTarget/);
  assert.match(runner, /stage\|staging\|test\|disposable/i);
  assert.match(runner, /prod\|production\|live/i);
  assert.match(runner, /current_database\(\)/);
  assert.match(runner, /PGPASSWORD/);
  assert.match(runner, /credentialSeparator/);
  assert.doesNotMatch(runner, /& \$psql\.Source \$DatabaseUrl/);
  assert.match(runner, /-cne \$ExpectedDatabaseName/);
});

test('composite runner removes only standalone migration transaction markers and delegates atomicity to psql', () => {
  const runner = fs.readFileSync(path.join(root, 'scripts/apply-pop-reseller-migrations.ps1'), 'utf8');
  assert.match(runner, /--single-transaction/);
  assert.match(runner, /ON_ERROR_STOP=1/);
  assert.match(runner, /BEGIN\\s\*/);
  assert.match(runner, /COMMIT\\s\*/);
  assert.match(runner, /exactly one standalone BEGIN/);
  assert.match(runner, /original migration files are not modified/i);

  for (const name of [
    '20261030_pop_reseller_architecture.sql',
    '20261030_reseller_email_invitations.sql',
    '20261030_rate_limits.sql'
  ]) {
    const sql = fs.readFileSync(path.join(root, 'db/migrations', name), 'utf8');
    assert.match(sql, /^\s*BEGIN\s*;/m, name + ' must retain its standalone BEGIN');
    assert.match(sql, /^\s*COMMIT\s*;/m, name + ' must retain its standalone COMMIT');
  }
});

test('composite runner includes all three migrations in the approved order', () => {
  const runner = fs.readFileSync(path.join(root, 'scripts/apply-pop-reseller-migrations.ps1'), 'utf8');
  const orderedMigrations = [
    '20261030_pop_reseller_architecture.sql',
    '20261030_reseller_email_invitations.sql',
    '20261030_rate_limits.sql'
  ];
  let previousIndex = -1;
  for (const migration of orderedMigrations) {
    const index = runner.indexOf(migration);
    assert.ok(index > previousIndex, migration + ' must be present in execution order');
    previousIndex = index;
  }
  assert.match(runner, /Applying all three POP\/reseller migrations in one PostgreSQL transaction/);
  assert.match(runner, /SUCCESS: all three migrations committed atomically/);
});
