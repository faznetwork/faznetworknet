-- FAZ NETWORK | Align POP package catalog with the live validity_seconds/is_active contract.
-- Forward-only, idempotent, and non-destructive: legacy columns are retained.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';

DO $preflight$
BEGIN
  IF to_regclass('public.pop_hotspot_packages') IS NULL THEN
    RAISE EXCEPTION 'Cannot align POP package catalog: public.pop_hotspot_packages does not exist.';
  END IF;
END
$preflight$;

ALTER TABLE public.pop_hotspot_packages
  ADD COLUMN IF NOT EXISTS validity_seconds BIGINT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN;

DO $compat$
DECLARE
  has_legacy_validity BOOLEAN;
  has_legacy_status BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pop_hotspot_packages' AND column_name='validity'
  ) INTO has_legacy_validity;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pop_hotspot_packages' AND column_name='status'
  ) INTO has_legacy_status;

  IF has_legacy_validity THEN
    UPDATE public.pop_hotspot_packages
    SET validity_seconds = CASE
      WHEN validity_seconds IS NOT NULL THEN validity_seconds
      WHEN validity ~* '^[[:space:]]*[0-9]+[[:space:]]*-?[[:space:]]*(s|sec|secs|second|seconds)$'
        THEN substring(validity from '[0-9]+')::bigint
      WHEN validity ~* '^[[:space:]]*[0-9]+[[:space:]]*-?[[:space:]]*(m|min|mins|minute|minutes)$'
        THEN substring(validity from '[0-9]+')::bigint * 60
      WHEN validity ~* '^[[:space:]]*[0-9]+[[:space:]]*-?[[:space:]]*(h|hr|hrs|hour|hours)$'
        THEN substring(validity from '[0-9]+')::bigint * 3600
      WHEN validity ~* '^[[:space:]]*[0-9]+[[:space:]]*-?[[:space:]]*(d|day|days)$'
        THEN substring(validity from '[0-9]+')::bigint * 86400
      WHEN validity ~* '^[[:space:]]*[0-9]+[[:space:]]*-?[[:space:]]*(w|week|weeks)$'
        THEN substring(validity from '[0-9]+')::bigint * 604800
      WHEN validity ~* '^[[:space:]]*[0-9]+([.][0-9]+)?[[:space:]]*(gb|g)$'
        THEN 0
      ELSE NULL
    END
    WHERE validity_seconds IS NULL;
  END IF;

  IF has_legacy_status THEN
    UPDATE public.pop_hotspot_packages
    SET is_active = (status='active')
    WHERE is_active IS NULL;
  ELSE
    UPDATE public.pop_hotspot_packages
    SET is_active = TRUE
    WHERE is_active IS NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pop_hotspot_packages
    WHERE validity_seconds IS NULL OR is_active IS NULL
  ) THEN
    RAISE EXCEPTION 'POP package contract migration stopped: one or more rows cannot be mapped safely to validity_seconds/is_active. Review legacy validity values before retrying.';
  END IF;
END
$compat$;

ALTER TABLE public.pop_hotspot_packages
  ALTER COLUMN validity_seconds SET DEFAULT 0,
  ALTER COLUMN validity_seconds SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT TRUE,
  ALTER COLUMN is_active SET NOT NULL;

-- The foundation contract already declares UNIQUE(pop_id,profile_key). This
-- migration verifies that contract rather than adding a duplicate unique index.
DO $unique_contract$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.pop_hotspot_packages'::regclass
      AND contype IN ('p','u')
      AND conkey = ARRAY[
        (SELECT attnum FROM pg_attribute WHERE attrelid='public.pop_hotspot_packages'::regclass AND attname='pop_id'),
        (SELECT attnum FROM pg_attribute WHERE attrelid='public.pop_hotspot_packages'::regclass AND attname='profile_key')
      ]::smallint[]
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid='public.pop_hotspot_packages'::regclass
      AND i.indisunique AND i.indisvalid
      AND (SELECT array_agg(a.attname::text ORDER BY k.ord)
           FROM unnest(i.indkey) WITH ORDINALITY k(attnum,ord)
           JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.attnum
           WHERE k.ord <= i.indnkeyatts) = ARRAY['pop_id','profile_key']::text[]
  ) THEN
    RAISE EXCEPTION 'POP package contract migration stopped: UNIQUE(pop_id,profile_key) is required for idempotent core-profile materialization.';
  END IF;
END
$unique_contract$;

CREATE INDEX IF NOT EXISTS idx_pop_hotspot_packages_active_catalog
  ON public.pop_hotspot_packages(pop_id,is_active,id);
COMMIT;
