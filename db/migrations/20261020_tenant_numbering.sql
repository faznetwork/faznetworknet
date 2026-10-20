-- Stable database IDs remain unchanged for all existing foreign keys.
-- Human-facing tenant_number is backfilled in creation order and kept unique.
BEGIN;

LOCK TABLE public.tenants IN ACCESS EXCLUSIVE MODE;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS tenant_number INTEGER;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC NULLS FIRST, id ASC)::INTEGER AS tenant_number
  FROM public.tenants
)
UPDATE public.tenants AS t
SET tenant_number = numbered.tenant_number
FROM numbered
WHERE numbered.id = t.id
  AND (t.tenant_number IS NULL OR t.tenant_number <= 0);

ALTER TABLE public.tenants
  ALTER COLUMN tenant_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tenants_tenant_number
  ON public.tenants(tenant_number);

COMMIT;
