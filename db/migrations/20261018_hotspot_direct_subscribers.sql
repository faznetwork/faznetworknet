-- Idempotent migration: distinguish direct subscribers from voucher inventory.
-- Existing rows stay legacy; do not infer direct ownership from phone/MAC fields alone.
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS subscriber_type VARCHAR(24) NOT NULL DEFAULT 'legacy';
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS activation_type VARCHAR(24) NOT NULL DEFAULT 'legacy';
ALTER TABLE hotspot_vouchers DROP CONSTRAINT IF EXISTS hotspot_vouchers_subscriber_type_check;
ALTER TABLE hotspot_vouchers ADD CONSTRAINT hotspot_vouchers_subscriber_type_check
  CHECK (subscriber_type IN ('direct_subscriber','scratch_voucher','legacy'));
ALTER TABLE hotspot_vouchers DROP CONSTRAINT IF EXISTS hotspot_vouchers_activation_type_check;
ALTER TABLE hotspot_vouchers ADD CONSTRAINT hotspot_vouchers_activation_type_check
  CHECK (activation_type IN ('preassigned','first_login','legacy'));
CREATE INDEX IF NOT EXISTS idx_hotspot_direct_subscriber_phone
  ON hotspot_vouchers (REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g'), id DESC)
  WHERE subscriber_type='direct_subscriber' AND status IN ('pending_claim','unused','active','expired');
CREATE INDEX IF NOT EXISTS idx_hotspot_direct_subscriber_mac
  ON hotspot_vouchers (LOWER(mac_address), id DESC)
  WHERE subscriber_type='direct_subscriber' AND mac_address IS NOT NULL;
