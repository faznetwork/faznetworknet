-- 20261121: Single fixed billing policy — same-date monthly cycle,
-- quarantine-only expiry.
--
-- Normalizes any legacy policy values left in app_settings:
--   billing_cycle_type: rolling_30 / monthly_1st -> same_date_monthly
--   expiry_action:      disable_secret (or anything else) -> quarantine
-- Safe and idempotent: re-running this file changes nothing once the values
-- are normalized, and it never touches customer records, router state, or
-- any other setting. grace_period_days is intentionally left unchanged.

UPDATE app_settings
SET value = 'same_date_monthly', updated_at = NOW()
WHERE key = 'billing_cycle_type' AND value <> 'same_date_monthly';

INSERT INTO app_settings (key, value, updated_at)
SELECT 'billing_cycle_type', 'same_date_monthly', NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'billing_cycle_type');

UPDATE app_settings
SET value = 'quarantine', updated_at = NOW()
WHERE key = 'expiry_action' AND value <> 'quarantine';

INSERT INTO app_settings (key, value, updated_at)
SELECT 'expiry_action', 'quarantine', NOW()
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE key = 'expiry_action');
