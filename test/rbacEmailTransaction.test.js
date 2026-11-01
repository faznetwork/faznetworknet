"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const db = require("../db");
const controller = require("../controllers/rbacAuthController");\nconst adminAuth = require("../middleware/adminAuth");

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
    render(view, locals) { this.view = view; this.locals = locals; return this; },\n    redirect(location) { this.redirectedTo = location; return this; }
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


test("legacy shared credential binds only to its unique active super-admin database identity", async () => {
  const adminAuth = require("../middleware/adminAuth");
  const originalValidator = adminAuth.adminCredentialsValid;
  const originalAdminUsername = process.env.ADMIN_USERNAME;
  const originalAdminUser = process.env.ADMIN_USER;
  process.env.ADMIN_USERNAME = "legacy.root";
  delete process.env.ADMIN_USER;
  adminAuth.adminCredentialsValid = async () => true;
  const session = {
    regenerate(callback) { callback(null); },
    save(callback) { callback(null); }
  };
  const statements = [];
  db.query = async (sql, args) => {
    statements.push({ sql, args });
    if (sql.includes("SELECT id,username,role,status FROM admin_users")) {
      return { rows: [{ id: 11, username: "legacy.root", role: "super_admin", status: "active" }] };
    }
    if (sql.includes("UPDATE admin_users SET last_login_at")) return { rows: [], rowCount: 1 };
    throw new Error("Unexpected legacy login query: " + sql);
  };
  const res = responseRecorder();
  try {
    await controller.login({ body: { username: "legacy.root", password: "legacy-secret" }, session }, res);
    assert.equal(res.redirectedTo, "/admin");
    assert.equal(session.userId, 11);
    assert.equal(session.adminUser, "legacy.root");
    assert.equal(session.role, "super_admin");
    assert.equal(session.legacySuperAdmin, true);
    assert.deepEqual(statements[0].args, ["legacy.root"]);
  } finally {
    adminAuth.adminCredentialsValid = originalValidator;
    if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = originalAdminUsername;
    if (originalAdminUser === undefined) delete process.env.ADMIN_USER; else process.env.ADMIN_USER = originalAdminUser;
  }
});

test("legacy shared credential fails closed when no active super-admin identity is mapped", async () => {
  const adminAuth = require("../middleware/adminAuth");
  const originalValidator = adminAuth.adminCredentialsValid;
  const originalAdminUsername = process.env.ADMIN_USERNAME;
  process.env.ADMIN_USERNAME = "legacy.missing";
  adminAuth.adminCredentialsValid = async () => true;
  let regenerated = false;
  const session = { regenerate(callback) { regenerated = true; callback(null); } };
  db.query = async () => ({ rows: [] });
  const res = responseRecorder();
  try {
    await controller.login({ body: { username: "legacy.missing", password: "legacy-secret" }, session }, res);
    assert.equal(res.statusCode, 403);
    assert.match(res.locals.error, /not linked to an active super-admin/i);
    assert.equal(regenerated, false);
  } finally {
    adminAuth.adminCredentialsValid = originalValidator;
    if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = originalAdminUsername;
  }
});

test("legacy shared credential fails closed when identity mapping is ambiguous", async () => {
  const adminAuth = require("../middleware/adminAuth");
  const originalValidator = adminAuth.adminCredentialsValid;
  const originalAdminUsername = process.env.ADMIN_USERNAME;
  process.env.ADMIN_USERNAME = "legacy.duplicate";
  adminAuth.adminCredentialsValid = async () => true;
  let regenerated = false;
  const session = { regenerate(callback) { regenerated = true; callback(null); } };
  db.query = async () => ({ rows: [
    { id: 11, username: "legacy.duplicate", role: "super_admin", status: "active" },
    { id: 12, username: "legacy.duplicate", role: "super_admin", status: "active" }
  ] });
  const res = responseRecorder();
  try {
    await controller.login({ body: { username: "legacy.duplicate", password: "legacy-secret" }, session }, res);
    assert.equal(res.statusCode, 503);
    assert.match(res.locals.error, /mapping is ambiguous/i);
    assert.equal(regenerated, false);
  } finally {
    adminAuth.adminCredentialsValid = originalValidator;
    if (originalAdminUsername === undefined) delete process.env.ADMIN_USERNAME; else process.env.ADMIN_USERNAME = originalAdminUsername;
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
        if (sql.includes("SELECT id FROM admin_users")) return { rows: [] };
        if (sql.includes("SELECT id FROM admin_invitations WHERE status='pending'")) return { rows: [] };
        if (sql.includes("SELECT id FROM admin_invitations WHERE status='failed'")) return { rows: [] };
        if (sql.includes("app_settings")) return { rows: [{ value: "true" }] };
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
    body: { email: invitation.email, role: "staff" },
    auth: { role: "super_admin" },
    session: { adminUser: "owner", userId: 1, role: "super_admin" },
    ip: "127.0.0.1"
  }, res);
  assert.equal(res.statusCode, 201);
  assert.equal(committed, true);
  assert.equal(statements.length, 6);
  assert.match(statements[0].sql, /SELECT id FROM admin_users/);
  assert.match(statements[1].sql, /status='pending'/);
  assert.match(statements[2].sql, /status='failed'/);
  assert.match(statements[3].sql, /INSERT INTO admin_invitations/);
  assert.match(statements[3].sql, /INSERT INTO admin_invitations \(email,role,token_hash,status,created_by,expires_at\) VALUES \(\$1,\$2,\$3/);
  assert.match(statements[4].sql, /app_settings/);
  assert.match(statements[5].sql, /INSERT INTO email_outbox/);
  assert.equal(statements[5].args[0], "admin-invitation:501");
  assert.doesNotMatch(statements[5].args[3], /phase3.staff/);
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
          if (sql.includes("SELECT id FROM admin_users")) return { rows: [] };
          if (sql.includes("SELECT id FROM admin_invitations WHERE status='pending'")) return { rows: [] };
          if (sql.includes("SELECT id FROM admin_invitations WHERE status='failed'")) return { rows: [] };
          if (sql.includes("app_settings")) return { rows: [{ value: "true" }] };
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
  assert.match(res.body.message, /Invitation could not be queued/);
});

