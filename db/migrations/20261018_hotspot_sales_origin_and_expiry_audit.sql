-- Hotspot sales origin and audit-safe expiry lifecycle.
-- Idempotent for existing installations; does not delete transaction history.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sale_type VARCHAR(24);
UPDATE transactions
SET sale_type = CASE
  WHEN claim_flow = 'hotspot' OR claim_flow = 'manual_hotspot' THEN 'online_mfs'
  WHEN channel = 'cash' THEN 'scratch_card'
  WHEN claim_flow = 'pppoe' THEN 'online_mfs'
  ELSE 'other'
END
WHERE sale_type IS NULL OR BTRIM(sale_type) = '';
ALTER TABLE transactions ALTER COLUMN sale_type SET DEFAULT 'other';
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_sale_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_sale_type_check
  CHECK (sale_type IN ('online_mfs','scratch_card','manual','other'));
CREATE INDEX IF NOT EXISTS idx_transactions_sales_type_created
  ON transactions(sale_type, created_at DESC) WHERE status IN ('processed','PAID');

ALTER TABLE hotspot_voucher_payments ADD COLUMN IF NOT EXISTS profile VARCHAR(100);
ALTER TABLE hotspot_voucher_payments ADD COLUMN IF NOT EXISTS sale_type VARCHAR(24);
UPDATE hotspot_voucher_payments hp
SET profile = COALESCE(hp.profile, v.profile),
    sale_type = COALESCE(hp.sale_type, t.sale_type, 'other')
FROM transactions t
LEFT JOIN hotspot_vouchers v ON v.id = hp.voucher_id
WHERE t.id = hp.transaction_id AND (hp.profile IS NULL OR hp.sale_type IS NULL);
UPDATE hotspot_voucher_payments SET sale_type='other' WHERE sale_type IS NULL;
ALTER TABLE hotspot_voucher_payments ALTER COLUMN sale_type SET DEFAULT 'other';
ALTER TABLE hotspot_voucher_payments DROP CONSTRAINT IF EXISTS hotspot_voucher_payments_sale_type_check;
ALTER TABLE hotspot_voucher_payments ADD CONSTRAINT hotspot_voucher_payments_sale_type_check
  CHECK (sale_type IN ('online_mfs','scratch_card','manual','other'));
CREATE INDEX IF NOT EXISTS idx_hotspot_voucher_payments_sales_type_created
  ON hotspot_voucher_payments(sale_type, created_at DESC);
