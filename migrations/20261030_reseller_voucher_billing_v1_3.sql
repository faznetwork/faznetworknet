-- ============================================================================
-- FAZ NETWORK | Reseller Hotspot Voucher & Billing Foundation
-- PostgreSQL 18 | Migration v1.3 | Single transaction | Idempotent by contract
--
-- CONFIRMED LIVE CATALOG TYPES:
--   public.resellers.id             INTEGER (int4)
--   public.pops.id                  INTEGER (int4)
--   public.hotspot_vouchers.id      BIGINT  (int8)
--
-- Therefore:
--   reseller_id INTEGER
--   pop_id      INTEGER
--   voucher_id  BIGINT
--
-- BUSINESS DECISIONS:
--   router_key is a text snapshot; there is no router registry FK.
--   pops.commission_type / commission_rate are PPPoE-only and are untouched.
--   Hotspot reseller margin = retail_price - wholesale_price.
--
-- SAFETY:
--   This script only creates the seven reseller tables, their constraints,
--   indexes, and the append-only ledger trigger. It does not update or delete
--   existing customer, voucher, transaction, POP, reseller, or billing rows.
--   It does not change existing tables or RouterOS configuration.
--
-- IMPORTANT:
--   Review the exact live schema and test on a PostgreSQL 18 staging clone
--   before production execution. Run manually during an approved window.
-- ============================================================================

BEGIN;

SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
SET LOCAL idle_in_transaction_session_timeout = '120s';

-- Serialize concurrent attempts of this migration.
SELECT pg_advisory_xact_lock(hashtext('faznetwork:reseller-voucher-billing:v1.3'));

-- 1) Strict live-catalog preflight. Fail closed before creating anything.
DO $faz_preflight$
DECLARE
  v_type TEXT;
BEGIN
  IF to_regclass('public.resellers') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.resellers does not exist';
  END IF;
  IF to_regclass('public.pops') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.pops does not exist';
  END IF;
  IF to_regclass('public.hotspot_vouchers') IS NULL THEN
    RAISE EXCEPTION 'Preflight failed: public.hotspot_vouchers does not exist';
  END IF;

  SELECT udt_name INTO v_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='resellers' AND column_name='id';
  IF v_type IS DISTINCT FROM 'int4' THEN
    RAISE EXCEPTION 'Preflight failed: resellers.id must be INTEGER/int4; found %', COALESCE(v_type,'<missing>');
  END IF;

  SELECT udt_name INTO v_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='pops' AND column_name='id';
  IF v_type IS DISTINCT FROM 'int4' THEN
    RAISE EXCEPTION 'Preflight failed: pops.id must be INTEGER/int4; found %', COALESCE(v_type,'<missing>');
  END IF;

  SELECT udt_name INTO v_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='hotspot_vouchers' AND column_name='id';
  IF v_type IS DISTINCT FROM 'int8' THEN
    RAISE EXCEPTION 'Preflight failed: hotspot_vouchers.id must be BIGINT/int8; found %', COALESCE(v_type,'<missing>');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.resellers'::regclass AND contype IN ('p','u')
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                          WHERE attrelid='public.resellers'::regclass AND attname='id')]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Preflight failed: public.resellers.id must be PRIMARY KEY or UNIQUE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.pops'::regclass AND contype IN ('p','u')
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                          WHERE attrelid='public.pops'::regclass AND attname='id')]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Preflight failed: public.pops.id must be PRIMARY KEY or UNIQUE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.hotspot_vouchers'::regclass AND contype IN ('p','u')
      AND conkey = ARRAY[(SELECT attnum FROM pg_attribute
                          WHERE attrelid='public.hotspot_vouchers'::regclass AND attname='id')]::smallint[]
  ) THEN
    RAISE EXCEPTION 'Preflight failed: public.hotspot_vouchers.id must be PRIMARY KEY or UNIQUE';
  END IF;

  -- Detect same-named relations of the wrong kind/schema before IF NOT EXISTS.
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public'
      AND c.relname IN (
        'pop_hotspot_bindings','pop_hotspot_packages','reseller_billing_accounts',
        'reseller_voucher_batches','reseller_voucher_issuance_items',
        'reseller_settlements','reseller_ledger_entries'
      )
      AND c.relkind NOT IN ('r','p')
  ) THEN
    RAISE EXCEPTION 'Preflight failed: a target relation name is occupied by a non-table object';
  END IF;
END
$faz_preflight$;

