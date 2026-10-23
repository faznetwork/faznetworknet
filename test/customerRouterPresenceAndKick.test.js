"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const mikrotikService = require("../services/mikrotikService");

test("kickActiveUser removes a matching PPPoE session regardless of username casing", async () => {
  const originalWithConnection = mikrotikService._withConnection;
  const writes = [];
  try {
    mikrotikService._withConnection = async (_label, operation) => operation({
      write: async (command, args) => {
        writes.push({ command, args });
        if (command === "/ppp/active/print") {
          return [
            { ".id": "*A1", name: "CUSTOMER-1011", service: "pppoe" },
            { ".id": "*H1", name: "customer-1011", service: "hotspot" },
            { ".id": "*B2", name: "other-customer", service: "pppoe" }
          ];
        }
        return [];
      }
    });

    const result = await mikrotikService.kickActiveUser("customer-1011");

    assert.equal(result.kicked, true);
    assert.equal(result.count, 1);
    assert.equal(writes.filter(item => item.command === "/ppp/active/remove").length, 1);
    assert.deepEqual(writes.find(item => item.command === "/ppp/active/remove").args, ["=.id=*A1"]);
  } finally {
    mikrotikService._withConnection = originalWithConnection;
  }
});

test("kickActiveUser reports an already-offline customer without removing other sessions", async () => {
  const originalWithConnection = mikrotikService._withConnection;
  const writes = [];
  try {
    mikrotikService._withConnection = async (_label, operation) => operation({
      write: async (command, args) => {
        writes.push({ command, args });
        if (command === "/ppp/active/print") {
          return [{ ".id": "*B2", name: "other-customer", service: "pppoe" }];
        }
        return [];
      }
    });

    const result = await mikrotikService.kickActiveUser("customer-1011");

    assert.equal(result.kicked, false);
    assert.equal(result.count, 0);
    assert.match(result.message, /already offline/i);
    assert.equal(writes.some(item => item.command === "/ppp/active/remove"), false);
  } finally {
    mikrotikService._withConnection = originalWithConnection;
  }
});
