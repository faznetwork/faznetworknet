-- Financially safe Hotspot deletion lifecycle.
-- Additive/idempotent: preserves every existing voucher, payment, and transaction row.
BEGIN;

ALTER TABLE public.hotspot_vouchers
  ADD COLUMN IF NOT EXISTS last_known_mac VARCHAR(32);

ALTER TABLE public.hotspot_vouchers
  ADD COLUMN IF NOT EXISTS mac_audit_history JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.hotspot_vouchers
  DROP CONSTRAINT IF EXISTS hotspot_vouchers_status_check;

ALTER TABLE public.hotspot_vouchers
  ADD CONSTRAINT hotspot_vouchers_status_check
  CHECK (status IN ('pending_claim','unused','active','expired','disabled','assigned','archived','deleted'))
  NOT VALID;

COMMIT;