-- 2) POP -> centrally-managed MikroTik binding.
-- router_key is a stable identifier snapshot, NOT a router-table FK.
CREATE TABLE IF NOT EXISTS public.pop_hotspot_bindings (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pop_id INTEGER NOT NULL,
  router_key VARCHAR(120) NOT NULL DEFAULT 'core_mikrotik',
  hotspot_server VARCHAR(100) NOT NULL,
  hotspot_interface VARCHAR(100),
  vlan_id INTEGER,
  ip_pool VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'inactive',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pop_hotspot_bindings_pop_fk
    FOREIGN KEY (pop_id) REFERENCES public.pops(id) ON DELETE RESTRICT,
  CONSTRAINT pop_hotspot_bindings_pop_unique UNIQUE (pop_id),
  CONSTRAINT pop_hotspot_bindings_status_check
    CHECK (status IN ('active','inactive')),
  CONSTRAINT pop_hotspot_bindings_router_key_check
    CHECK (length(btrim(router_key)) BETWEEN 1 AND 120),
  CONSTRAINT pop_hotspot_bindings_server_check
    CHECK (length(btrim(hotspot_server)) BETWEEN 1 AND 100),
  CONSTRAINT pop_hotspot_bindings_vlan_check
    CHECK (vlan_id IS NULL OR vlan_id BETWEEN 1 AND 4094)
);

-- 3) POP-specific authoritative allowed Hotspot package catalogue.
CREATE TABLE IF NOT EXISTS public.pop_hotspot_packages (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  pop_id INTEGER NOT NULL,
  package_name VARCHAR(120) NOT NULL,
  profile_key VARCHAR(120) NOT NULL,
  validity VARCHAR(50) NOT NULL,
  time_limit VARCHAR(50),
  data_limit VARCHAR(50),
  retail_price NUMERIC(12,2) NOT NULL,
  wholesale_price NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT pop_hotspot_packages_pop_fk
    FOREIGN KEY (pop_id) REFERENCES public.pops(id) ON DELETE RESTRICT,
  CONSTRAINT pop_hotspot_packages_pop_profile_unique UNIQUE (pop_id, profile_key),
  CONSTRAINT pop_hotspot_packages_status_check
    CHECK (status IN ('active','inactive')),
  CONSTRAINT pop_hotspot_packages_name_check
    CHECK (length(btrim(package_name)) BETWEEN 1 AND 120),
  CONSTRAINT pop_hotspot_packages_profile_check
    CHECK (length(btrim(profile_key)) BETWEEN 1 AND 120),
  CONSTRAINT pop_hotspot_packages_validity_check
    CHECK (length(btrim(validity)) BETWEEN 1 AND 50),
  CONSTRAINT pop_hotspot_packages_price_check
    CHECK (retail_price >= 0 AND wholesale_price >= 0 AND wholesale_price <= retail_price),
  CONSTRAINT pop_hotspot_packages_display_order_check CHECK (display_order >= 0)
);

-- 4) One cached financial projection per reseller.
CREATE TABLE IF NOT EXISTS public.reseller_billing_accounts (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  reseller_id INTEGER NOT NULL,
  billing_mode VARCHAR(20) NOT NULL DEFAULT 'prepaid',
  wallet_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  receivable_balance NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  credit_limit NUMERIC(14,2) NOT NULL DEFAULT 0.00,
  currency CHAR(3) NOT NULL DEFAULT 'BDT',
  account_status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reseller_billing_accounts_reseller_fk
    FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_billing_accounts_reseller_unique UNIQUE (reseller_id),
  CONSTRAINT reseller_billing_accounts_id_reseller_unique UNIQUE (id,reseller_id),
  CONSTRAINT reseller_billing_accounts_mode_check CHECK (billing_mode IN ('prepaid','postpaid')),
  CONSTRAINT reseller_billing_accounts_status_check CHECK (account_status IN ('active','suspended','closed')),
  CONSTRAINT reseller_billing_accounts_amounts_check
    CHECK (wallet_balance >= 0 AND receivable_balance >= 0 AND credit_limit >= 0),
  CONSTRAINT reseller_billing_accounts_currency_check CHECK (currency ~ '^[A-Z]{3}$')
);

