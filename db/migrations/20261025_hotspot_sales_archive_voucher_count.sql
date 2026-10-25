-- Preserve verified voucher counts for sales archived before voucher rows are purged.
-- NULL intentionally means the historical voucher count cannot be proven from retained data.
ALTER TABLE hotspot_voucher_sales_archive
  ADD COLUMN IF NOT EXISTS voucher_count INTEGER
  CHECK (voucher_count IS NULL OR voucher_count >= 0);
