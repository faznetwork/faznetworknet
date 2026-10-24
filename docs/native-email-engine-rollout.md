# Native Email Engine Rollout (Phase 1–2)

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
