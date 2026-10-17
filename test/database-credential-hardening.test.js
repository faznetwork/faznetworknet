'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const db = require('../db');

test('database module never falls back to a hard-coded connection string', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
  assert.doesNotMatch(source, /postgres(?:ql)?:\/\/[^\s"'\x60]+/i);
  assert.match(source, /DATABASE_URL environment variable is required/);
});

test('database URL validation rejects a missing DATABASE_URL', () => {
  const original = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    assert.equal(db.isConfigured(), false);
    assert.throws(() => db.getDatabaseUrl(), /DATABASE_URL environment variable is required/);
    assert.throws(() => db.getPool(), /DATABASE_URL environment variable is required/);
  } finally {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  }
});

test('database URL validation accepts an explicitly configured URL', () => {
  const original = process.env.DATABASE_URL;
  try {
    process.env.DATABASE_URL = 'postgresql://example.invalid:5432/faznetwork_test';
    assert.equal(db.isConfigured(), true);
    assert.equal(db.getDatabaseUrl(), process.env.DATABASE_URL);
  } finally {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  }
});
