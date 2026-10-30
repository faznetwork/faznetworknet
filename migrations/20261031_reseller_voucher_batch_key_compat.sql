-- FAZ NETWORK | Reseller voucher batch UUID contract compatibility
-- Forward-only, additive and data-preserving. Run manually after reviewing the
-- target database identity. Does not alter voucher, issuance-item or ledger rows.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
SELECT pg_advisory_xact_lock(hashtext('faznetwork:reseller-voucher-batch-key-compat:v1'));

DO $preflight$
DECLARE
  v_type TEXT;
BEGIN
  IF to_regclass('public.reseller_voucher_batches') IS NULL THEN
    RAISE EXCEPTION 'Compatibility migration aborted: public.reseller_voucher_batches does not exist. Apply reseller voucher billing foundation first.';
  END IF;
  SELECT udt_name INTO v_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='reseller_voucher_batches' AND column_name='id';
  IF v_type IS DISTINCT FROM 'int8' THEN
    RAISE EXCEPTION 'Compatibility migration aborted: reseller_voucher_batches.id must be BIGINT/int8; found %', COALESCE(v_type,'<missing>');
  END IF;
  SELECT udt_name INTO v_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='reseller_voucher_batches' AND column_name='batch_key';
  IF v_type IS NOT NULL AND v_type IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'Compatibility migration aborted: existing batch_key has type %, expected UUID. No data was changed.', v_type;
  END IF;
END
$preflight$;

ALTER TABLE public.reseller_voucher_batches
  ADD COLUMN IF NOT EXISTS batch_key UUID;

-- Existing batch rows receive independent UUID references; internal BIGINT id
-- and all foreign-key relationships remain untouched.
UPDATE public.reseller_voucher_batches
SET batch_key = gen_random_uuid()
WHERE batch_key IS NULL;

ALTER TABLE public.reseller_voucher_batches
  ALTER COLUMN batch_key SET DEFAULT gen_random_uuid(),
  ALTER COLUMN batch_key SET NOT NULL;

-- Fail closed on duplicate pre-existing UUID values; the transaction rolls back.
CREATE UNIQUE INDEX IF NOT EXISTS uq_reseller_voucher_batches_batch_key_compat
  ON public.reseller_voucher_batches(batch_key);

DO $verify$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.reseller_voucher_batches
    WHERE batch_key IS NULL
  ) THEN
    RAISE EXCEPTION 'Compatibility migration verification failed: NULL batch_key remains.';
  END IF;
  IF EXISTS (
    SELECT batch_key FROM public.reseller_voucher_batches
    GROUP BY batch_key HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Compatibility migration verification failed: duplicate batch_key values remain.';
  END IF;
END
$verify$;

COMMIT;

-- Read-only verification:
-- SELECT COUNT(*) AS batches, COUNT(batch_key) AS batches_with_uuid,
--        COUNT(DISTINCT batch_key) AS distinct_batch_keys
-- FROM public.reseller_voucher_batches;
