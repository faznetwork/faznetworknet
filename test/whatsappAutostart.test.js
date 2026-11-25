"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { resolveWhatsappAutostart } = require("../services/whatsappAutostart");

// Permanent single-owner rule: the WhatsApp socket autostarts ONLY on Render
// (RENDER=true) or when WHATSAPP_ENABLED is explicitly "true". The PC must
// never autostart it — it used to grab the lease on every boot, so Render
// could never be the stable owner and the panel showed "owned_elsewhere"
// forever, which kept inviting an Unlink click that wiped the shared login.

test("autostart is OFF on the PC (no RENDER, no WHATSAPP_ENABLED)", () => {
  assert.equal(resolveWhatsappAutostart({}), false);
  assert.equal(resolveWhatsappAutostart({ NODE_ENV: "production", PORT: "3000" }), false);
});

test("autostart is ON on Render (RENDER=true, set automatically by Render)", () => {
  assert.equal(resolveWhatsappAutostart({ RENDER: "true" }), true);
});

test("autostart is ON when WHATSAPP_ENABLED is explicitly true", () => {
  assert.equal(resolveWhatsappAutostart({ WHATSAPP_ENABLED: "true" }), true);
  assert.equal(resolveWhatsappAutostart({ RENDER: "true", WHATSAPP_ENABLED: "true" }), true);
});

test("autostart stays OFF on the PC when WHATSAPP_ENABLED is false or unset", () => {
  assert.equal(resolveWhatsappAutostart({ WHATSAPP_ENABLED: "false" }), false);
  assert.equal(resolveWhatsappAutostart({ WHATSAPP_ENABLED: "0" }), false);
  assert.equal(resolveWhatsappAutostart({ WHATSAPP_ENABLED: "TRUE" }), false);
  assert.equal(resolveWhatsappAutostart({ WHATSAPP_ENABLED: "1" }), false);
});

test("Render wins over an explicit WHATSAPP_ENABLED=false", () => {
  assert.equal(resolveWhatsappAutostart({ RENDER: "true", WHATSAPP_ENABLED: "false" }), true);
});
