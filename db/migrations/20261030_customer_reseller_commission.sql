-- Backward-compatible reseller commission metadata for POP / zone assignments.
-- Existing customer rows retain all current values and receive a zero commission.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS reseller_commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS reseller_commission_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00;

-- Normalize only invalid or missing commission metadata; do not touch customer,
-- billing, payment, or transaction data.
UPDATE customers
SET reseller_commission_type = 'percentage'
WHERE reseller_commission_type IS NULL
   OR reseller_commission_type NOT IN ('percentage', 'fixed');

UPDATE customers
SET reseller_commission_rate = 0.00
WHERE reseller_commission_rate IS NULL OR reseller_commission_rate < 0;
