-- Panel-as-master Hotspot sync + pure GB data quota (2026-11-21)
-- Idempotent: safe to re-run. Applies in order:
--  a. Adds the missing 300GB (Unlimited) metadata entry to app_settings.
--  b. Backfills pop_hotspot_packages.data_limit_bytes from metadata
--     limitBytesTotal (1GB and 300GB). Time packages stay NULL.
--  c. Defensive cleanup: clears any live stale expires_at on a data-only
--     voucher (expected no-op; live data vouchers already have NULL).
-- The missing 1GB router profile is NOT created here — the auto-heal job
-- (jobs/hotspotAutoHeal.js) re-creates it from panel metadata on deploy.

-- a. Merge the 300GB (Unlimited) entry into hotspot_profile_metadata.
--    The jsonb || merge keeps every other profile key untouched.
--    app_settings.value is TEXT, so the merged value is cast back to text.
INSERT INTO app_settings (key, value, updated_at)
VALUES (
  'hotspot_profile_metadata',
  jsonb_build_object(
    '300GB (Unlimited)',
    jsonb_build_object(
      'price', 250,
      'rateLimit', '',
      'validityValue', 300,
      'validityUnit', 'gb',
      'validityLabel', '300 GB',
      'limitBytesTotal', 322122547200,
      'updatedAt', to_char(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
    )
  )::text,
  NOW()
)
ON CONFLICT (key) DO UPDATE
  SET value = (app_settings.value::jsonb || EXCLUDED.value::jsonb)::text,
      updated_at = NOW();

-- b. Backfill data_limit_bytes from the metadata limitBytesTotal.
--    Only rows whose metadata entry carries a quota > 0 are touched, so
--    time packages (limitBytesTotal 0) keep data_limit_bytes NULL.
UPDATE pop_hotspot_packages p
SET data_limit_bytes = (a.value::jsonb -> p.profile_key ->> 'limitBytesTotal')::bigint,
    updated_at = NOW()
FROM app_settings a
WHERE a.key = 'hotspot_profile_metadata'
  AND (a.value::jsonb -> p.profile_key ->> 'limitBytesTotal') IS NOT NULL
  AND (a.value::jsonb -> p.profile_key ->> 'limitBytesTotal')::bigint > 0
  AND (p.data_limit_bytes IS NULL
       OR p.data_limit_bytes <> (a.value::jsonb -> p.profile_key ->> 'limitBytesTotal')::bigint);

-- c. Defensive: a live data-only voucher must never carry a time expiry.
--    Only live rows are touched; expired/deleted/archived rows are left alone.
UPDATE hotspot_vouchers
SET expires_at = NULL, updated_at = NOW()
WHERE status IN ('active', 'unused', 'pending_claim')
  AND expires_at IS NOT NULL
  AND profile IN (
    SELECT profile_key FROM pop_hotspot_packages
    WHERE validity_seconds = 0 AND data_limit_bytes > 0
  );
