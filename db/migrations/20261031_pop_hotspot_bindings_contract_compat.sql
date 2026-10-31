-- FAZ NETWORK | POP Hotspot binding compatibility alignment
-- Forward-only, idempotent, transactional. No row deletion or data backfill.
-- Apply after confirming the target database and reviewing the preflight output.

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
SET LOCAL idle_in_transaction_session_timeout = '120s';

SELECT pg_advisory_xact_lock(
  hashtext('faznetwork:pop-hotspot-binding-compat:v1')
);

DO $preflight$
BEGIN
  IF to_regclass('public.pop_hotspot_bindings') IS NULL THEN
    RAISE EXCEPTION 'POP Hotspot compatibility migration aborted: public.pop_hotspot_bindings does not exist.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pop_hotspot_bindings' AND column_name='id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pop_hotspot_bindings' AND column_name='pop_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pop_hotspot_bindings' AND column_name='vlan_id'
  ) THEN
    RAISE EXCEPTION 'POP Hotspot compatibility migration aborted: expected id, pop_id, or vlan_id column is missing.';
  END IF;
END
$preflight$;

DO $drop_legacy_identity$
DECLARE
  v_id_attnum SMALLINT;
  v_pop_id_attnum SMALLINT;
  v_constraint RECORD;
BEGIN
  SELECT attnum INTO v_id_attnum
  FROM pg_attribute
  WHERE attrelid='public.pop_hotspot_bindings'::regclass AND attname='id' AND NOT attisdropped;

  SELECT attnum INTO v_pop_id_attnum
  FROM pg_attribute
  WHERE attrelid='public.pop_hotspot_bindings'::regclass AND attname='pop_id' AND NOT attisdropped;

  IF v_id_attnum IS NULL OR v_pop_id_attnum IS NULL THEN
    RAISE EXCEPTION 'POP Hotspot compatibility migration aborted: cannot resolve id/pop_id catalog attributes.';
  END IF;

  FOR v_constraint IN
    SELECT c.conname,c.contype,c.conkey
    FROM pg_constraint c
    WHERE c.conrelid='public.pop_hotspot_bindings'::regclass
      AND (
        c.conname IN ('uq_pop_hotspot_bindings_identity','pop_hotspot_bindings_identity')
        OR (
          c.contype='u'
          AND (
            c.conkey=ARRAY[v_id_attnum,v_pop_id_attnum]::SMALLINT[]
            OR c.conkey=ARRAY[v_pop_id_attnum,v_id_attnum]::SMALLINT[]
          )
        )
      )
  LOOP
    IF v_constraint.contype <> 'u' THEN
      RAISE EXCEPTION 'POP Hotspot compatibility migration aborted: legacy identity name % is not a UNIQUE constraint.',v_constraint.conname;
    END IF;
    EXECUTE format('ALTER TABLE public.pop_hotspot_bindings DROP CONSTRAINT IF EXISTS %I',v_constraint.conname);
  END LOOP;
END
$drop_legacy_identity$;

DO $ensure_pop_id_unique$
DECLARE
  v_pop_id_attnum SMALLINT;
  v_existing_name TEXT;
BEGIN
  SELECT attnum INTO v_pop_id_attnum
  FROM pg_attribute
  WHERE attrelid='public.pop_hotspot_bindings'::regclass AND attname='pop_id' AND NOT attisdropped;

  SELECT c.conname INTO v_existing_name
  FROM pg_constraint c
  WHERE c.conrelid='public.pop_hotspot_bindings'::regclass
    AND c.conname='pop_hotspot_bindings_pop_unique';

  IF FOUND THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint c
      WHERE c.conrelid='public.pop_hotspot_bindings'::regclass
        AND c.conname='pop_hotspot_bindings_pop_unique'
        AND c.contype='u'
        AND c.conkey=ARRAY[v_pop_id_attnum]::SMALLINT[]
    ) THEN
      RAISE EXCEPTION 'POP Hotspot compatibility migration aborted: pop_hotspot_bindings_pop_unique exists with an incompatible definition.';
    END IF;
  ELSE
    SELECT c.conname INTO v_existing_name
    FROM pg_constraint c
    WHERE c.conrelid='public.pop_hotspot_bindings'::regclass
      AND c.contype='u'
      AND c.conkey=ARRAY[v_pop_id_attnum]::SMALLINT[]
    ORDER BY c.conname
    LIMIT 1;

    IF FOUND THEN
      EXECUTE format(
        'ALTER TABLE public.pop_hotspot_bindings RENAME CONSTRAINT %I TO %I',
        v_existing_name,'pop_hotspot_bindings_pop_unique'
      );
    ELSE
      IF EXISTS (
        SELECT 1 FROM public.pop_hotspot_bindings
        GROUP BY pop_id HAVING COUNT(*) > 1
      ) THEN
        RAISE EXCEPTION 'POP Hotspot compatibility migration aborted: duplicate pop_id rows prevent UNIQUE(pop_id); no rows were deleted or changed.';
      END IF;
      ALTER TABLE public.pop_hotspot_bindings
        ADD CONSTRAINT pop_hotspot_bindings_pop_unique UNIQUE (pop_id);
    END IF;
  END IF;
