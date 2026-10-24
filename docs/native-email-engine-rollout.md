# Native Email Engine Rollout (Phase 1–3)

This document describes rollout steps only. The code branch does not change Render settings, execute SQL against production, or send live emails.

## Required configuration

1. Configure SMTP in the existing Notification Hub settings:
   - SMTP Host (for Gmail, commonly `smtp.gmail.com`)
   - Port and TLS mode
   - SMTP username
   - Gmail App Password (not the normal account password)
   - From name and address
2. Create a dedicated 32-byte encryption key for queued email payloads. Generate one locally with:
   ```sh
   openssl rand -base64 32
   ```
   Store the result as the Render secret `EMAIL_PAYLOAD_ENCRYPTION_KEY`. Never commit the value or paste it into logs.
3. Only after the outbox schema is present and SMTP has been verified, set `EMAIL_WORKER_ENABLED=true`.
4. Optional worker controls:
   - `EMAIL_WORKER_POLL_MS` (default 5000; bounded 1000–30000)
   - `EMAIL_WORKER_BATCH_SIZE` (default 10; bounded 1–50 and further clamped to the lease-safe batch size)
   - `EMAIL_WORKER_CONCURRENCY` (default 3; bounded 1–10)
   - `EMAIL_WORKER_LEASE_SECONDS` (default 90; bounded 30–600)
   - `EMAIL_WORKER_MAX_ATTEMPTS` (default 8; bounded 1–20)

## Database change

`db/migrations/20261024_email_outbox.sql` is an additive migration. Review it and take a verified backup before applying it to production. Do not run it against production as part of this implementation branch.

The matching `db/schema.sql` definition supports fresh installs and the repository's existing schema initializer. Production rollout must account for that initializer's behavior and be scheduled deliberately.

## Security and delivery semantics

- SMTP credentials continue to come from database settings; the encryption key is used only for queued payload encryption.
- OTPs and invitation links are encrypted with AES-256-GCM before persistence, omitted from delivery-history message bodies, and not sent after their expiry.
- Outbox insertion is durable after PostgreSQL confirms the enqueue. SMTP is not an exactly-once transport: a process crash after provider acceptance but before the job is marked sent can result in a duplicate retry.
- Email jobs that cannot be decrypted are not processed; the worker refuses to start if the encryption key is missing or invalid. Do not rotate the key while queued jobs remain unless you have a reviewed re-encryption procedure.
- Keep the worker disabled until the migration/schema, encryption key, SMTP settings, and test suite are verified.

## Verification required before merge or production rollout

- Run `npm test` and `npm run build` on the proposed branch.
- Confirm CI checks are green.
- Test the SMTP settings endpoint with a controlled test inbox.
- Test queue enqueue, retry, stale lease recovery, OTP expiry, and invitation delivery using a non-production database and inbox.
- Perform browser smoke tests for Notification Hub settings, save/reload behavior, and menu/submenu navigation.
- Review logs for secrets, OTP values, invitation tokens, or full message bodies; none should appear.


## Phase 3 transaction-boundary guarantees

- PPPoE webhook renewal and manual PPPoE payment matching enqueue the email job through the same PostgreSQL transaction client that persists the customer renewal and finalizes the payment transaction. A failed outbox insert aborts those PostgreSQL changes.
- Billing expiration performs RouterOS work before opening the database transaction. The customer/PPPoE expiration-state writes and enabled email outbox enqueue then commit together. RouterOS is an external system and cannot be rolled back by PostgreSQL; a DB failure after RouterOS mutation must remain visible for reconciliation.
- Invitation creation and resend persist the invitation row and its encrypted email job in one transaction. First-login OTP and invitation OTP hash/expiry updates are committed with the corresponding encrypted outbox job.
- Invitation acceptance locks the pending invitation row with `FOR UPDATE`, validates invitation/OTP expiry and attempt limits under that lock, then updates the account and consumes the invitation in one transaction.
- The dispatcher must check the returned result from email-only dispatch inside a business transaction. A failed enqueue must throw and roll back the transaction; it must not be treated as successful just because `dispatchNow` resolved.

## Staging-only verification checklist

Use an isolated staging PostgreSQL database and a dedicated test inbox. Do not point the test worker at production data or use real customer addresses.

1. **Preflight**
   - Apply the additive outbox migration to staging only after taking a verified staging backup.
   - Set a staging-only `EMAIL_PAYLOAD_ENCRYPTION_KEY` generated with `openssl rand -base64 32`.
   - Configure SMTP credentials in staging settings and verify the SMTP test-email action targets only the controlled inbox.
   - Enable `EMAIL_WORKER_ENABLED=true` only after the schema, encryption key and SMTP configuration have been verified.
   - Keep all secrets out of test output, screenshots, and logs.

