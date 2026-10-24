"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyFailure } = require("../services/emailWorker");

test("Resend sender/configuration failures are terminal and do not waste retries", () => {
  assert.equal(classifyFailure({
    code: "ERESEND_NOT_CONFIGURED",
    error: "Resend HTTP API is not configured."
  }).permanent, true);
  assert.equal(classifyFailure({
    code: "ERESEND_SENDER_NOT_VERIFIED",
    error: "Resend sender is not configured."
  }).permanent, true);
});

test("Resend non-rate-limit 4xx responses are terminal", () => {
  for (const status of [400, 401, 403, 404, 422]) {
    assert.equal(classifyFailure({
      code: "ERESEND_HTTP_" + status,
      error: "Resend rejected the request."
    }).permanent, true, "HTTP " + status + " should not be retried");
  }
});

test("Resend rate limits and server errors remain retryable", () => {
  for (const status of [429, 500, 502, 503]) {
    assert.equal(classifyFailure({
      code: "ERESEND_HTTP_" + status,
      error: "Temporary provider response."
    }).permanent, false, "HTTP " + status + " should be retried");
  }
});

test("unknown delivery failures remain retryable", () => {
  assert.equal(classifyFailure({
    code: "ETIMEDOUT",
    error: "Resend HTTP API timed out."
  }).permanent, false);
});
