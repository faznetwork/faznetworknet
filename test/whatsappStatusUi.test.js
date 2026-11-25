"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const adminEjs = fs.readFileSync(path.join(__dirname, "..", "views", "admin.ejs"), "utf8");

// "owned_elsewhere" is a HEALTHY state — the other server (Render) holds the
// socket and WhatsApp is working. It used to render as a red "owned_elsewhere"
// badge plus red error text, which looked broken and kept inviting an Unlink
// click that deleted the shared login. These tests lock in the neutral
// rendering and the explicit Unlink warning.

test("owned_elsewhere badge is neutral, not a red error", () => {
  assert.ok(
    !adminEjs.includes("['error','owned_elsewhere','reconnect_required']"),
    "owned_elsewhere must not be in the red/danger badge list"
  );
  assert.ok(
    adminEjs.includes("['error','reconnect_required']"),
    "only real errors stay red"
  );
  assert.ok(
    adminEjs.includes("s.connection==='owned_elsewhere'?'Connected on other server'"),
    "the badge must say the connection lives on the other server"
  );
});

test("owned_elsewhere status text is neutral information, not an error", () => {
  assert.ok(
    adminEjs.includes("WhatsApp is connected on the other server and working. No action is needed here."),
    "owned_elsewhere must explain the other server holds a working connection"
  );
});

test("Unlink confirmation warns it deletes the login and a QR re-scan is needed", () => {
  assert.ok(
    adminEjs.includes("This deletes the saved WhatsApp login."),
    "the Unlink confirm must say the login is deleted"
  );
  assert.ok(
    adminEjs.includes("scan the QR code again to re-link the device."),
    "the Unlink confirm must say a QR re-scan is needed"
  );
  assert.ok(
    !adminEjs.includes("remove the saved local session?"),
    "the old vague Unlink wording must be gone"
  );
});
