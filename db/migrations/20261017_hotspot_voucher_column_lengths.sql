-- Safely widen Hotspot voucher identity and lifecycle columns on existing installations.
-- These changes are additive in capacity; no existing rows are rewritten or deleted.
ALTER TABLE hotspot_vouchers
  ALTER COLUMN username TYPE VARCHAR(160),
  ALTER COLUMN password TYPE VARCHAR(160),
  ALTER COLUMN mac_address TYPE VARCHAR(32),
  ALTER COLUMN status TYPE VARCHAR(32),
  ALTER COLUMN cleanup_status TYPE VARCHAR(32);

DO $faz_hotspot_voucher_customer_name_length$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'hotspot_vouchers'
      AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE hotspot_vouchers ALTER COLUMN customer_name TYPE VARCHAR(200);
  END IF;
END;
$faz_hotspot_voucher_customer_name_length$;
