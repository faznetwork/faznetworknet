'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const invitationService = require('../services/resellerInvitationService');

const read = relativePath => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');

test('reseller invitation tokens are generated at runtime and stored as SHA-256 hashes', () => {
  const first = invitationService.createInvitationToken();
  const second = invitationService.createInvitationToken();

  assert.match(first.token, /^[A-Za-z0-9_-]{40,60}$/);
  assert.match(first.tokenHash, /^[a-f0-9]{64}$/);
  assert.notEqual(first.token, second.token);
  assert.notEqual(first.tokenHash, second.tokenHash);
  assert.equal(first.tokenHash, require('node:crypto').createHash('sha256').update(first.token).digest('hex'));
});

test('reseller invitation service uses the existing transactional email outbox', () => {
  const service = read('services/resellerInvitationService.js');
  assert.match(service, /require\(['"]\.\/emailOutboxService['"]\)/);
  assert.match(service, /enqueueEmail\(/);
  assert.doesNotMatch(service, /RESEND_API_KEY|Bearer\s+[A-Za-z0-9_-]{12,}/i);
});

test('public reseller auth routes are declared before the administrator-only router guard', () => {
  const routes = read('routes/resellerRoutes.js');
  const publicAccept = routes.indexOf("router.post('/accept-invite'");
  const publicLogin = routes.indexOf("router.post('/login'");
  const adminGuard = routes.indexOf("router.use(requireRole(['super_admin', 'admin']))");
  assert.ok(publicAccept >= 0 && publicLogin >= 0 && adminGuard > publicLogin);
  assert.match(routes, /router\.post\('\/invite',\s*requireRole/);
  assert.match(routes, /resend-invite/);
  assert.match(routes, /cancel-invite/);
});

test('reseller session identity is verified against an active database record', () => {
  const authController = read('controllers/resellerAuthController.js');
  const rbac = read('middleware/rbac.js');
  assert.match(authController, /req\.session\.auth\s*=\s*\{\s*role:\s*'reseller',\s*resellerId:\s*reseller\.id,\s*isReseller:\s*true,\s*name:\s*reseller\.name\s*\}/);
  assert.match(rbac, /req\.session\?\.auth\?\.isReseller\s*===\s*true/);
  assert.match(rbac, /SELECT id,status FROM resellers WHERE id=\$1 LIMIT 1/);
});

test('reseller API mount precedes the dynamic payment webhook catch-all', () => {
  const server = read('server.js');
  const resellerMount = server.indexOf('app.use("/api/resellers",resellerRoutes);');
  const webhookCatchAll = server.indexOf('app.post("*",paymentController.dynamicWebhook);');
  assert.ok(resellerMount >= 0 && webhookCatchAll > resellerMount);
});

test('invitation schema is additive and preserves legacy account compatibility', () => {
  const migration = read('db/migrations/20261030_reseller_email_invitations.sql');
  assert.match(migration, /ADD COLUMN IF NOT EXISTS email VARCHAR\(254\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS invite_token_hash CHAR\(64\)/);
  assert.match(migration, /ALTER COLUMN username DROP NOT NULL/);
  assert.match(migration, /ALTER COLUMN password_hash DROP NOT NULL/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS uq_resellers_email_ci/);
  assert.match(migration, /BEGIN;[\s\S]*COMMIT;/);
});

test('reseller list projection includes assigned POP identity and safe invitation lifecycle status', () => {
  const controller = read('controllers/resellerController.js');
  assert.match(controller, /jsonb_build_object\('id',p\.id,'name',p\.name\)/);
  assert.match(controller, /\) AS assigned_pops/);
  assert.match(controller, /WHEN r\.status='active' THEN 'active'/);
  assert.match(controller, /THEN 'pending'/);
  assert.match(controller, /THEN 'expired'/);
  assert.match(controller, /ELSE 'inactive'/);
  assert.match(controller, /LEFT JOIN pops p ON p\.reseller_id=r\.id/);
  assert.match(controller, /GROUP BY r\.id/);
  assert.doesNotMatch(controller, /invite_token_hash\s*,|SELECT[^;]*invite_token_hash/i);
});
