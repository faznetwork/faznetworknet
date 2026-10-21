"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("payment gateway settings endpoints require authenticated admin roles", () => {
  const server = read("server.js");
  assert.match(server, /app\.get\("\/api\/admin\/payment-gateways",requireAdmin,requireRole\(\["super_admin","admin"\]\),paymentGatewaySettingsController\.getPaymentGateways\)/);
  assert.match(server, /app\.post\("\/api\/admin\/payment-gateways\/save",requireAdmin,requireRole\(\["super_admin","admin"\]\),paymentGatewaySettingsController\.savePaymentGateways\)/);
  assert.match(server, /app\.get\("\/admin\/payment-gateways",requireAdmin,requireRole\(\["super_admin","admin"\]\)/);
});

test("gateway secrets use authenticated AES-256-GCM encryption and are never returned", () => {
  const controller = read("controllers/paymentGatewaySettingsController.js");
  assert.match(controller, /createCipheriv\("aes-256-gcm"/);
  assert.match(controller, /PAYMENT_GATEWAY_ENCRYPTION_KEY/);
  assert.match(controller, /secretConfigured: Boolean\(storedSecret\)/);
  assert.doesNotMatch(controller, /sslStorePassword:\s*storedSecret/);
});

test("payment gateway UI loads and saves settings through the admin API", () => {
  const view = read("views/payment-gateway-setup.ejs");
  assert.match(view, /requestJson\("\/api\/admin\/payment-gateways"/);
  assert.match(view, /requestJson\("\/api\/admin\/payment-gateways\/save"/);
  assert.match(view, /function savePaymentGatewaySettings\(\)/);
  assert.match(view, /ssl-secret/);
  assert.match(view, /bkash-enabled/);
});

test("PPPoE public payment honors explicit MFS enabled flags", () => {
  const controller = read("controllers/pppoePublicPaymentApi.js");
  assert.match(controller, /mfs_bkash_enabled/);
  assert.match(controller, /mfs_nagad_enabled/);
  assert.match(controller, /mfs_rocket_enabled/);
  assert.match(controller, /mfs_upay_enabled/);
});
