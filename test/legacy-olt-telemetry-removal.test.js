"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("legacy OLT telemetry routes, cache reads, and collector execution are disabled", () => {
  const server = read("server.js");
  const dashboardController = read("controllers/dashboardController.js");
  const schema = read("db/schema.sql");
  const customerController = read("controllers/customerController.js");
  const networkMapController = read("controllers/networkMapController.js");
  const adminView = read("views/admin.ejs");
  const customerProfileView = read("views/customer-profile.ejs");
  const collector = read("local-olt-collector/collector.py");
  const nodeCollector = read("scripts/olt-collector.js");

  assert.doesNotMatch(server, /\/api\/olt\/(?:telemetry|sync-telemetry)|oltTelemetryController/);
  assert.doesNotMatch(dashboardController, /olt_telemetry|rx_power_dbm|fiber:/i);
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS olt_telemetry|ALTER TABLE olt_telemetry|onu_rx_power_(?:dbm|observed_at|source_device_id)/i);
  assert.doesNotMatch(customerController, /FROM\s+olt_telemetry/i);
  assert.doesNotMatch(networkMapController, /onu_rx_power|rxPower|rx_power_source|getRxPowerStatus|LEFT JOIN network_devices d ON d.id=c\.onu_rx_power_source_device_id/i);
  assert.doesNotMatch(adminView, /\/api\/olt\/(?:telemetry|sync-telemetry)/);
  assert.doesNotMatch(customerProfileView, /\/api\/olt\/(?:telemetry|sync-telemetry)|Network Topology Bridge|ONU RX Power|onuRxPowerValue|topoPon/i);
  assert.doesNotMatch(adminView, /cpOpticalTelemetryCards|cpOpticalHealthBadge|cpOpticalRx|cpOpticalTx|nocFiberValue|nocFiberSub|nocOltStatus|nocUrgentBody|nocPonSummary/);

  assert.doesNotMatch(collector, /pysnmp|urllib\.request|def collect\(|def push\(|while\s+True|RENDER_INGEST_URL/);
  assert.match(collector, /OLT telemetry collector is disabled/);
  assert.match(nodeCollector, /OLT telemetry collector is disabled/);
  assert.doesNotMatch(nodeCollector, /net-snmp|createSession|sync-telemetry|setInterval/);
});

test("cleanup migration retires OLT telemetry storage without changing customer or business records", () => {
  const migration = read("migrations/20261025_disable_olt_telemetry.sql");

  assert.match(migration, /UPDATE\s+customers\s+SET[\s\S]*onu_rx_power_dbm\s*=\s*NULL/i);
  assert.match(migration, /onu_rx_power_observed_at\s*=\s*NULL/i);
  assert.match(migration, /onu_rx_power_source_device_id\s*=\s*NULL/i);
  assert.match(migration, /DELETE FROM\s+olt_telemetry/i);
  const customerUpdate = migration.match(/UPDATE\s+customers[\s\S]*?;/i)?.[0] || "";
  assert.doesNotMatch(customerUpdate, /router_mac|onu_mac|username|password|balance|package|billing|transaction/i);
  assert.doesNotMatch(migration, /DELETE FROM\s+customers/i);
  assert.match(migration, /to_regclass/i);
  assert.match(migration, /DROP TABLE olt_telemetry/i);
  assert.match(migration, /DROP COLUMN IF EXISTS onu_rx_power_source_device_id/i);
  assert.match(migration, /DROP COLUMN IF EXISTS onu_rx_power_observed_at/i);
  assert.match(migration, /DROP COLUMN IF EXISTS onu_rx_power_dbm/i);
});

test("customer, billing, and MikroTik network-discovery structures remain intact", () => {
  const schema = read("db/schema.sql");
  const customerController = read("controllers/customerController.js");
  const networkMapController = read("controllers/networkMapController.js");
  const networkMapRoutes = read("routes/networkMapRoutes.js");
  const networkDiscovery = read("jobs/networkDiscovery.js");

  assert.match(schema, /CREATE TABLE IF NOT EXISTS customers/i);
  assert.match(schema, /onu_mac/i);
  assert.match(schema, /router_mac/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS transactions/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS network_devices/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS network_observations/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS network_discovery_runs/i);
  assert.match(customerController, /FROM pppoe_live_sessions/i);
  assert.match(customerController, /FROM transactions/i);
  assert.match(customerController, /FROM packages/i);
  assert.match(networkMapController, /FROM network_observations/i);
  assert.match(networkMapController, /pppoe_session/i);
  assert.match(networkMapController, /routerMac/);
  assert.match(networkMapRoutes, /router\.get\("\/customers\/:id", controller\.getCustomerMap\)/);
  assert.match(networkDiscovery, /routeros_api|mikrotik_api/);
  assert.match(networkDiscovery, /routerMac/);
});
