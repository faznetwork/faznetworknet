-- Safely extend voucher source classification without rewriting existing voucher rows.
-- Existing subscriber_type values are preserved; only the CHECK constraint is replaced.
BEGIN;

ALTER TABLE hotspot_vouchers
  DROP CONSTRAINT IF EXISTS hotspot_vouchers_subscriber_type_check;

ALTER TABLE hotspot_vouchers
  ADD CONSTRAINT hotspot_vouchers_subscriber_type_check
  CHECK (subscriber_type IN (
    'direct_subscriber',
    'scratch_voucher',
    'admin_voucher',
    'mfs',
    'legacy'
  ));

COMMIT;
