-- Track one pre-expiry alert per active Hotspot package lifecycle.
-- Safe to apply repeatedly on production databases.
ALTER TABLE hotspot_vouchers
  ADD COLUMN IF NOT EXISTS pre_expiry_notified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_pre_expiry_due
  ON hotspot_vouchers (expires_at, id)
  WHERE status = 'active' AND pre_expiry_notified = FALSE;
