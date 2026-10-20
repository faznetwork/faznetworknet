-- Tenant ownership expansion for legacy billing and subscriber data.
-- Safe, additive, and intentionally does NOT guess ownership for existing rows.
-- Existing rows stay tenant_id NULL until an operator completes a reviewed mapping.
-- Tenant-facing legacy APIs must remain blocked while unresolved rows exist.

BEGIN;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE RESTRICT;
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE RESTRICT;
ALTER TABLE public.hotspot_vouchers
  ADD COLUMN IF NOT EXISTS tenant_id BIGINT REFERENCES public.tenants(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_customers_tenant_id_id
  ON public.customers(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant_id_created
  ON public.transactions(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_tenant_id_id
  ON public.hotspot_vouchers(tenant_id, id);
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_tenant_transaction
  ON public.hotspot_vouchers(tenant_id, transaction_id);

CREATE TABLE IF NOT EXISTS public.tenant_ownership_migration_audit (
  id BIGSERIAL PRIMARY KEY,
  migration_key TEXT NOT NULL,
  table_name TEXT NOT NULL,
  unresolved_rows BIGINT NOT NULL CHECK (unresolved_rows >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (migration_key, table_name)
);

-- Record unresolved legacy ownership counts; never assign these rows to a tenant
-- based on usernames, phone numbers, or a global router configuration heuristic.
INSERT INTO public.tenant_ownership_migration_audit
  (migration_key, table_name, unresolved_rows, details)
SELECT 'legacy-tenant-ownership-v1', 'customers',
       COUNT(*) FILTER (WHERE tenant_id IS NULL),
       jsonb_build_object('policy', 'manual-reviewed-mapping-required')
FROM public.customers
ON CONFLICT (migration_key, table_name) DO UPDATE
SET unresolved_rows = EXCLUDED.unresolved_rows,
    details = EXCLUDED.details,
    checked_at = NOW();

INSERT INTO public.tenant_ownership_migration_audit
  (migration_key, table_name, unresolved_rows, details)
SELECT 'legacy-tenant-ownership-v1', 'transactions',
       COUNT(*) FILTER (WHERE tenant_id IS NULL),
       jsonb_build_object('policy', 'manual-reviewed-mapping-required')
FROM public.transactions
ON CONFLICT (migration_key, table_name) DO UPDATE
SET unresolved_rows = EXCLUDED.unresolved_rows,
    details = EXCLUDED.details,
    checked_at = NOW();

INSERT INTO public.tenant_ownership_migration_audit
  (migration_key, table_name, unresolved_rows, details)
SELECT 'legacy-tenant-ownership-v1', 'hotspot_vouchers',
       COUNT(*) FILTER (WHERE tenant_id IS NULL),
       jsonb_build_object('policy', 'manual-reviewed-mapping-required')
FROM public.hotspot_vouchers
ON CONFLICT (migration_key, table_name) DO UPDATE
SET unresolved_rows = EXCLUDED.unresolved_rows,
    details = EXCLUDED.details,
    checked_at = NOW();

COMMIT;
