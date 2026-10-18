-- Persist the identity of each generated scratch-card batch for later retrieval/reprinting.
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS batch_id VARCHAR(36);
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_batch_status
  ON hotspot_vouchers(batch_id,status)
  WHERE batch_id IS NOT NULL;
-- Backfill pre-existing unused scratch cards into stable legacy groups so they can be reprinted.
UPDATE hotspot_vouchers
SET batch_id = (
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),1,8) || '-' ||
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),9,4) || '-' ||
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),13,4) || '-' ||
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),17,4) || '-' ||
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),21,12)
)
WHERE subscriber_type='scratch_voucher' AND status='unused' AND batch_id IS NULL;
