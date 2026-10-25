-- Add explicit sales-origin metadata to the read-only Hotspot sales archive.
-- Existing rows remain untouched; NULL means legacy category evidence is unavailable.
ALTER TABLE hotspot_voucher_sales_archive ADD COLUMN IF NOT EXISTS sale_type VARCHAR(24);
ALTER TABLE hotspot_voucher_sales_archive ADD COLUMN IF NOT EXISTS subscriber_type VARCHAR(32);
