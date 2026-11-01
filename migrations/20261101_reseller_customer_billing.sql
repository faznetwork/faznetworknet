BEGIN;

ALTER TABLE public.reseller_ledger_entries
  ADD COLUMN IF NOT EXISTS customer_id BIGINT;

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.reseller_ledger_entries'::regclass
      AND conname='reseller_ledger_entries_customer_fk'
  ) THEN
    ALTER TABLE public.reseller_ledger_entries
      ADD CONSTRAINT reseller_ledger_entries_customer_fk
      FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS idx_reseller_ledger_entries_customer
  ON public.reseller_ledger_entries(customer_id,id DESC)
  WHERE customer_id IS NOT NULL;

ALTER TABLE public.reseller_ledger_entries
  DROP CONSTRAINT IF EXISTS reseller_ledger_entries_source_check;

ALTER TABLE public.reseller_ledger_entries
  ADD CONSTRAINT reseller_ledger_entries_source_check
  CHECK (
    (entry_type IN ('wallet_debit','receivable_charge') AND settlement_id IS NULL AND
      ((batch_id IS NOT NULL AND customer_id IS NULL) OR
       (batch_id IS NULL AND customer_id IS NOT NULL)))
    OR
    (entry_type='voucher_issuance' AND batch_id IS NOT NULL AND settlement_id IS NULL AND customer_id IS NULL)
    OR
    (entry_type IN ('wallet_credit','receivable_payment','wallet_topup','receivable_settlement')
      AND settlement_id IS NOT NULL AND batch_id IS NULL AND customer_id IS NULL)
    OR
    (entry_type IN ('correction_debit','correction_credit','adjustment','reversal') AND customer_id IS NULL)
  );

COMMIT;
