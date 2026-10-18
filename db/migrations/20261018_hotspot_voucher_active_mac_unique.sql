-- Allow MAC reuse across expired/used voucher history while enforcing one active voucher per MAC.
-- The previous strict index guaranteed MAC uniqueness, so creating the narrower active-only
-- index does not encounter existing duplicate MAC values during this migration.
DROP INDEX IF EXISTS uq_hotspot_vouchers_mac_address_ci;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_vouchers_active_mac_ci
  ON hotspot_vouchers (LOWER(mac_address))
  WHERE status = 'active' AND mac_address IS NOT NULL;
