"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const MikroTikService = require("../services/mikrotikService").MikroTikService;
const router = new MikroTikService();

function withFakeRouterOS(responses, fn) {
  const original = router._withConnection;
  const commands = [];
  router._withConnection = async (_label, operation) => operation({
    write: async (command, args) => {
      commands.push({ command, args });
      if (command === "/ip/hotspot/user/profile/print") return [{ ".id": "*3", name: "Monthly" }];
      if (command === "/ip/hotspot/user/print") return responses.users || [];
      if (command === "/ip/hotspot/user/profile/remove") {
        if (responses.removeError) throw responses.removeError;
        return [];
      }
      throw new Error("Unexpected RouterOS command: " + command);
    }
  });
  return Promise.resolve().then(fn.bind(null, commands)).finally(() => { router._withConnection = original; });
}

test("Hotspot profile deletion blocks when an inactive/disabled user is assigned", async () => {
  await withFakeRouterOS({ users: [{ name: "voucher-old", profile: "Monthly", disabled: "yes" }] }, async (commands) => {
    await assert.rejects(router.deleteHotspotProfile("Monthly"), error => {
      assert.equal(error.code, "HOTSPOT_PROFILE_IN_USE");
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /currently assigned to users/i);
      assert.equal(error.details.assignedUserCount, 1);
      return true;
    });
    assert.equal(commands.some(x => x.command === "/ip/hotspot/user/profile/remove"), false);
  });
});

test("Hotspot profile deletion removes profile only when no users reference it", async () => {
  await withFakeRouterOS({ users: [{ name: "other-user", profile: "Daily" }] }, async (commands) => {
    const result = await router.deleteHotspotProfile("Monthly");
    assert.equal(result.name, "Monthly");
    assert.equal(commands.some(x => x.command === "/ip/hotspot/user/profile/remove"), true);
  });
});

test("built-in default Hotspot profile is protected before RouterOS commands", async () => {
  await withFakeRouterOS({}, async (commands) => {
    await assert.rejects(router.deleteHotspotProfile("default"), error => {
      assert.equal(error.code, "HOTSPOT_PROFILE_PROTECTED");
      assert.equal(error.statusCode, 400);
      return true;
    });
    assert.deepEqual(commands, []);
  });
});

test("RouterOS in-use removal rejection is translated to a clear conflict", async () => {
  await withFakeRouterOS({
    users: [],
    removeError: new Error("failure: item is in use")
  }, async () => {
    await assert.rejects(router.deleteHotspotProfile("Monthly"), error => {
      assert.equal(error.code, "HOTSPOT_PROFILE_IN_USE");
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /delete or reassign those users first/i);
      return true;
    });
  });
});

test("controller and UI protect default profile and do not optimistically remove failed deletions", () => {
  const root = path.resolve(__dirname, "..");
  const controller = fs.readFileSync(path.join(root, "controllers/hotspotController.js"), "utf8");
  const admin = fs.readFileSync(path.join(root, "views/admin.ejs"), "utf8");
  const handlerStart = controller.indexOf("async function deleteProfile(req,res)");
  const handlerEnd = controller.indexOf("\nlet hotspotListCache", handlerStart);
  const handler = controller.slice(handlerStart, handlerEnd);
  assert.match(handler, /name\.toLowerCase\(\)==="default"/);
  assert.ok(handler.indexOf("await mikrotikService.deleteHotspotProfile(name)") < handler.indexOf("await writeProfileMetadata(meta)"));
  assert.match(handler, /HOTSPOT_PROFILE_DELETE_FAILED/);
  assert.match(admin, /p\.name\.trim\(\)\.toLowerCase\(\) === 'default'/);
  assert.match(admin, /result\.success!==true/);
  assert.match(admin, /Failed to refresh after deletion error/);
});