test("invitation acceptance requires the invitee-selected username", async () => {
  const token = "A".repeat(40);
  const res = responseRecorder();
  await controller.acceptInvitation({ params: { token }, body: { otp: "123456", password: "A-strong-password-123", confirmPassword: "A-strong-password-123" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.locals.error, /Username must be 3/);
});

test("invitation acceptance does not require an email OTP", async () => {
  const token = "A".repeat(40);
  const invite = {
    id: 503, username: "phase3.expired", email: "phase3.expired@example.test", role: "staff",
    status: "pending", expires_at: new Date(Date.now() + 86400000),
    otp_code_hash: "a".repeat(64), otp_expires_at: new Date(Date.now() - 1000), otp_attempts: 0
  };
  let selectSql = "";
  db.withTransaction = async callback => callback({
    query: async sql => {
      if (sql.includes("FOR UPDATE")) selectSql = sql;
      if (sql.includes("SELECT 1 FROM admin_users")) return { rows: [{ id: 1 }], rowCount: 1 };
      return { rows: [invite], rowCount: 1 };
    }
  });
  const res = responseRecorder();
  await controller.acceptInvitation({ params: { token }, body: { username: "phase3.expired", password: "A-strong-password-123", confirmPassword: "A-strong-password-123" } }, res);
  assert.match(selectSql, /FOR UPDATE/);
  assert.equal(res.statusCode, 409);
  assert.doesNotMatch(res.locals.error, /OTP/i);
});


test("verifyOtp returns service-unavailable and logs when invalid-code attempt persistence fails", async () => {
  process.env.OTP_HASH_SECRET = "test-only-otp-secret";
  const logged = [];
  const originalConsoleError = console.error;
  console.error = (...args) => logged.push(args);
  let queryCount = 0;
  db.query = async sql => {
    queryCount += 1;
    if (queryCount === 1) {
      return { rows: [{
        id: 601, username: "otp.test", email: "otp.test@example.test", role: "staff",
        is_first_login: true, otp_code_hash: "a".repeat(64),
        otp_expires_at: new Date(Date.now() + 60000), otp_attempts: 0, status: "active"
      }] };
    }
    throw new Error("injected OTP persistence failure at query " + queryCount);
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


test("invitation email uses BASE_URL before APP_URL and puts the same custom-domain link in HTML and text", async () => {
  const outbox = require("../services/emailOutboxService");
  const originalEnqueue = outbox.enqueueEmail;
  const originalBaseUrl = process.env.BASE_URL;
  const originalAppUrl = process.env.APP_URL;
  const originalPublicBaseUrl = process.env.PUBLIC_BASE_URL;
  let payload;
  outbox.enqueueEmail = async value => { payload = value; return { queued: true }; };
  process.env.BASE_URL = "https://primary.example.test/";
  process.env.APP_URL = "https://secondary.example.test";
  process.env.PUBLIC_BASE_URL = "https://legacy-render.example.test";
  try {
    await controller.sendInvitationEmail({ id: 700, email: "invitee@example.test", role: "staff", expires_at: new Date(Date.now() + 86400000) }, "test-token");
    const expectedLink = "https://primary.example.test/invite/test-token";
    assert.match(payload.html, new RegExp(expectedLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(payload.text.includes(expectedLink));
    assert.equal((payload.html + payload.text).includes("onrender.com"), false);
    assert.equal((payload.html + payload.text).includes("secondary.example.test"), false);
    assert.equal((payload.html + payload.text).includes("legacy-render.example.test"), false);
  } finally {
    outbox.enqueueEmail = originalEnqueue;
    for (const [key, value] of [["BASE_URL", originalBaseUrl], ["APP_URL", originalAppUrl], ["PUBLIC_BASE_URL", originalPublicBaseUrl]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test("invitation email falls back to faznetwork.com when BASE_URL and APP_URL are absent", async () => {
  const outbox = require("../services/emailOutboxService");
  const originalEnqueue = outbox.enqueueEmail;
  const originalBaseUrl = process.env.BASE_URL;
  const originalAppUrl = process.env.APP_URL;
  const originalPublicBaseUrl = process.env.PUBLIC_BASE_URL;
  let payload;
  outbox.enqueueEmail = async value => { payload = value; return { queued: true }; };
  delete process.env.BASE_URL;
  delete process.env.APP_URL;
  process.env.PUBLIC_BASE_URL = "https://legacy-render.example.test";
  try {
    await controller.sendInvitationEmail({ id: 701, email: "invitee@example.test", role: "staff", expires_at: new Date(Date.now() + 86400000) }, "fallback-token");
    const expectedLink = "https://faznetwork.com/invite/fallback-token";
    assert.ok(payload.html.includes('href="' + expectedLink + '"'));
    assert.ok(payload.html.includes(">" + expectedLink + "</p>"));
    assert.ok(payload.text.includes(expectedLink));
    assert.equal((payload.html + payload.text).includes("onrender.com"), false);
    assert.equal((payload.html + payload.text).includes("legacy-render.example.test"), false);
  } finally {
    outbox.enqueueEmail = originalEnqueue;
    for (const [key, value] of [["BASE_URL", originalBaseUrl], ["APP_URL", originalAppUrl], ["PUBLIC_BASE_URL", originalPublicBaseUrl]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
