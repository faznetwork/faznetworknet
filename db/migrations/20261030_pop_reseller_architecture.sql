-- FAZ NETWORK normalized POP/reseller architecture. Additive and rerunnable.
BEGIN;
CREATE TABLE IF NOT EXISTS resellers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS pops (
  id SERIAL PRIMARY KEY,
  reseller_id INT REFERENCES resellers(id) ON DELETE SET NULL,
  name VARCHAR(100) NOT NULL,
  area_zone VARCHAR(100) NOT NULL,
  commission_type VARCHAR(20) NOT NULL DEFAULT 'percentage' CHECK (commission_type IN ('percentage','fixed')),
  commission_rate NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK (commission_rate >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  vlan_id INT NULL CHECK (vlan_id IS NULL OR vlan_id BETWEEN 1 AND 4094),
  mikrotik_ip_pool VARCHAR(100) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pops_reseller_id ON pops(reseller_id);
CREATE INDEX IF NOT EXISTS idx_pops_status ON pops(status);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS pop_id INT REFERENCES pops(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_customers_pop_id ON customers(pop_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pops_primary_direct_name ON pops(name)
  WHERE reseller_id IS NULL AND name='FAZ Main (Direct)';
INSERT INTO pops (name,area_zone,commission_type,commission_rate,status)
VALUES ('FAZ Main (Direct)','Central','percentage',0.00,'active')
ON CONFLICT (name) WHERE reseller_id IS NULL AND name='FAZ Main (Direct)' DO NOTHING;
DO $faz_pop_backfill$
DECLARE primary_pop_id INT;
BEGIN
  SELECT id INTO primary_pop_id FROM pops
  WHERE reseller_id IS NULL AND name='FAZ Main (Direct)' ORDER BY id LIMIT 1;
  IF primary_pop_id IS NULL THEN RAISE EXCEPTION 'Default POP FAZ Main (Direct) could not be created or located'; END IF;
  UPDATE customers SET pop_id=primary_pop_id WHERE pop_id IS NULL;
END;
$faz_pop_backfill$;
COMMIT;
