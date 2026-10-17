-- Fix Hotspot archive failures caused by the status CHECK constraint omitting 'archived'.
-- PostgreSQL rejects UPDATE ... SET status='archived' while this constraint excludes it.
-- NOT VALID preserves compatibility with existing legacy rows while enforcing new writes.
ALTER TABLE hotspot_vouchers
  DROP CONSTRAINT IF EXISTS hotspot_vouchers_status_check;

ALTER TABLE hotspot_vouchers
  ADD CONSTRAINT hotspot_vouchers_status_check
  CHECK (status IN ('pending_claim', 'unused', 'active', 'expired', 'disabled', 'assigned', 'archived'))
  NOT VALID;
