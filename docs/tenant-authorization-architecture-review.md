# Tenant Authorization Architecture Review

## Purpose

This is an evidence-based review and proposed rebuild plan for the tenant module authorization regressions. This document intentionally makes no runtime authorization changes. Implementation should follow review of this plan and a verified inventory of tenant creation and session-context code.

## Findings confirmed in the current feature branch

1. **The database has one canonical persisted field today: `tenants.modules`.** In `db/schema.sql`, the table declares `modules JSONB NOT NULL DEFAULT '{"hotspot":true,"sms_gateway":true,"whatsapp":true}'`. This default does not include the seven tenant operational modules used by the tenant UI: `customers`, `hotspot`, `billing`, `pppoe`, `mikrotik`, `olt`, and `reports`.
2. **The runtime authorization helper accepts two competing shapes.** `middleware/tenantAccess.js` reads `tenant.enabled_modules ?? tenant.modules`, then normalizes the selected object and considers only literal boolean `true` enabled. This is deterministic for a canonical schema, but it means absent flags, an empty object, legacy defaults, or a malformed JSON value become disabled. The UI has accumulated separate defaults to compensate, so display policy and API policy can disagree.
3. **The tenant login session stores identity but not a permission snapshot.** `controllers/tenantAuthController.js` authenticates by joining `admin_users`, `tenants`, and an active subscription, then stores `tenantAdmin`, `tenantId`, `tenantName`, role/user identifiers, and explicit non-platform-admin flags. It does not load and store a canonical module permission object. This makes subsequent request context resolution a critical dependency.
4. **Tenant data APIs scope data by stable tenant ID.** The inspected `tenantDataController.js` derives a positive safe integer from `req.session.tenantId` and includes `tenant_id=$1` in customer and voucher queries. The tenant number must remain a display identifier only; it must never replace `tenants.id` in sessions, foreign keys, or tenant-scoped SQL.
5. **Dynamic numbering itself is separate from module authorization.** The PR #20 schema change adds `tenant_number`, backfills it by creation order, marks it not null, and adds a unique index. That change does not initialize module permissions. It therefore exposed an existing schema/contract gap rather than directly explaining every later 403 or sidebar issue.
6. **Follow-up patches diverged instead of establishing one policy.** PRs #22–#30 repeatedly changed template defaults, visibility, session predicates, and middleware behavior. Current tests explicitly expect empty `modules` to disable modules, while subsequent PR descriptions expect absent core flags to enable them. Those are conflicting contracts, not just a missing fallback.

## Root-cause hypothesis

The strongest confirmed architectural defect is a mismatch between the persisted tenant schema and the runtime/UI contract:

- The database's legacy `modules` default enables only older generic modules.
- The tenant UI and later patches use a seven-module operational contract, sometimes named `enabled_modules`.
- Authorization normalizes missing keys to `false`, while some UI patches interpret missing keys as enabled.
- The login session stores tenant identity, but module decisions depend on later request context loading and separate frontend/server-side checks.
- Consequently, the same tenant can authenticate successfully while its sidebar hides modules or module APIs return 403. Tenant numbering is not the permission source; its introduction is the point after which this inconsistent contract became visible.

This hypothesis is strong but not fully proven until the tenant-creation insert path, tenant context middleware, and migration history are inspected together. No live Supabase database was queried as part of this review, so production row values and migration execution remain unverified.

## Rebuild plan — no implementation in this review

### 1. Establish one explicit permission contract

Use `tenants.modules` as the sole canonical persisted JSONB field unless a reviewed migration proves a separate `enabled_modules` column is already the intended schema. Define a versioned, centralized list of known module keys and one documented default policy. Do not silently maintain both fields or add per-view fallbacks.

For new tenants, the server-side tenant creation service must explicitly write a complete module object in the same database transaction as tenant creation and subscription/admin initialization. The JSONB column default should match that policy. Unknown module keys should be rejected or handled by a documented forward-compatible policy; explicit `false` must always remain a deliberate disable.

### 2. Migrate existing rows safely

Create an idempotent migration that:
- preserves every explicit existing boolean choice;
- fills only missing core module keys according to the approved default policy;
- normalizes malformed/non-object legacy values without silently granting platform-admin privileges;
- records or reports rows requiring manual review;
- does not rewrite `tenants.id`, foreign keys, subscription ownership, or `tenant_number`.

The migration must be tested against empty, partial, legacy, malformed, and explicit-false examples before it is applied to production.

### 3. Load a canonical tenant context per request

A single tenant-context middleware should validate the session marker and positive safe integer `tenantId`, load the tenant by `tenants.id`, reject inactive/missing tenants, parse the persisted module JSONB once, and attach a typed canonical context to `req.tenant`. Session data should carry identity only; persisted database permissions remain authoritative so a module change takes effect without a stale session. Never infer tenant access from a display number or promote a tenant session to platform-admin.

### 4. Enforce one authorization policy on server-rendered and API paths

Use one `moduleEnabled(tenantContext, moduleKey)` decision for both server-side EJS navigation and API module guards. Render only tenant navigation in tenant sessions; never rely on browser JavaScript to hide unauthorized platform menus. Keep tenant-scoped SQL filters and explicit tenant API routing. Do not unblock legacy global APIs unless every relevant query is demonstrably tenant-scoped.

### 5. Remove the patch pile only after compatibility tests exist

Replace the repeated template defaults and divergent fallback behavior with the single contract after tests cover:
- tenant creation writes the complete expected module JSON;
- existing-row migration preserves explicit false and fills only missing keys;
- login and each request resolve the correct tenant by stable ID;
- enabled modules render and API access succeeds;
- disabled modules are hidden and return 403;
- tenant A cannot read or mutate tenant B's records;
- platform-admin routes and behavior remain unchanged;
- tenant-number allocation does not affect authorization or foreign keys.

### 6. Verify before merge/deploy

Run unit tests, migration tests against PostgreSQL, the full repository test suite, and all GitHub Actions checks. Inspect the PR diff to ensure it contains only the approved authorization/schema/test changes. After merge, verify deployed build identity and a tenant browser session against a known test tenant. Do not touch live MikroTik/router configuration as part of this work.

## Decision gate

This review PR contains documentation only. The next implementation PR should be created only after the tenant creation path, context middleware, and migration execution path have been identified and this canonical contract is accepted. Do not merge or deploy an authorization change based solely on sidebar appearance or green unit tests.
