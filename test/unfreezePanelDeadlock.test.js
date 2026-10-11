const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const read = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("public homepage never opens a live MikroTik connection", () => {
  const server = read("server.js");
  assert.doesNotMatch(server, /publicMikrotikService\.getHotspotProfiles\s*\(/);
  assert.doesNotMatch(server, /require\(["']\.\/services\/mikrotikService["']\)/);
  assert.match(server, /Saved hotspot metadata unavailable/);
});

test("MikroTik API disables socket idle timeout but keeps operation deadlines", () => {
  const service = read("services/mikrotikService.js");
  assert.match(service, /const CONNECTION_TIMEOUT_MS = 1000/);
  assert.match(service, /const OPERATION_TIMEOUT_MS = 10000/);
  assert.match(service, /timeout: 0/);
  assert.match(service, /socket\.setTimeout\(0\)/);
  assert.match(service, /_executeWithTimeout\(/);
  assert.match(service, /_startHeartbeat\(connection\)/);
  assert.match(service, /}, 30000\)/);
  assert.match(service, /connection\.on\("close"/);
  assert.match(service, /connection\.on\("error"/);
  assert.match(service, /this\._connection = null/);
  assert.match(service, /this\._operationQueue = Promise\.resolve\(\)/);
  assert.match(service, /_getPersistentConnection\(config\)/);
  assert.match(service, /connection\.write = \(\.\.\.args\) =>/);
  assert.match(service, /_resetPersistentConnection\(connection/);
  assert.match(service, /MikroTik connection handshake/);
  assert.match(service, /this\._safeClose\(connection\);/);
  assert.doesNotMatch(service, /await this\._safeClose\(connection\)/);
});

test("admin diagnostics bound both database and router waits", () => {
  const diagnostics = read("controllers/adminDiagnosticsController.js");
  assert.match(diagnostics, /withTimeout\(db\.query\("SELECT 1"\), 1500/);
  // Diagnostics now performs a bounded TCP probe before the RouterOS API test.
  assert.match(diagnostics, /function testTcp\(host, port, timeoutMs = 2500\)/);
  assert.match(diagnostics, /withTimeout\(\s*mikrotikService\.testConnection\(\),\s*7500/);
  assert.match(diagnostics, /clearTimeout\(timer\)/);
});

test("admin dashboard avoids duplicate RouterOS polling and pauses hidden-dashboard traffic", () => {
  const admin = read("views/admin.ejs");
  assert.match(admin, /if \(!dashboard \|\| dashboard\.style\.display === 'none'\) return;/);
  assert.match(admin, /trafficTimer = setInterval\(\(\) => \{ void pollTraffic\(\); \}, 1000\)/);
  assert.match(admin, /\}, 15000\);/);
  assert.doesNotMatch(admin, /initial dashboard refresh/);
  assert.doesNotMatch(admin, /safeAdminBootStep\('router metrics'/);
});

test("admin inline script has no accidentally escaped line break before router test handler", () => {
  const admin = read("views/admin.ejs");
  assert.doesNotMatch(
    admin,
    /Boolean\(d\.success\)\);\\n\s*document\.getElementById\('generalRouterTestBtn'\)/
  );
  assert.match(admin, /document\.getElementById\('generalRouterTestBtn'\)\?\.addEventListener/);
});
