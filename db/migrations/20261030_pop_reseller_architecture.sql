-- FAZ NETWORK POP/reseller architecture — Milestone 1
-- Additive, transactional, and safe to re-run. Do not run automatically at application startup.
BEGIN;

-- Keep legacy zone text as the source-of-truth for display/backward compatibility.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS area_zone VARCHAR(150);

CREATE TABLE IF NOT EXISTS resellers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure a previously-created table has the lifecycle fields this migration relies on.
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'inactive';
ALTER TABLE resellers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $faz_reseller_status_check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'resellers'::regclass
      AND conname = 'resellers_status_check'
  ) THEN
    ALTER TABLE resellers ADD CONSTRAINT resellers_status_check
      CHECK (status IN ('active', 'inactive')) NOT VALID;
  END IF;
END;
$faz_reseller_status_check$;

CREATE TABLE IF NOT EXISTS pops (
  id BIGSERIAL PRIMARY KEY,
  reseller_id BIGINT NULL REFERENCES resellers(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  area_zone VARCHAR(150) NOT NULL DEFAULT '',
  commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage'
    CHECK (commission_type IN ('percentage', 'fixed')),
  commission_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00
    CHECK (commission_rate >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'inactive'
    CHECK (status IN ('active', 'inactive')),
  vlan_id INTEGER NULL CHECK (vlan_id IS NULL OR vlan_id BETWEEN 1 AND 4094),
  mikrotik_ip_pool VARCHAR(100) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Upgrade pre-existing POP tables without overwriting operator-managed values.
ALTER TABLE pops ADD COLUMN IF NOT EXISTS reseller_id BIGINT;
ALTER TABLE pops ADD COLUMN IF NOT EXISTS name VARCHAR(100);
ALTER TABLE pops ADD COLUMN IF NOT EXISTS area_zone VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE pops ADD COLUMN IF NOT EXISTS commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage';
ALTER TABLE pops ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE pops ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'inactive';
ALTER TABLE pops ADD COLUMN IF NOT EXISTS vlan_id INTEGER;
ALTER TABLE pops ADD COLUMN IF NOT EXISTS mikrotik_ip_pool VARCHAR(100);
ALTER TABLE pops ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE pops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $faz_pop_relationships$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'pops'::regclass AND conname = 'pops_reseller_id_fkey'
  ) THEN
    ALTER TABLE pops ADD CONSTRAINT pops_reseller_id_fkey
      FOREIGN KEY (reseller_id) REFERENCES resellers(id) ON DELETE SET NULL NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'pops'::regclass AND conname = 'pops_status_check'
  ) THEN
    ALTER TABLE pops ADD CONSTRAINT pops_status_check
      CHECK (status IN ('active', 'inactive')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'pops'::regclass AND conname = 'pops_commission_type_check'
  ) THEN
    ALTER TABLE pops ADD CONSTRAINT pops_commission_type_check
      CHECK (commission_type IN ('percentage', 'fixed')) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'pops'::regclass AND conname = 'pops_commission_rate_check'
  ) THEN
    ALTER TABLE pops ADD CONSTRAINT pops_commission_rate_check
      CHECK (commission_rate >= 0) NOT VALID;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'pops'::regclass AND conname = 'pops_vlan_id_check'
  ) THEN
    ALTER TABLE pops ADD CONSTRAINT pops_vlan_id_check
      CHECK (vlan_id IS NULL OR vlan_id BETWEEN 1 AND 4094) NOT VALID;
  END IF;
END;
$faz_pop_relationships$;

CREATE INDEX IF NOT EXISTS idx_pops_reseller_id ON pops(reseller_id);
CREATE INDEX IF NOT EXISTS idx_pops_status ON pops(status);

-- Abort rather than arbitrarily choose between multiple canonical direct POPs.
DO $faz_pop_preflight$
DECLARE canonical_count BIGINT;
BEGIN
  SELECT COUNT(*) INTO canonical_count
  FROM pops
  WHERE reseller_id IS NULL AND name = 'FAZ Main (Direct)';
  IF canonical_count > 1 THEN
    RAISE EXCEPTION
      'POP migration aborted: % duplicate canonical POP rows named FAZ Main (Direct) with no reseller; reconcile duplicates before retrying',
      canonical_count;
  END IF;
END;
$faz_pop_preflight$;

-- Stable logical identity is (reseller_id IS NULL, name), not a guessed numeric ID.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pops_primary_direct_name
  ON pops(name)
  WHERE reseller_id IS NULL AND name = 'FAZ Main (Direct)';

INSERT INTO pops (name, area_zone, commission_type, commission_rate, status)
VALUES ('FAZ Main (Direct)', 'Central', 'percentage', 0.00, 'active')
ON CONFLICT (name)
  WHERE reseller_id IS NULL AND name = 'FAZ Main (Direct)'
DO NOTHING;

-- Re-enable the canonical row if it exists but was previously soft-deactivated.
-- This changes only the canonical default POP's lifecycle flag; it does not touch customer zones.
UPDATE pops
SET status = 'active',
    updated_at = NOW()
WHERE reseller_id IS NULL
  AND name = 'FAZ Main (Direct)'
  AND status <> 'active';

ALTER TABLE customers ADD COLUMN IF NOT EXISTS pop_id BIGINT;

DO $faz_customer_pop_fk$
DECLARE
  existing_delete_action "char";
BEGIN
  -- Refuse to inherit orphaned references from any prior partial/manual schema.
  IF EXISTS (
    SELECT 1
    FROM customers c
    LEFT JOIN pops p ON p.id = c.pop_id
    WHERE c.pop_id IS NOT NULL AND p.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'POP migration aborted: customers.pop_id contains orphaned references; reconcile them before retrying';
  END IF;

  SELECT confdeltype INTO existing_delete_action
  FROM pg_constraint
  WHERE conrelid = 'customers'::regclass
    AND conname = 'customers_pop_id_fkey';

  -- Customer-to-POP references must be protected from hard deletion.
  -- Soft-deactivate a POP with status='inactive' instead.
  IF existing_delete_action IS NOT NULL AND existing_delete_action <> 'r' THEN
    ALTER TABLE customers DROP CONSTRAINT customers_pop_id_fkey;
    existing_delete_action := NULL;
  END IF;

  IF existing_delete_action IS NULL THEN
    ALTER TABLE customers ADD CONSTRAINT customers_pop_id_fkey
      FOREIGN KEY (pop_id) REFERENCES pops(id) ON DELETE RESTRICT NOT VALID;
  END IF;
END;
$faz_customer_pop_fk$;

CREATE INDEX IF NOT EXISTS idx_customers_pop_id ON customers(pop_id);

DO $faz_pop_backfill$
DECLARE
  primary_pop_id BIGINT;
  unresolved_customers BIGINT;
BEGIN
  SELECT id INTO STRICT primary_pop_id
  FROM pops
  WHERE reseller_id IS NULL AND name = 'FAZ Main (Direct)' AND status = 'active';

  -- Backfill only the new relationship; preserve area_zone and every other customer field.
  UPDATE customers
  SET pop_id = primary_pop_id
  WHERE pop_id IS NULL;

  SELECT COUNT(*) INTO unresolved_customers
  FROM customers
  WHERE pop_id IS NULL;

  IF unresolved_customers <> 0 THEN
    RAISE EXCEPTION
      'POP migration aborted: % customers remain without a POP assignment',
      unresolved_customers;
  END IF;
END;
$faz_pop_backfill$;

COMMIT;