END
$ensure_pop_id_unique$;

ALTER TABLE public.pop_hotspot_bindings
  ALTER COLUMN vlan_id DROP NOT NULL;

DO $legacy_is_active$
DECLARE
  v_type TEXT;
BEGIN
  SELECT udt_name INTO v_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='pop_hotspot_bindings' AND column_name='is_active';

  IF FOUND THEN
    IF v_type IS DISTINCT FROM 'bool' THEN
      RAISE EXCEPTION 'POP Hotspot compatibility migration aborted: legacy is_active must be BOOLEAN; found %.',COALESCE(v_type,'<missing>');
    END IF;
    ALTER TABLE public.pop_hotspot_bindings
      ALTER COLUMN is_active DROP NOT NULL,
      ALTER COLUMN is_active SET DEFAULT TRUE;
  END IF;
END
$legacy_is_active$;

DO $verify$
DECLARE
  v_pop_id_attnum SMALLINT;
  v_id_attnum SMALLINT;
  v_is_active_default TEXT;
  v_is_active_nullable TEXT;
BEGIN
  SELECT attnum INTO v_pop_id_attnum
  FROM pg_attribute
  WHERE attrelid='public.pop_hotspot_bindings'::regclass AND attname='pop_id' AND NOT attisdropped;
  SELECT attnum INTO v_id_attnum
  FROM pg_attribute
  WHERE attrelid='public.pop_hotspot_bindings'::regclass AND attname='id' AND NOT attisdropped;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.pop_hotspot_bindings'::regclass
      AND c.conname='pop_hotspot_bindings_pop_unique'
      AND c.contype='u'
      AND c.conkey=ARRAY[v_pop_id_attnum]::SMALLINT[]
  ) THEN
    RAISE EXCEPTION 'POP Hotspot compatibility migration verification failed: single-column UNIQUE(pop_id) is missing.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint c
    WHERE c.conrelid='public.pop_hotspot_bindings'::regclass
      AND c.contype='u'
      AND (
        c.conkey=ARRAY[v_id_attnum,v_pop_id_attnum]::SMALLINT[]
        OR c.conkey=ARRAY[v_pop_id_attnum,v_id_attnum]::SMALLINT[]
      )
  ) THEN
    RAISE EXCEPTION 'POP Hotspot compatibility migration verification failed: legacy composite identity UNIQUE constraint remains.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='pop_hotspot_bindings'
      AND column_name='vlan_id' AND is_nullable='YES'
  ) THEN
    RAISE EXCEPTION 'POP Hotspot compatibility migration verification failed: vlan_id is still NOT NULL.';
  END IF;

  SELECT column_default,is_nullable INTO v_is_active_default,v_is_active_nullable
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='pop_hotspot_bindings' AND column_name='is_active';

  IF FOUND AND (v_is_active_default IS DISTINCT FROM 'true' OR v_is_active_nullable IS DISTINCT FROM 'YES') THEN
    RAISE EXCEPTION 'POP Hotspot compatibility migration verification failed: legacy is_active must be nullable with DEFAULT TRUE.';
  END IF;
END
$verify$;

COMMIT;

-- Read-only post-run verification:
-- SELECT conname,pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid='public.pop_hotspot_bindings'::regclass AND contype='u'
-- ORDER BY conname;
--
-- SELECT column_name,is_nullable,column_default
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name='pop_hotspot_bindings'
--   AND column_name IN ('vlan_id','is_active','status')
-- ORDER BY column_name;