-- 5) Immutable commercial snapshot of each reseller issuance operation.
CREATE TABLE IF NOT EXISTS public.reseller_voucher_batches (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  batch_key UUID NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key VARCHAR(120) NOT NULL,
  reseller_id INTEGER NOT NULL,
  pop_id INTEGER NOT NULL,
  billing_account_id BIGINT NOT NULL,
  binding_id BIGINT NOT NULL,
  package_id BIGINT NOT NULL,
  router_key VARCHAR(120) NOT NULL,
  hotspot_server VARCHAR(100) NOT NULL,
  hotspot_interface VARCHAR(100),
  vlan_id INTEGER,
  ip_pool VARCHAR(100),
  profile_key VARCHAR(120) NOT NULL,
  validity VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  retail_unit_price NUMERIC(12,2) NOT NULL,
  wholesale_unit_price NUMERIC(12,2) NOT NULL,
  retail_total NUMERIC(14,2) NOT NULL,
  wholesale_total NUMERIC(14,2) NOT NULL,
  margin_total NUMERIC(14,2) NOT NULL,
  billing_mode VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'issued',
  actor_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reseller_voucher_batches_key_unique UNIQUE (batch_key),
  CONSTRAINT reseller_voucher_batches_idempotency_unique UNIQUE (reseller_id,idempotency_key),
  CONSTRAINT reseller_voucher_batches_reseller_fk
    FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_voucher_batches_pop_fk
    FOREIGN KEY (pop_id) REFERENCES public.pops(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_voucher_batches_account_fk
    FOREIGN KEY (billing_account_id,reseller_id)
    REFERENCES public.reseller_billing_accounts(id,reseller_id) ON DELETE RESTRICT,
  CONSTRAINT reseller_voucher_batches_binding_fk
    FOREIGN KEY (binding_id) REFERENCES public.pop_hotspot_bindings(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_voucher_batches_package_fk
    FOREIGN KEY (package_id) REFERENCES public.pop_hotspot_packages(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_voucher_batches_quantity_check CHECK (quantity BETWEEN 1 AND 500),
  CONSTRAINT reseller_voucher_batches_price_check
    CHECK (
      retail_unit_price >= 0 AND wholesale_unit_price >= 0
      AND wholesale_unit_price <= retail_unit_price
      AND retail_total = retail_unit_price * quantity
      AND wholesale_total = wholesale_unit_price * quantity
      AND margin_total = retail_total - wholesale_total
    ),
  CONSTRAINT reseller_voucher_batches_billing_mode_check CHECK (billing_mode IN ('prepaid','postpaid')),
  CONSTRAINT reseller_voucher_batches_status_check CHECK (status IN ('issued','partially_printed','completed','cancelled')),
  CONSTRAINT reseller_voucher_batches_snapshot_check
    CHECK (length(btrim(router_key)) > 0 AND length(btrim(hotspot_server)) > 0 AND length(btrim(profile_key)) > 0),
  CONSTRAINT reseller_voucher_batches_vlan_check CHECK (vlan_id IS NULL OR vlan_id BETWEEN 1 AND 4094)
);

-- 6) One-to-one association from a reseller batch item to a canonical voucher.
CREATE TABLE IF NOT EXISTS public.reseller_voucher_issuance_items (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  batch_id BIGINT NOT NULL,
  voucher_id BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reseller_voucher_issuance_items_batch_fk
    FOREIGN KEY (batch_id) REFERENCES public.reseller_voucher_batches(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_voucher_issuance_items_voucher_fk
    FOREIGN KEY (voucher_id) REFERENCES public.hotspot_vouchers(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_voucher_issuance_items_voucher_unique UNIQUE (voucher_id),
  CONSTRAINT reseller_voucher_issuance_items_batch_voucher_unique UNIQUE (batch_id,voucher_id)
);

-- 7) Reseller settlement record. Posting a settlement must also write a ledger entry
--    and update the cached receivable projection in one application transaction.
CREATE TABLE IF NOT EXISTS public.reseller_settlements (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  reseller_id INTEGER NOT NULL,
  billing_account_id BIGINT NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BDT',
  payment_method VARCHAR(40),
  external_reference VARCHAR(160),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  received_at TIMESTAMPTZ,
  actor_user_id TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reseller_settlements_reseller_fk
    FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_settlements_account_fk
    FOREIGN KEY (billing_account_id,reseller_id)
    REFERENCES public.reseller_billing_accounts(id,reseller_id) ON DELETE RESTRICT,
  CONSTRAINT reseller_settlements_idempotency_unique UNIQUE (reseller_id,idempotency_key),
  CONSTRAINT reseller_settlements_amount_check CHECK (amount > 0),
  CONSTRAINT reseller_settlements_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT reseller_settlements_status_check CHECK (status IN ('pending','posted','failed','reversed'))
);

-- 8) Append-only reseller financial journal.
CREATE TABLE IF NOT EXISTS public.reseller_ledger_entries (
  id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  reseller_id INTEGER NOT NULL,
  billing_account_id BIGINT NOT NULL,
  account_type VARCHAR(20) NOT NULL,
  entry_type VARCHAR(30) NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'BDT',
  batch_id BIGINT,
  settlement_id BIGINT,
  idempotency_key VARCHAR(160) NOT NULL,
  description TEXT,
  actor_user_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reseller_ledger_entries_reseller_fk
    FOREIGN KEY (reseller_id) REFERENCES public.resellers(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_ledger_entries_account_fk
    FOREIGN KEY (billing_account_id,reseller_id)
    REFERENCES public.reseller_billing_accounts(id,reseller_id) ON DELETE RESTRICT,
  CONSTRAINT reseller_ledger_entries_batch_fk
    FOREIGN KEY (batch_id) REFERENCES public.reseller_voucher_batches(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_ledger_entries_settlement_fk
    FOREIGN KEY (settlement_id) REFERENCES public.reseller_settlements(id) ON DELETE RESTRICT,
  CONSTRAINT reseller_ledger_entries_idempotency_unique UNIQUE (reseller_id,idempotency_key),
  CONSTRAINT reseller_ledger_entries_amount_check CHECK (amount > 0),
  CONSTRAINT reseller_ledger_entries_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT reseller_ledger_entries_account_type_check CHECK (account_type IN ('wallet','receivable')),
  CONSTRAINT reseller_ledger_entries_entry_type_check CHECK (
    entry_type IN ('wallet_debit','wallet_credit','receivable_charge','receivable_payment','correction_debit','correction_credit')
  ),
  CONSTRAINT reseller_ledger_entries_account_entry_check CHECK (
    (account_type='wallet' AND entry_type IN ('wallet_debit','wallet_credit','correction_debit','correction_credit'))
    OR
    (account_type='receivable' AND entry_type IN ('receivable_charge','receivable_payment','correction_debit','correction_credit'))
  ),
  CONSTRAINT reseller_ledger_entries_source_check CHECK (batch_id IS NOT NULL OR settlement_id IS NOT NULL OR entry_type IN ('wallet_credit','correction_debit','correction_credit'))
);

-- 9) Indexes for scoped reads and transaction processing.
CREATE INDEX IF NOT EXISTS idx_pop_hotspot_bindings_status_pop
  ON public.pop_hotspot_bindings(status,pop_id);
CREATE INDEX IF NOT EXISTS idx_pop_hotspot_packages_pop_status
  ON public.pop_hotspot_packages(pop_id,status,display_order,id);
CREATE INDEX IF NOT EXISTS idx_reseller_voucher_batches_owner_created
  ON public.reseller_voucher_batches(reseller_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_voucher_batches_pop_created
  ON public.reseller_voucher_batches(pop_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_voucher_items_batch
  ON public.reseller_voucher_issuance_items(batch_id,id);
CREATE INDEX IF NOT EXISTS idx_reseller_settlements_account_created
  ON public.reseller_settlements(billing_account_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS idx_reseller_ledger_account_created
  ON public.reseller_ledger_entries(billing_account_id,id);
CREATE INDEX IF NOT EXISTS idx_reseller_ledger_reseller_created
  ON public.reseller_ledger_entries(reseller_id,created_at DESC,id DESC);

-- 10) Existing target objects must be complete and have the confirmed FK column types.
--     CREATE TABLE IF NOT EXISTS does not validate a pre-existing partial table.
DO $faz_target_shape_check$
DECLARE
  v_table TEXT;
  v_column TEXT;
  v_expected TEXT;
  v_actual TEXT;
  v_required TEXT[][] := ARRAY[
    ARRAY['pop_hotspot_bindings','pop_id','int4'],
    ARRAY['pop_hotspot_packages','pop_id','int4'],
    ARRAY['reseller_billing_accounts','reseller_id','int4'],
    ARRAY['reseller_voucher_batches','reseller_id','int4'],
    ARRAY['reseller_voucher_batches','pop_id','int4'],
    ARRAY['reseller_voucher_issuance_items','voucher_id','int8'],
    ARRAY['reseller_settlements','reseller_id','int4'],
    ARRAY['reseller_ledger_entries','reseller_id','int4']
  ];
  i INTEGER;
BEGIN
  FOR i IN 1..array_length(v_required,1) LOOP
    v_table := v_required[i][1];
    v_column := v_required[i][2];
    v_expected := v_required[i][3];
    SELECT udt_name INTO v_actual
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name=v_table AND column_name=v_column;
    IF v_actual IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION 'Target shape mismatch: public.%.% expected %, found %',
        v_table,v_column,v_expected,COALESCE(v_actual,'<missing>');
    END IF;
  END LOOP;

  -- Verify NUMERIC(14,2) projection columns exactly.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reseller_billing_accounts'
      AND column_name='wallet_balance' AND data_type='numeric'
      AND numeric_precision=14 AND numeric_scale=2
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='reseller_billing_accounts'
      AND column_name='receivable_balance' AND data_type='numeric'
      AND numeric_precision=14 AND numeric_scale=2
  ) THEN
    RAISE EXCEPTION 'Target shape mismatch: wallet_balance and receivable_balance must be NUMERIC(14,2)';
  END IF;

  -- Confirm every expected FK constraint exists; a same-named but altered
  -- constraint is rejected by comparing its referenced relation and delete action.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.pop_hotspot_bindings'::regclass AND conname='pop_hotspot_bindings_pop_fk' AND contype='f' AND confrelid='public.pops'::regclass AND confdeltype='r')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.pop_hotspot_packages'::regclass AND conname='pop_hotspot_packages_pop_fk' AND contype='f' AND confrelid='public.pops'::regclass AND confdeltype='r')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.reseller_billing_accounts'::regclass AND conname='reseller_billing_accounts_reseller_fk' AND contype='f' AND confrelid='public.resellers'::regclass AND confdeltype='r')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.reseller_voucher_batches'::regclass AND conname='reseller_voucher_batches_reseller_fk' AND contype='f' AND confrelid='public.resellers'::regclass AND confdeltype='r')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.reseller_voucher_batches'::regclass AND conname='reseller_voucher_batches_pop_fk' AND contype='f' AND confrelid='public.pops'::regclass AND confdeltype='r')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.reseller_voucher_issuance_items'::regclass AND conname='reseller_voucher_issuance_items_voucher_fk' AND contype='f' AND confrelid='public.hotspot_vouchers'::regclass AND confdeltype='r')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.reseller_settlements'::regclass AND conname='reseller_settlements_reseller_fk' AND contype='f' AND confrelid='public.resellers'::regclass AND confdeltype='r')
    OR NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.reseller_ledger_entries'::regclass AND conname='reseller_ledger_entries_reseller_fk' AND contype='f' AND confrelid='public.resellers'::regclass AND confdeltype='r')
  THEN
    RAISE EXCEPTION 'Target shape mismatch: one or more required restrictive foreign keys are missing or incompatible';
  END IF;
END
$faz_target_shape_check$;

-- 11) Protect posted ledger history from UPDATE/DELETE. Corrections are new rows.
CREATE OR REPLACE FUNCTION public.faz_reseller_ledger_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $faz_ledger_guard$
BEGIN
  RAISE EXCEPTION 'reseller_ledger_entries is append-only; post a compensating ledger entry instead'
    USING ERRCODE='55000';
