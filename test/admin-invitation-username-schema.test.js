"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const migration = read("migrations/20261025_admin_invitation_username_nullable.sql");
const schema = read("db/schema.sql");
const controller = read("controllers/rbacAuthController.js");

test("admin invitation schema and createUser SQL defer username until acceptance", () => {
  const tableDefinition = schema.match(/CREATE TABLE IF NOT EXISTS admin_invitations \(([\s\S]*?)\n\);/i)?.[1] || "";
  assert.match(tableDefinition, /username\s+VARCHAR\(60\)\s*(?:,|$)/i);
  assert.doesNotMatch(tableDefinition, /username\s+VARCHAR\(60\)\s+NOT NULL/i);
  assert.match(schema, /ALTER TABLE admin_invitations ALTER COLUMN username DROP NOT NULL/i);

  assert.match(controller, /INSERT INTO admin_invitations \(email,role,token_hash,status,created_by,expires_at\)/i);
  assert.doesNotMatch(controller, /INSERT INTO admin_invitations\s*\(username,email,role,token_hash/i);
  assert.match(controller, /UPDATE admin_invitations SET role=\$1, token_hash=\$2/i);
  assert.doesNotMatch(controller, /UPDATE admin_invitations SET username=NULL/i);

  assert.match(migration, /ALTER TABLE admin_invitations ALTER COLUMN username DROP NOT NULL/i);
  assert.match(migration, /RAISE EXCEPTION/i);
  assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|UPDATE\s+(?:customers|transactions|payments|packages|admin_users)/i);
});

test("real PostgreSQL integration: legacy NOT NULL schema accepts a pending invitation without username", {
  skip: !process.env.TEST_DATABASE_URL && "Set TEST_DATABASE_URL to run the real PostgreSQL schema integration test"
}, async () => {
  const { Client } = require("pg");
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  const schemaName = "fzn_invite_contract_" + process.pid + "_" + Date.now();
  const quotedSchema = '"' + schemaName.replace(/"/g, '""') + '"';
  await client.connect();
  try {
    await client.query("CREATE SCHEMA " + quotedSchema);
    await client.query("SET search_path TO " + quotedSchema);
    await client.query("CREATE TABLE admin_invitations (id BIGSERIAL PRIMARY KEY, username VARCHAR(60) NOT NULL, email VARCHAR(254) NOT NULL, role VARCHAR(20) NOT NULL, token_hash CHAR(64), status VARCHAR(20) NOT NULL DEFAULT 'pending', created_by VARCHAR(100) NOT NULL DEFAULT 'owner', expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");

    await client.query(migration);

    const column = await client.query("SELECT is_nullable FROM information_schema.columns WHERE table_schema=$1 AND table_name='admin_invitations' AND column_name='username'", [schemaName]);
    assert.equal(column.rows[0]?.is_nullable, "YES");

    const inserted = await client.query("INSERT INTO admin_invitations (email, role, token_hash, expires_at) VALUES ($1,$2,$3,NOW()+INTERVAL '1 day') RETURNING id,username,email", ["schema-integration@example.invalid", "staff", "a".repeat(64)]);
    assert.equal(inserted.rows.length, 1);
    assert.equal(inserted.rows[0].username, null);
    assert.equal(inserted.rows[0].email, "schema-integration@example.invalid");
  } finally {
    try {
      await client.query("SET search_path TO public");
      await client.query("DROP SCHEMA IF EXISTS " + quotedSchema + " CASCADE");
    } finally {
      await client.end();
    }
  }
});
