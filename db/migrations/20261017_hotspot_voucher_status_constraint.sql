-- Align the Hotspot voucher lifecycle constraint with the supported states.
-- First-login and pre-assigned creation are mapped by the controller to 'unused'
-- and 'active'; 'assigned' and 'disabled' remain accepted for compatibility.
-- NOT VALID avoids blocking deployment if older rows contain a legacy state,
-- while PostgreSQL still enforces this constraint for every new/updated row.
ALTER TABLE hotspot_vouchers
  DROP CONSTRAINT IF EXISTS hotspot_vouchers_status_check;

ALTER TABLE hotspot_vouchers
  ADD CONSTRAINT hotspot_vouchers_status_check
  CHECK (status IN ('pending_claim', 'unused', 'active', 'expired', 'disabled', 'assigned'))
  NOT VALID;
