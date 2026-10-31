-- FAZ NETWORK | Reconcile existing POP Hotspot package wholesale prices to the approved 30% reseller margin.
-- Forward-only and idempotent: rows with an existing wholesale override are preserved.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

DO $preflight$
BEGIN
  IF to_regclass('public.pop_hotspot_packages') IS NULL THEN
    RAISE EXCEPTION 'Cannot reconcile reseller Hotspot pricing: public.pop_hotspot_packages does not exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pop_hotspot_packages' AND column_name='retail_price'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pop_hotspot_packages' AND column_name='wholesale_price'
  ) THEN
    RAISE EXCEPTION 'Cannot reconcile reseller Hotspot pricing: retail_price and wholesale_price columns are required.';
  END IF;
END
$preflight$;

UPDATE public.pop_hotspot_packages
SET wholesale_price = ROUND(retail_price * 0.70, 2)
WHERE wholesale_price = retail_price;

COMMIT;