END
$faz_ledger_guard$;

DO $faz_ledger_trigger$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.reseller_ledger_entries'::regclass
      AND tgname='trg_reseller_ledger_append_only'
      AND NOT tgisinternal
  ) THEN
    CREATE TRIGGER trg_reseller_ledger_append_only
      BEFORE UPDATE OR DELETE ON public.reseller_ledger_entries
      FOR EACH ROW EXECUTE FUNCTION public.faz_reseller_ledger_reject_mutation();
  END IF;
END
$faz_ledger_trigger$;

COMMIT;

-- Post-run read-only verification (run separately after successful COMMIT):
-- SELECT table_name,column_name,data_type,udt_name,numeric_precision,numeric_scale
-- FROM information_schema.columns
-- WHERE table_schema='public' AND table_name IN (
--  'pop_hotspot_bindings','pop_hotspot_packages','reseller_billing_accounts',
--  'reseller_voucher_batches','reseller_voucher_issuance_items',
--  'reseller_settlements','reseller_ledger_entries'
-- )
-- ORDER BY table_name,ordinal_position;
--
-- SELECT conrelid::regclass AS table_name,conname,confrelid::regclass AS references,
--        confdeltype
-- FROM pg_constraint
-- WHERE connamespace='public'::regnamespace
--   AND conrelid::regclass::text LIKE 'reseller_%'
-- ORDER BY 1,2;