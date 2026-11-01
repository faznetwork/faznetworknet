-- FAZ NETWORK: forward-only reseller voucher contract reconciliation
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '90s';
SELECT pg_advisory_xact_lock(hashtext('faznetwork:reseller-voucher-contract-reconcile:20261031'));

DO $preflight$
BEGIN
  IF to_regclass('public.hotspot_vouchers') IS NULL OR to_regclass('public.reseller_voucher_batches') IS NULL OR to_regclass('public.reseller_ledger_entries') IS NULL THEN
    RAISE EXCEPTION 'Required reseller voucher tables are missing; migration aborted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reseller_voucher_batches' AND column_name='idempotency_key') THEN
    RAISE EXCEPTION 'reseller_voucher_batches.idempotency_key is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reseller_voucher_batches' AND column_name='actor_user_id' AND udt_name='int8')
     OR NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reseller_ledger_entries' AND column_name='actor_user_id' AND udt_name='int8') THEN
    RAISE EXCEPTION 'Expected BIGINT actor_user_id on batch and ledger; refusing implicit actor identity conversion';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reseller_voucher_batches WHERE actor_user_id IS NOT NULL AND actor_user_id < 0)
     OR EXISTS (SELECT 1 FROM public.reseller_ledger_entries WHERE actor_user_id IS NOT NULL AND actor_user_id < 0) THEN
    RAISE EXCEPTION 'Negative historical actor_user_id found';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reseller_ledger_entries WHERE amount IS NULL OR amount <= 0 OR reseller_id IS NULL OR account_type IS NULL OR entry_type IS NULL OR idempotency_key IS NULL OR description IS NULL) THEN
    RAISE EXCEPTION 'Existing ledger rows violate required journal fields';
  END IF;
END
$preflight$;

ALTER TABLE public.hotspot_vouchers DROP CONSTRAINT IF EXISTS hotspot_vouchers_subscriber_type_check;
ALTER TABLE public.hotspot_vouchers ADD CONSTRAINT hotspot_vouchers_subscriber_type_check
  CHECK (subscriber_type IN ('direct_subscriber','scratch_voucher','admin_voucher','mfs','legacy','reseller_voucher'));

ALTER TABLE public.reseller_voucher_batches
  ALTER COLUMN idempotency_key TYPE VARCHAR(120) USING idempotency_key::text;

ALTER TABLE public.reseller_voucher_batches
  DROP CONSTRAINT IF EXISTS reseller_voucher_batches_check1,
  DROP CONSTRAINT IF EXISTS reseller_voucher_batches_check2,
  DROP CONSTRAINT IF EXISTS reseller_voucher_batches_check3,
  DROP CONSTRAINT IF EXISTS reseller_voucher_batches_canonical_totals_check;
ALTER TABLE public.reseller_voucher_batches
  ADD CONSTRAINT reseller_voucher_batches_canonical_totals_check
  CHECK (
    retail_total IS NOT NULL AND wholesale_total IS NOT NULL AND margin_total IS NOT NULL
    AND retail_unit_price IS NOT NULL AND wholesale_unit_price IS NOT NULL
    AND quantity IS NOT NULL AND quantity > 0
    AND retail_total = retail_unit_price * quantity
    AND wholesale_total = wholesale_unit_price * quantity
    AND margin_total = retail_total - wholesale_total
  );

ALTER TABLE public.reseller_ledger_entries
  ADD COLUMN IF NOT EXISTS currency CHAR(3) NOT NULL DEFAULT 'BDT';
ALTER TABLE public.reseller_ledger_entries
  ALTER COLUMN account_id DROP NOT NULL,
  ALTER COLUMN direction DROP NOT NULL,
  ALTER COLUMN created_by DROP NOT NULL,
  ALTER COLUMN idempotency_key TYPE VARCHAR(160) USING idempotency_key::text;

ALTER TABLE public.reseller_ledger_entries
  DROP CONSTRAINT IF EXISTS reseller_ledger_entries_check,
  DROP CONSTRAINT IF EXISTS reseller_ledger_entries_check1,
  DROP CONSTRAINT IF EXISTS reseller_ledger_entries_entry_type_check,
  DROP CONSTRAINT IF EXISTS reseller_ledger_entries_currency_check,
  DROP CONSTRAINT IF EXISTS reseller_ledger_entries_account_entry_check,
  DROP CONSTRAINT IF EXISTS reseller_ledger_entries_source_check;

ALTER TABLE public.reseller_ledger_entries
  ADD CONSTRAINT reseller_ledger_entries_entry_type_check
  CHECK (entry_type IN ('wallet_debit','wallet_credit','receivable_charge','receivable_payment','correction_debit','correction_credit','voucher_issuance','wallet_topup','receivable_settlement','adjustment','reversal')),
  ADD CONSTRAINT reseller_ledger_entries_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT reseller_ledger_entries_account_entry_check
  CHECK (
    (account_type='wallet' AND entry_type IN ('wallet_debit','wallet_credit','correction_debit','correction_credit','voucher_issuance','wallet_topup','adjustment','reversal'))
    OR
    (account_type='receivable' AND entry_type IN ('receivable_charge','receivable_payment','correction_debit','correction_credit','receivable_settlement','adjustment','reversal'))
  ),
  ADD CONSTRAINT reseller_ledger_entries_source_check
  CHECK (
    (entry_type IN ('wallet_debit','receivable_charge','voucher_issuance') AND batch_id IS NOT NULL AND settlement_id IS NULL)
    OR
    (entry_type IN ('wallet_credit','receivable_payment','wallet_topup','receivable_settlement') AND settlement_id IS NOT NULL AND batch_id IS NULL)
    OR
    entry_type IN ('correction_debit','correction_credit','adjustment','reversal')
  );

DO $postcondition$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.reseller_ledger_entries'::regclass AND NOT tgisinternal AND tgname IN ('trg_reseller_ledger_no_update','trg_reseller_ledger_append_only')) THEN
    RAISE EXCEPTION 'Ledger append-only trigger missing; migration aborted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reseller_ledger_entries' AND column_name='currency' AND udt_name='bpchar') THEN
    RAISE EXCEPTION 'Ledger currency column postcondition failed';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reseller_ledger_entries' AND column_name IN ('account_id','direction','created_by') AND is_nullable='NO') THEN
    RAISE EXCEPTION 'Legacy ledger columns remain NOT NULL';
  END IF;
END
$postcondition$;
COMMIT;
