"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("legacy OLT telemetry routes, runtime queries, and UI polling are removed", () => {
  const server = read("server.js");
  const schema = read("db/schema.sql");
  const customerController = read("controllers/customerController.js");
  const networkMapController = read("controllers/networkMapController.js");
  const adminView = read("views/admin.ejs");
  const customerProfileView = read("views/customer-profile.ejs");

  assert.doesNotMatch(server, /\/api\/olt\/(?:telemetry|sync-telemetry)|oltTelemetryController/);
  assert.doesNotMatch(schema, /CREATE TABLE IF NOT EXISTS olt_telemetry/i);
  assert.doesNotMatch(customerController, /FROM\s+olt_telemetry/i);
  assert.doesNotMatch(networkMapController, /JOIN\s+olt_telemetry/i);
  assert.doesNotMatch(adminView, /\/api\/olt\/(?:telemetry|sync-telemetry)/);
  assert.doesNotMatch(customerProfileView, /\/api\/olt\/(?:telemetry|sync-telemetry)/);
});

test("customer, billing, and core network-mapping structures remain present", () => {
  const schema = read("db/schema.sql");
  const customerController = read("controllers/customerController.js");
  const networkMapController = read("controllers/networkMapController.js");
  const networkMapRoutes = read("routes/networkMapRoutes.js");

  assert.match(schema, /CREATE TABLE IF NOT EXISTS customers/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS network_devices/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS network_observations/i);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS network_discovery_runs/i);
  assert.match(customerController, /FROM pppoe_live_sessions/i);
  assert.match(customerController, /FROM transactions/i);
  assert.match(customerController, /FROM packages/i);
  assert.match(networkMapController, /FROM network_observations/i);
  assert.match(networkMapController, /LEFT JOIN network_devices/i);
  assert.match(networkMapRoutes, /router\.get\("\/customers\/:id", controller\.getCustomerMap\)/);
});
