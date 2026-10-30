-- FAZ NETWORK | Dual-service POP IP Pool separation
-- PPPoE pool is POP-owned; Hotspot pool remains pop_hotspot_bindings.ip_pool.
-- Forward-only additive migration. Existing generic pool values are copied to
-- the PPPoE field for compatibility; the legacy column is retained unchanged.
-- Apply reseller voucher billing foundation v1.3 before this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
SELECT pg_advisory_xact_lock(hashtext('faznetwork:dual-service-pop-ip-pools:v1'));

DO $preflight$
BEGIN
  IF to_regclass('public.pops') IS NULL THEN
    RAISE EXCEPTION 'Dual-service POP migration aborted: public.pops does not exist.';
  END IF;
  IF to_regclass('public.pop_hotspot_bindings') IS NULL THEN
    RAISE EXCEPTION 'Dual-service POP migration aborted: public.pop_hotspot_bindings does not exist. Apply reseller voucher billing foundation v1.3 first.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pop_hotspot_bindings' AND column_name='ip_pool'
  ) THEN
    RAISE EXCEPTION 'Dual-service POP migration aborted: pop_hotspot_bindings.ip_pool is missing.';
  END IF;
END
$preflight$;

ALTER TABLE public.pops
  ADD COLUMN IF NOT EXISTS pppoe_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS pppoe_ip_pool VARCHAR(100);

-- Existing mikrotik_ip_pool was the legacy PPPoE assignment. Copy, never move:
-- preserve the old column and all values for rollback/legacy readers.
DO $legacy_copy$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pops' AND column_name='mikrotik_ip_pool'
  ) THEN
    UPDATE public.pops
    SET pppoe_ip_pool = NULLIF(BTRIM(mikrotik_ip_pool), '')
    WHERE pppoe_ip_pool IS NULL
      AND NULLIF(BTRIM(mikrotik_ip_pool), '') IS NOT NULL;
  END IF;
END
$legacy_copy$;

UPDATE public.pops SET pppoe_enabled=TRUE WHERE pppoe_enabled IS NULL;
ALTER TABLE public.pops
  ALTER COLUMN pppoe_enabled SET DEFAULT TRUE,
  ALTER COLUMN pppoe_enabled SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pops_reseller_pppoe_service
  ON public.pops(reseller_id, status, pppoe_enabled);

DO $verify$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pops'
      AND column_name='pppoe_ip_pool' AND udt_name='varchar'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pops'
      AND column_name='pppoe_enabled' AND udt_name='bool' AND is_nullable='NO'
  ) THEN
    RAISE EXCEPTION 'Dual-service POP migration verification failed: required PPPoE fields are missing or incompatible.';
  END IF;
END
$verify$;

COMMIT;

-- Read-only verification:
-- SELECT id,name,pppoe_enabled,pppoe_ip_pool,mikrotik_ip_pool
-- FROM public.pops ORDER BY id;
-- SELECT pop_id,status,ip_pool FROM public.pop_hotspot_bindings ORDER BY pop_id;
