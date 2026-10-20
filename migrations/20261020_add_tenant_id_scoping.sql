-- Tenant ownership columns for legacy tables used by tenant-scoped APIs.
-- Safe rollout: nullable columns only; this migration deliberately does not guess ownership
-- for pre-existing rows. Backfill tenant_id from a verified tenant-to-record mapping before
-- relying on tenant-scoped list endpoints to expose historical records.
BEGIN;

DO $migration$
DECLARE
  tenant_id_type text;
  tbl text;
  constraint_name text;
  tables_to_scope text[] := ARRAY[
    'customers',
    'transactions',
    'vouchers',
    'hotspot_vouchers',
    'hotspot_users',
    'packages',
    'payments',
    'invoices',
    'expenses',
    'routers',
    'olt_devices',
    'support_tickets'
  ];
BEGIN
  IF to_regclass('public.tenants') IS NULL THEN
    RAISE EXCEPTION 'Required table public.tenants does not exist';
  END IF;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO tenant_id_type
  FROM pg_attribute a
  WHERE a.attrelid = 'public.tenants'::regclass
    AND a.attname = 'id'
    AND a.attnum > 0
    AND NOT a.attisdropped;

  IF tenant_id_type IS NULL THEN
    RAISE EXCEPTION 'Required column public.tenants.id does not exist';
  END IF;

  FOREACH tbl IN ARRAY tables_to_scope LOOP
    IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id %s',
        tbl, tenant_id_type
      );

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I (tenant_id)',
        left(tbl || '_tenant_id_idx', 63), tbl
      );

      constraint_name := left(tbl || '_tenant_id_fkey', 63);
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint c
        WHERE c.conrelid = format('public.%I', tbl)::regclass
          AND c.conname = constraint_name
      ) THEN
        EXECUTE format(
          'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE NOT VALID',
          tbl, constraint_name
        );
      END IF;
    END IF;
  END LOOP;
END
$migration$;

COMMIT;
