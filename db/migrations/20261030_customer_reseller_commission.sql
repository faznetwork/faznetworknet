-- Backward-compatible reseller commission metadata for POP / zone assignments.
-- Existing customer rows retain all current values and receive a zero commission.
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS reseller_commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage';

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS reseller_commission_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00;