2. **Transactional atomicity**
   - Force the outbox insert to fail during a staging PPPoE payment/renewal transaction. Verify the customer renewal and transaction finalization roll back together; verify the transaction remains available for the existing reconciliation path.
   - Repeat for manual PPPoE payment matching.
   - Force an outbox insert failure during a billing expiration DB transaction. Verify the customer and PPPoE status changes roll back together. Because RouterOS changes occur before the DB transaction, record and verify the expected reconciliation state rather than repeating RouterOS operations automatically.
   - Force an invitation/OTP enqueue failure. Verify invitation creation or OTP hash/expiry updates roll back and no orphaned pending invitation or OTP state remains.
   - Enqueue the same stable idempotency key twice and verify only one row is created and the existing row is returned.

3. **Worker and retry behavior**
   - Observe a valid job transition from `pending` to `processing` to `sent`; verify payload ciphertext does not expose OTPs, invitation tokens, or message bodies.
   - Simulate a transient SMTP connection timeout or provider 4xx response and verify retry scheduling follows the configured exponential backoff and jitter, bounded by the maximum attempt count.
   - Verify a permanent authentication/configuration error is surfaced clearly and classified according to the existing worker policy; do not use an invalid password as the only retry test.
   - Simulate a worker crash after SMTP acceptance but before `sent` is recorded. Confirm the lease is recovered and document that duplicate delivery is possible because SMTP is not exactly-once.

4. **Strict five-minute OTP expiry**
   - Request a first-login OTP and invitation OTP; verify the persisted `otp_expires_at` is approximately five minutes after issuance.
   - Verify an OTP is rejected once the server-side expiry timestamp has passed, regardless of email delivery time.
   - Leave an OTP email queued until after its `expiresAt`; verify the worker does not call SMTP for it and records the expired job outcome.
   - Verify the maximum-attempt limit, successful single use, and two concurrent invitation-acceptance requests. Only one request may consume the invitation and activate/create the account.

5. **Real-browser smoke tests**
   - Notification Hub: save SMTP host/port/TLS/from fields, reload, and verify saved non-secret fields remain correct while passwords/secrets are not exposed in page responses.
   - Test-email button: send only to the dedicated staging inbox; verify clear success/failure feedback and no secret leakage in browser console or network responses.
   - Staff invitation: create a staff invite, open its link, request OTP, verify OTP, set a password, and confirm the account is active with the expected role.
   - Negative flows: expired invitation, expired OTP, wrong OTP, exhausted attempts, reused invitation link, and SMTP/outbox failure.
   - Run direct URL load, hard reload, and browser Back/Forward navigation for Notification Hub and staff-invitation routes. Check browser console and network requests for uncaught errors.
   - Capture results as passed/failed/not run. Do not mark browser smoke tests passed until they are run in a real browser against staging.

## Phase 3 verification status

The checklist above is a staging test plan, not evidence that staging tests have been run. This branch must pass the required CI workflows and a real-browser staging smoke test before it is considered ready for merge. No production migration, merge, or deployment is part of this phase.


6. **OTP persistence-failure fault injection (staging only)**
   - Use an isolated staging database and a dedicated test account. Never run these injections against production or real staff accounts.
   - With the application pointed only at staging, temporarily inject a database failure for the `UPDATE admin_users SET otp_attempts=otp_attempts+1 ...` statement. Submit an incorrect six-digit OTP. Expected: HTTP 503 with a clear verification-service error, a structured `[RBAC OTP] Verification failed` log entry, and no success redirect/session. Remove the injection immediately after the test.
   - Temporarily inject a failure for the OTP invalidation statement (`UPDATE admin_users SET otp_code_hash=NULL, otp_expires_at=NULL ...`). Submit after the attempt limit. Expected: HTTP 503 and an explicit `[RBAC OTP] Failed to invalidate OTP...` log entry; the handler must not silently destroy the session and pretend the database cleanup succeeded. Restore the database behavior after the test.
   - Simulate session-store `save` failure while submitting malformed OTP input. Expected: HTTP 503 and `[RBAC OTP] Failed to persist malformed-code attempt` in application logs. The handler must not return the ordinary validation response as though persistence succeeded.
   - For every injected failure, record the test account ID, UTC timestamp, injected fault, HTTP status, and matching log marker without recording the OTP, OTP hash, session cookie, invitation token, or message payload.
   - Remove all test-only triggers/proxies/fault rules after testing and verify a normal invalid-code request increments the attempt counter. Confirm no test account or test-only database object remains unless explicitly retained for staging regression use.

7. **Rollback and recovery**
   - Do not roll back or edit production data to recover from a staging test. Remove only the staging fault-injection mechanism, then rerun the same flow without injection.
   - If a transaction-boundary test fails, preserve the test output and staging database evidence before cleanup. Revert only the test fixture/fault injection; do not manually compensate customer, payment, or transaction rows.
   - Before any later production rollout, take and verify a restorable backup, document the exact additive migration, and rehearse the rollback against a disposable database snapshot. Since schema changes may not be safely reversible after application code writes outbox rows, use a forward-fix or a reviewed recovery procedure rather than deleting the outbox table blindly.
