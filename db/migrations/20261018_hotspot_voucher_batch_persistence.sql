-- Persist the identity of each generated scratch-card batch for later retrieval/reprinting.
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS batch_id VARCHAR(36);
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_batch_status
  ON hotspot_vouchers(batch_id,status)
  WHERE batch_id IS NOT NULL;
