-- Allow the canonical subscriber channels used by Hotspot voucher flows.
-- Safe to rerun: replace only this named CHECK constraint; no rows are modified.
BEGIN;

ALTER TABLE public.hotspot_vouchers
  DROP CONSTRAINT IF EXISTS hotspot_vouchers_subscriber_type_check;

ALTER TABLE public.hotspot_vouchers
  ADD CONSTRAINT hotspot_vouchers_subscriber_type_check
  CHECK (
    subscriber_type IN (
      'direct_subscriber',
      'scratch_voucher',
      'admin_voucher',
      'mfs',
      'legacy'
    )
  );

COMMIT;
