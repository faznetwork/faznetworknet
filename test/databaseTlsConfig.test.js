'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

function readPoolOptions(nodeEnv) {
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
  const output = execFileSync(process.execPath, ['-e', script], {
    cwd: require('node:path').join(__dirname, '..'),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: nodeEnv,
      DATABASE_URL: 'postgresql://unit-test:unit-test@127.0.0.1:5432/unit_test'
    }
  });
  return JSON.parse(output);
}

test('production PostgreSQL pool enforces TLS certificate verification', () => {
  const options = readPoolOptions('production');
  assert.deepEqual(options.ssl, { rejectUnauthorized: true });
});

test('non-production PostgreSQL pool does not force production TLS options', () => {
  const options = readPoolOptions('test');
  assert.equal(options.ssl, false);
});
