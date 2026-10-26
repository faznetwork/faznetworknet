-- Hotspot device binding lifecycle. Router-origin data is stored separately from PPPoE subscribers.
CREATE TABLE IF NOT EXISTS hotspot_ip_bindings (
  id BIGSERIAL PRIMARY KEY,
  mac_address TEXT NOT NULL,
  ip_address INET,
  customer_name TEXT,
  phone TEXT,
  comment TEXT NOT NULL DEFAULT '',
  binding_type TEXT NOT NULL DEFAULT 'bypassed'
    CHECK (binding_type IN ('bypassed', 'regular', 'blocked')),
  package_id TEXT,
  bandwidth_profile TEXT NOT NULL DEFAULT 'unlimited',
  expiry_date TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'disabled'
    CHECK (status IN ('active', 'expired', 'disabled')),
  router_binding_id TEXT,
  last_synced_at TIMESTAMPTZ,
  router_sync_error TEXT,
  expiry_processing_started_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_ip_bindings_active_mac
  ON hotspot_ip_bindings (upper(mac_address)) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_hotspot_ip_bindings_due_expiry
  ON hotspot_ip_bindings (expiry_date, id) WHERE status = 'active' AND expiry_date IS NOT NULL;
ALTER TABLE hotspot_ip_bindings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON TABLE hotspot_ip_bindings FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON TABLE hotspot_ip_bindings FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE hotspot_ip_bindings TO service_role';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE hotspot_ip_bindings_id_seq TO service_role';
  END IF;
END $$;
