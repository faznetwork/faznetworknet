-- Add the customer expiry date used by tenantDataController.listCustomers.
-- DATE is appropriate for a calendar expiry day; use TIMESTAMPTZ only if the
-- application stores and compares an exact expiry instant.
BEGIN;
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS expiry_date DATE;
COMMIT;
