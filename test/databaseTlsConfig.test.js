'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

const TEST_CA = '-----BEGIN CERTIFICATE-----\\nunit-test-root\\n-----END CERTIFICATE-----';

function runPoolConfiguration(options) {
  const {
    nodeEnv,
    databaseUrl = 'postgresql://unit-test:unit-test@127.0.0.1:5432/unit_test'
  } = options;
  const ca = Object.prototype.hasOwnProperty.call(options, 'ca') ? options.ca : TEST_CA;
  const script = String.raw`
    const Module = require('node:module');
    const originalLoad = Module._load;
    let capturedOptions;
    class MockPool {
      constructor(options) { capturedOptions = options; }
      on() {}
    }
    Module._load = function(request, parent, isMain) {
      if (request === 'pg') return { Pool: MockPool };
      return originalLoad.call(this, request, parent, isMain);
    };
    const db = require('./db');
    db.getPool();
    process.stdout.write(JSON.stringify(capturedOptions));
  `;
  const env = {
    ...process.env,
    NODE_ENV: nodeEnv,
    DATABASE_URL: databaseUrl
  };
  if (ca === undefined) delete env.SUPABASE_CA_CERT;
  else env.SUPABASE_CA_CERT = ca;
  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: require('node:path').join(__dirname, '..'),
    encoding: 'utf8',
    env
  });
  return JSON.parse(output);
}

test('production PostgreSQL pool verifies the Supabase root CA and strips URL TLS overrides', () => {
  const options = runPoolConfiguration({
    nodeEnv: 'production',
    databaseUrl: 'postgresql://unit-test:unit-test@db.example.supabase.co:5432/postgres?sslmode=require&sslrootcert=old.crt&application_name=faznetwork'
  });
  assert.deepEqual(options.ssl, { ca: TEST_CA, rejectUnauthorized: true });
  const parsed = new URL(options.connectionString);
  assert.equal(parsed.searchParams.has('sslmode'), false);
  assert.equal(parsed.searchParams.has('sslrootcert'), false);
  assert.equal(parsed.searchParams.get('application_name'), 'faznetwork');
});

test('production PostgreSQL pool fails closed when the Supabase root CA is missing', () => {
  assert.throws(
    () => runPoolConfiguration({ nodeEnv: 'production', ca: undefined }),
    /SUPABASE_CA_CERT must contain the Supabase PostgreSQL root CA certificate/
  );
});

test('non-production PostgreSQL pool does not force production TLS options', () => {
  const options = runPoolConfiguration({ nodeEnv: 'test', ca: undefined });
  assert.equal(options.ssl, false);
});
