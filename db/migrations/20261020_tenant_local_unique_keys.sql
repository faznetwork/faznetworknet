-- Tenant-local natural keys for records created after tenant ownership migration.
-- Run after 20261020_tenant_ownership_v1.sql. Unassigned legacy rows remain
-- unassigned and are not made visible to tenant sessions.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.customers'::regclass AND conname='customers_phone_key') THEN
    ALTER TABLE public.customers DROP CONSTRAINT customers_phone_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.customers'::regclass AND conname='customers_username_key') THEN
    ALTER TABLE public.customers DROP CONSTRAINT customers_username_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.transactions'::regclass AND conname='transactions_trx_id_key') THEN
    ALTER TABLE public.transactions DROP CONSTRAINT transactions_trx_id_key;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.hotspot_vouchers'::regclass AND conname='hotspot_vouchers_username_key') THEN
    ALTER TABLE public.hotspot_vouchers DROP CONSTRAINT hotspot_vouchers_username_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_tenant_phone
  ON public.customers(tenant_id, phone) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_tenant_username
  ON public.customers(tenant_id, username) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_tenant_trx_id
  ON public.transactions(tenant_id, trx_id) WHERE tenant_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_vouchers_tenant_username
  ON public.hotspot_vouchers(tenant_id, username) WHERE tenant_id IS NOT NULL;

-- Preserve legacy uniqueness for platform-owned/unassigned rows explicitly.
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_unassigned_phone
  ON public.customers(phone) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_unassigned_username
  ON public.customers(username) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_unassigned_trx_id
  ON public.transactions(trx_id) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_vouchers_unassigned_username
  ON public.hotspot_vouchers(username) WHERE tenant_id IS NULL;

COMMIT;
