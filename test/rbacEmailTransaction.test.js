"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const controller = require("../controllers/rbacAuthController");

const originalQuery = db.query;
const originalTransaction = db.withTransaction;
const envKeys = ["EMAIL_PAYLOAD_ENCRYPTION_KEY", "EMAIL_WORKER_ENABLED", "PUBLIC_BASE_URL", "OTP_HASH_SECRET"];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

function setEmailTestEnv() {
  process.env.EMAIL_PAYLOAD_ENCRYPTION_KEY = Buffer.alloc(32, 41).toString("base64");
  process.env.EMAIL_WORKER_ENABLED = "true";
  process.env.PUBLIC_BASE_URL = "https://staging.example.test";
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    set() { return this; },
    render(view, locals) { this.view = view; this.locals = locals; return this; }
  };
}

test.afterEach(() => {
  db.query = originalQuery;
  db.withTransaction = originalTransaction;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test("staff invitation and encrypted email job use the same transaction client", async () => {
  setEmailTestEnv();
  const statements = [];
  let committed = false;
  const invitation = {
    id: 501, username: "phase3.staff", email: "phase3.staff@example.test", role: "staff",
    status: "pending", created_at: new Date(), expires_at: new Date(Date.now() + 86400000)
  };
  db.query = async sql => {
    if (sql.startsWith("SELECT 1 FROM admin_users")) return { rows: [] };
    return { rows: [], rowCount: 1 };
  };
  db.withTransaction = async callback => {
    const client = {
      query: async (sql, args) => {
        statements.push({ sql, args });
        if (sql.includes("INSERT INTO admin_invitations")) return { rows: [invitation], rowCount: 1 };
        if (sql.includes("INSERT INTO email_outbox")) return { rows: [{ id: 77, status: "pending" }], rowCount: 1 };
        throw new Error("Unexpected query in invitation transaction: " + sql);
      }
    };
    const result = await callback(client);
    committed = true;
    return result;
  };
  const res = responseRecorder();
  await controller.createUser({
    body: { username: invitation.username, email: invitation.email, role: "staff" },
    auth: { role: "super_admin" },
    session: { adminUser: "owner", userId: 1, role: "super_admin" },
    ip: "127.0.0.1"
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(committed, true);
  assert.equal(statements.length, 2);
  assert.match(statements[0].sql, /INSERT INTO admin_invitations/);
  assert.match(statements[1].sql, /INSERT INTO email_outbox/);
  assert.equal(statements[1].args[0], "admin-invitation:501");
  assert.doesNotMatch(statements[1].args[3], /phase3.staff/);
});

test("invitation is not committed when its transactional outbox insert fails", async () => {
  setEmailTestEnv();
  let transactionRolledBack = false;
  const invitation = {
    id: 502, username: "phase3.fail", email: "phase3.fail@example.test", role: "staff",
    status: "pending", created_at: new Date(), expires_at: new Date(Date.now() + 86400000)
  };
  db.query = async sql => {
    if (sql.startsWith("SELECT 1 FROM admin_users")) return { rows: [] };
    return { rows: [], rowCount: 1 };
  };
  db.withTransaction = async callback => {
    try {
      return await callback({
        query: async sql => {
          if (sql.includes("INSERT INTO admin_invitations")) return { rows: [invitation], rowCount: 1 };
          if (sql.includes("INSERT INTO email_outbox")) throw new Error("email outbox insert failure");
          throw new Error("Unexpected query in invitation transaction: " + sql);
        }
      });
    } catch (error) {
      transactionRolledBack = true;
      throw error;
    }
  };
  const res = responseRecorder();
  await controller.createUser({
    body: { username: invitation.username, email: invitation.email, role: "staff" },
    auth: { role: "super_admin" },
    session: { adminUser: "owner", userId: 1, role: "super_admin" },
    ip: "127.0.0.1"
  }, res);
  assert.equal(transactionRolledBack, true);
  assert.equal(res.statusCode, 503);
  assert.match(res.body.message, /Invitation was not created because its email could not be queued/);
});

test("invitation acceptance rejects an expired OTP under a row lock", async () => {
  const token = "A".repeat(40);
  const invite = {
    id: 503, username: "phase3.expired", email: "phase3.expired@example.test", role: "staff",
    status: "pending", expires_at: new Date(Date.now() + 86400000),
    otp_code_hash: "a".repeat(64), otp_expires_at: new Date(Date.now() - 1000), otp_attempts: 0
  };
  let selectSql = "";
  db.withTransaction = async callback => callback({
    query: async sql => {
      selectSql = sql;
      return { rows: [invite], rowCount: 1 };
    }
  });
  const res = responseRecorder();
  await controller.acceptInvitation({ params: { token }, body: { otp: "123456", password: "A-strong-password-123", confirmPassword: "A-strong-password-123" } }, res);
  assert.match(selectSql, /FOR UPDATE/);
  assert.equal(res.statusCode, 400);
  assert.match(res.locals.error, /OTP expired or locked/);
});


test("verifyOtp returns service-unavailable and logs when invalid-code attempt persistence fails", async () => {
  process.env.OTP_HASH_SECRET = "test-only-otp-secret";
  const logged = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logged.push(args);
  db.query = async sql => {
    if (sql.startsWith("SELECT id, username, email, role")) {
      return { rows: [{
        id: 601, username: "otp.test", email: "otp.test@example.test", role: "staff",
        is_first_login: true, otp_code_hash: "a".repeat(64),
        otp_expires_at: new Date(Date.now() + 60000), otp_attempts: 0, status: "active"
      }] };
    }
    if (sql.includes("SET otp_attempts=otp_attempts+1")) throw new Error("injected otp attempt write failure");
    throw new Error("Unexpected query: " + sql);
  };
  const req = {
    body: { otp: "000000" },
    session: {
      pendingOtpUserId: 601, pendingOtpAttempts: 0,
      save(callback) { callback(null); }
    }
  };
  const res = responseRecorder();
  try {
    await controller.verifyOtp(req, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.locals.error, /temporarily unavailable|unavailable/i);
    assert.ok(logged.some(args => String(args[0]).includes("[RBAC OTP] Verification failed")));
  } finally {
    console.error = originalConsoleError;
    delete process.env.OTP_HASH_SECRET;
  }
});

test("verifyOtp does not silently continue when OTP invalidation fails at the attempt limit", async () => {
  const logged = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logged.push(args);
  db.query = async () => { throw new Error("injected otp invalidation failure"); };
  let destroyed = false;
  const req = {
    session: {
      pendingOtpUserId: 602, pendingOtpAttempts: 5,
      destroy(callback) { destroyed = true; callback(null); }
    }
  };
  const res = responseRecorder();
  try {
    await controller.verifyOtp(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(destroyed, false);
    assert.ok(logged.some(args => String(args[0]).includes("Failed to invalidate OTP")));
  } finally {
    console.error = originalConsoleError;
  }
});

test("verifyOtp surfaces session persistence failure for malformed OTP input", async () => {
  const logged = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logged.push(args);
  const req = {
    body: { otp: "bad" },
    session: {
      pendingOtpUserId: 603, pendingOtpAttempts: 0,
      save(callback) { callback(new Error("injected session store failure")); }
    }
  };
  const res = responseRecorder();
  try {
    await controller.verifyOtp(req, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.locals.error, /state could not be saved/i);
    assert.ok(logged.some(args => String(args[0]).includes("Failed to persist malformed-code attempt")));
  } finally {
    console.error = originalConsoleError;
  }
});
