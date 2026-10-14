const test = require("node:test");
const assert = require("node:assert/strict");
const { parseSms } = require("../services/paymentWebhookParser");

const message = "bKash Payment Received Tk 500 TrxID ABC12345";

test("SMS parser accepts a recipient matching the current General Settings number", () => {
  const payment = parseSms(
    { sender: "bKash", message, recipient: "01700000000" },
    {},
    {},
    { recipientNumbers: { bkash: "01700000000" } }
  );
  assert.equal(payment.channel, "bkash");
  assert.equal(payment.recipientPhone, "01700000000");
  assert.equal(payment.trxId, "ABC12345");
});

test("SMS parser rejects an explicitly mismatched receiving number", () => {
  assert.throws(
    () => parseSms(
      { message, recipient: "01800000000" },
      {},
      {},
      { recipientNumbers: { bkash: "01700000000" } }
    ),
    /does not match the configured bkash receiving number/
  );
});

test("SMS parser fails closed when recipient context exists but no MFS number is configured", () => {
  assert.throws(
    () => parseSms({ sender: "bKash", message, recipient: "01700000000" }, {}, {}, { recipientNumbers: {} }),
    /Receiving number is not configured for bkash/
  );
});

test("SMS parser remains compatible with forwarders that do not send recipient context", () => {
  const payment = parseSms({ sender: "bKash", message }, {}, {}, { recipientNumbers: {} });
  assert.equal(payment.channel, "bkash");
  assert.equal(payment.recipientPhone, "");
});
