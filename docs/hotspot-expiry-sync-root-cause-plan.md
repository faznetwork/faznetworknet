# Hotspot Expiry and Panel-to-MikroTik Sync — Root-Cause Review Plan

## Status

Architecture review only. This branch intentionally contains no runtime-code, schema, migration, or stored-data changes. Implementation must not begin until this plan is explicitly approved.

## Repository and deployment evidence

- Repository: `faznetwork/faznetworknet`
- Base branch: `main`
- Reviewed base commit: `e4835c5f32fe535fd9e300b8cfc2ccf701b485b9` (`Add Hotspot sync from panel`)
- Render web service: `faznetworknet`, configured to deploy `main` on commits.
- Render workspace has no managed Postgres instance attached.
- The only connected Supabase project inspected is `Kash Node`; its visible public schema contains call-intent/wallet/outbox tables and does not match FAZ NETWORK's application schema. It was not queried for Hotspot records. The app's `DATABASE_URL` is configured externally on Render, so production voucher rows and database-level runtime state remain unverified.

## Confirmed source findings

### 1. Expiry worker can infer expiry from a missing RouterOS user

In `jobs/hotspotExpirationCleanup.js`, `missingMacUser` is true when:
- a RouterOS snapshot is available;
- a MAC-named voucher's RouterOS user is absent; and
- the database status is `active`, `unused`, or `pending_claim`;
- the voucher is not treated as a staged future renewal.

The worker then includes `missingMacUser` as an independent reason to continue into the expiry/cleanup path, even when the database expiry and parsed comment expiry have not been shown to be due. A missing RouterOS row is not proof that a subscriber's purchased validity has ended.

The existing test named `reconciles an expired MAC voucher after the RouterOS one-shot scheduler removed the user` currently encodes this missing-user reconciliation behavior. The replacement regression coverage must distinguish a genuinely elapsed expiry from a future-valid voucher whose RouterOS row is absent.

### 2. Expiry status is treated as terminal in list projection

In `controllers/hotspotController.js`, `refreshHotspotListCache()` persists elapsed `expires_at` values as `expired`, then projects a row as expired when either the stored status is `expired` or the timestamp is elapsed. This is internally consistent only if no other path can incorrectly write `expired`.

In `public/js/hotspot-users-clean.js`, `isValidPackage()` and `stateOf()` also treat stored `expired` status as authoritative even if `expires_at` is in the future. This means a prior erroneous status transition can remain visible as expired. Any repair must establish the canonical lifecycle invariant across worker, API projection, and UI rather than adding a frontend-only exception.

### 3. Panel-to-MikroTik push has a strict candidate filter and writes before disconnect

In `controllers/hotspotController.js`, `pushToMikrotik()` selects only rows whose status is `active` or `unused` and whose `mac_address` is non-empty. It derives RouterOS expiry from `expires_at`, the comment, or the existing validity calculation and passes an `expired` flag to the service.

In `services/mikrotikService.js`, `syncHotspotUsers()` adds or updates the RouterOS Hotspot user before removing any matching active session for an expired candidate. The intended candidate eligibility and expired-user behavior need one explicit contract; otherwise the sync can provision credentials for a candidate that should only be disabled/cleaned up.

The UI's `freshHotspotPanelSync` handler calls the existing push route and reloads the subscriber list. The route is already registered; this is not currently evidenced as a missing-button-handler problem.

## Proposed implementation plan — approval required

1. **Define one lifecycle contract.** Treat PostgreSQL voucher expiry and lifecycle state as the source of truth. RouterOS presence/absence is synchronization telemetry, never standalone evidence that validity elapsed. Preserve deliberate archived/deleted/manual lifecycle semantics.
2. **Correct the expiry worker root cause.** Remove missing RouterOS identity as an independent expiry condition. Retain cleanup only when an authoritative expiry signal is due (database expiry, valid parsed expiry metadata, or an explicitly supported quota rule). Keep retry/error state observable; do not swallow RouterOS failures.
3. **Make sync eligibility explicit.** Separate (a) valid subscribers to provision/update, (b) due/expired subscribers to disconnect/disable/cleanup, and (c) invalid/incomplete rows to report as skipped with reasons. Do not create/update a RouterOS credential for an expired candidate before cleanup.
4. **Unify lifecycle projection.** Ensure worker persistence, API status projection, and frontend labels/counts use the same lifecycle invariant. Do not silently reactivate an intentionally expired/manual-disabled subscriber solely because its timestamp is future.
5. **Add regression tests first.** Cover missing RouterOS row + future expiry, missing RouterOS row + elapsed expiry, elapsed DB expiry with RouterOS row absent/present, future staged renewal, invalid/missing expiry metadata, invalid MAC, expired push candidate, active/unused valid candidate, and RouterOS write/disconnect failures.
6. **Validate without production mutation.** Run targeted unit/regression tests, full CI, static checks, and inspect the final diff. Use a disposable/staging PostgreSQL database and test MikroTik fixture for integration checks. No production sync, production SQL write, merge, or deployment as part of this PR.
7. **Browser verification.** In a real browser, smoke-test Hotspot subscriber list, expiry/status filters, refresh, Panel-to-MikroTik sync confirmation/result feedback, and relevant menu/submenu navigation at desktop and mobile widths.

## Data and scope safety

- No database schema, query contract, API endpoint, billing, payment, transaction, sales-audit, customer, or stored-data changes are authorized by this review plan.
- Do not run production MikroTik sync or cleanup while investigating.
- No migration is expected unless later evidence proves one is essential; if so, propose it separately before implementation.
- Do not merge until every required CI check passes and browser verification is recorded.
