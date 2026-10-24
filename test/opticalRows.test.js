const test = require("node:test");
const assert = require("node:assert/strict");
const { parseOpticalRows } = require("../lib/network/opticalRows");

test("normalizes ONU MAC and parses real RX dBm with a timestamp", () => {
  const result = parseOpticalRows([{ onuId: "EPON0/1:2", ponPort: "PON1", macAddress: "a2-4f-b2-04-06-f8", rxPowerDbm: "-22.29 dBm" }], "2026-10-11T00:00:00Z");
  assert.deepEqual(result[0], {
    onuId: "EPON0/1:2", ponPort: "PON1", macAddress: "A2:4F:B2:04:06:F8",
    rxPowerDbm: -22.29, observedAt: "2026-10-11T00:00:00.000Z", valid: true, invalidReason: null
  });
});

test("rejects missing MAC, missing RX, and out-of-range values without inventing readings", () => {
  const result = parseOpticalRows([
    { mac: "not-a-mac", rxPower: -20 },
    { mac: "00:11:22:33:44:55", rxPower: "" },
    { mac: "00:11:22:33:44:66", rxPower: -99 }
  ]);
  assert.equal(result[0].valid, false);
  assert.equal(result[0].rxPowerDbm, null);
  assert.equal(result[1].invalidReason, "invalid_or_missing_rx_power");
  assert.equal(result[2].rxPowerDbm, null);
});

test("supports multiple PONs and an empty OLT result", () => {
  assert.equal(parseOpticalRows([
    { pon: "PON1", mac: "00:11:22:33:44:55", rxPower: -12 },
    { pon: "PON2", mac: "00:11:22:33:44:66", rxPower: -18 }
  ]).length, 2);
  assert.deepEqual(parseOpticalRows([]), []);
});

test("rejects invalid observation timestamps", () => {
  assert.throws(() => parseOpticalRows([], "not-a-date"), /Invalid observation timestamp/);
});
