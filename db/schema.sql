CREATE TABLE IF NOT EXISTS pppoe_profiles (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  rate_limit TEXT,
  local_address TEXT,
  remote_address TEXT,
  session_timeout TEXT,
  idle_timeout TEXT,
  only_one BOOLEAN DEFAULT FALSE,
  change_tcp_mss TEXT DEFAULT 'default',
  comment TEXT,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  router_id TEXT,
  raw_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RouterOS change-tcp-mss is a tri-state string (yes/no/default), not a boolean.
-- Convert legacy cache columns safely so a single profile cannot abort the full PPPoE sync.
DO $faz_schema$
DECLARE current_type TEXT;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_schema = current_schema()
    AND table_name = 'pppoe_profiles'
    AND column_name = 'change_tcp_mss';

  IF current_type = 'boolean' THEN
    ALTER TABLE pppoe_profiles
      ALTER COLUMN change_tcp_mss TYPE TEXT
      USING CASE WHEN change_tcp_mss THEN 'yes' ELSE 'default' END;
  END IF;
END;
$faz_schema$;
ALTER TABLE pppoe_profiles ALTER COLUMN change_tcp_mss SET DEFAULT 'default';


-- Latest push-based PPPoE active-session snapshot from MikroTik.
-- This is operational telemetry only; it does not alter canonical customer or billing records.
CREATE TABLE IF NOT EXISTS pppoe_live_sessions (
  username VARCHAR(100) PRIMARY KEY,
  address VARCHAR(64),
  uptime VARCHAR(80),
  service VARCHAR(40) NOT NULL DEFAULT 'pppoe',
  bytes_in BIGINT NOT NULL DEFAULT 0 CHECK (bytes_in >= 0),
  bytes_out BIGINT NOT NULL DEFAULT 0 CHECK (bytes_out >= 0),
  caller_id VARCHAR(100),
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pppoe_live_sessions_received_at ON pppoe_live_sessions(received_at DESC);

CREATE TABLE IF NOT EXISTS pppoe_users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT,
  profile TEXT,
  service TEXT DEFAULT 'pppoe',
  caller_id TEXT,
  disabled BOOLEAN NOT NULL DEFAULT FALSE,
  comment TEXT,
  phone TEXT,
  local_address TEXT,
  remote_address TEXT,
  router_id TEXT,
  raw_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active',
  expiry_date DATE
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone VARCHAR(40) NOT NULL UNIQUE,
  connection_date DATE NOT NULL,
  username VARCHAR(100) NOT NULL UNIQUE,
  password TEXT NOT NULL,
  package_name VARCHAR(100) NOT NULL,
  profile VARCHAR(100) NOT NULL,
  monthly_bill NUMERIC(12,2) NOT NULL CHECK (monthly_bill >= 0),
  nid VARCHAR(100),
  installation_address TEXT,
  fiber_box VARCHAR(150),
  onu_mac VARCHAR(100),
  remarks TEXT,
  provisioning_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (provisioning_status IN ('pending','provisioned','failed')),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','left')),
  router_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Customer contact channels are optional and independent from sender configuration.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(254);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS whatsapp_phone VARCHAR(40);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telegram_link VARCHAR(255);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS facebook_link VARCHAR(500);

-- General application settings (non-customer configuration).
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(150) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure dynamic MFS and webhook configuration keys exist without overwriting production values.
INSERT INTO app_settings(key,value) VALUES
 ('mfs_bkash_number',''),
 ('mfs_nagad_number',''),
 ('mfs_rocket_number',''),
 ('mfs_upay_number',''),
 ('personal_payment_webhook_secret',''),
 ('personal_payment_webhook_enabled','false')
ON CONFLICT(key) DO NOTHING;

-- Idempotency ledger for outbound SMS events; contains no payment transaction data.
CREATE TABLE IF NOT EXISTS sms_notification_log (
  event_key TEXT PRIMARY KEY,
  event_type VARCHAR(40) NOT NULL,
  username VARCHAR(100) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('bkash','nagad','rocket','upay')),
  trx_id VARCHAR(100) NOT NULL UNIQUE,
  sender_phone VARCHAR(40),
  amount NUMERIC(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('processed','unmatched','duplicate')),
  matched_username VARCHAR(100),
  raw_sms TEXT,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotspot_vouchers (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL,
  profile VARCHAR(100) NOT NULL,
  validity VARCHAR(50) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','active','expired')),
  comment VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE pppoe_profiles ADD COLUMN IF NOT EXISTS price NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE pppoe_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE pppoe_users ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE pppoe_users ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ;
ALTER TABLE pppoe_users ADD COLUMN IF NOT EXISTS paid_until DATE;
ALTER TABLE pppoe_users ADD COLUMN IF NOT EXISTS expiry_date DATE;
-- Expiration is a calendar date in Bangladesh; migrate legacy timestamptz values once.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'pppoe_users'
      AND column_name = 'expiry_date'
      AND data_type = 'timestamp with time zone'
  ) THEN
    ALTER TABLE pppoe_users
      ALTER COLUMN expiry_date TYPE DATE
      USING (expiry_date AT TIME ZONE 'UTC')::date;
  END IF;
END $$;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS used BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS server VARCHAR(100) DEFAULT 'all';
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS time_limit VARCHAR(50);
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS data_limit VARCHAR(50);
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS first_login_at TIMESTAMPTZ;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS cleanup_status VARCHAR(20) NOT NULL DEFAULT 'not_required';
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS cleanup_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS cleanup_error TEXT;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS router_removed_at TIMESTAMPTZ;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_cleanup ON hotspot_vouchers(status,cleanup_status,id);

CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_created_at ON hotspot_vouchers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_phone ON hotspot_vouchers(phone);


CREATE INDEX IF NOT EXISTS idx_pppoe_users_profile ON pppoe_users(profile);
CREATE INDEX IF NOT EXISTS idx_pppoe_users_disabled ON pppoe_users(disabled);
CREATE INDEX IF NOT EXISTS idx_pppoe_users_synced_at ON pppoe_users(synced_at);
CREATE INDEX IF NOT EXISTS idx_pppoe_profiles_synced_at ON pppoe_profiles(synced_at);
CREATE INDEX IF NOT EXISTS idx_transactions_channel_created ON transactions(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_used ON transactions(used);

CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_profile ON customers(profile);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);

-- Customer networking fields: keep legacy/customer-management queries schema-safe.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS remote_address VARCHAR(50);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS ip_pool VARCHAR(100);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS expiration_date DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'unpaid';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS paid_until DATE;
CREATE INDEX IF NOT EXISTS idx_customers_expiration_date ON customers(expiration_date);

CREATE TABLE IF NOT EXISTS ip_pools (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  ranges TEXT NOT NULL,
  subnet TEXT,
  local_address TEXT,
  device_name TEXT NOT NULL,
  next_pool TEXT NOT NULL DEFAULT 'none',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (device_name, name)
);

CREATE INDEX IF NOT EXISTS idx_ip_pools_device_name ON ip_pools(device_name);

CREATE TABLE IF NOT EXISTS packages (id BIGSERIAL PRIMARY KEY,plan_name VARCHAR(120) NOT NULL UNIQUE,pool_name VARCHAR(100) NOT NULL,profile_name VARCHAR(120) NOT NULL,rate_limit VARCHAR(100),price NUMERIC(12,2) NOT NULL CHECK(price>0),duration_months INTEGER NOT NULL DEFAULT 1 CHECK(duration_months>=1),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE INDEX IF NOT EXISTS idx_packages_pool_name ON packages(pool_name);
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_status_check;
ALTER TABLE customers ADD CONSTRAINT customers_status_check CHECK(status IN ('active','inactive','left','expired'));

ALTER TABLE packages ALTER COLUMN rate_limit DROP NOT NULL;

-- Plan & Packages: full MikroTik PPP profile fields and safe sync support.
ALTER TABLE packages ADD COLUMN IF NOT EXISTS local_address VARCHAR(255);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS remote_address VARCHAR(255);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS dns_server VARCHAR(255);
ALTER TABLE packages ADD COLUMN IF NOT EXISTS change_tcp_mss VARCHAR(20) NOT NULL DEFAULT 'default';
ALTER TABLE packages ALTER COLUMN pool_name DROP NOT NULL;
ALTER TABLE packages DROP CONSTRAINT IF EXISTS packages_price_check;
ALTER TABLE packages ADD CONSTRAINT packages_price_check CHECK(price >= 0);
ALTER TABLE packages ALTER COLUMN rate_limit DROP NOT NULL;

-- 360-degree customer management hub fields.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS alternative_phone VARCHAR(40);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS olt_pon_port VARCHAR(120);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS distribution_box VARCHAR(150);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS onu_serial VARCHAR(150);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS fiber_drop_core VARCHAR(80);
CREATE INDEX IF NOT EXISTS idx_transactions_matched_username_created ON transactions(matched_username, created_at DESC);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS area_zone VARCHAR(150);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS last_disconnect_reason VARCHAR(255);
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_status_check;
ALTER TABLE customers ADD CONSTRAINT customers_status_check CHECK(status IN ('active','inactive','left','expired','suspended'));
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_channel_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_channel_check CHECK(channel IN ('bkash','nagad','rocket','upay','cash'));
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
-- Hotspot verification claims a transaction before calling RouterOS; keep this state durable on ambiguous failures.
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check CHECK(status IN ('processed','unmatched','duplicate','PAID','processing'));
CREATE INDEX IF NOT EXISTS idx_customers_area_zone ON customers(area_zone);


-- Enterprise customer 360 audit trail.
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  admin_id VARCHAR(100) NOT NULL DEFAULT 'admin',
  action VARCHAR(50) NOT NULL,
  details TEXT NOT NULL,
  ip_address VARCHAR(50),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_customer ON audit_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_customer_created ON audit_logs(customer_id, created_at DESC);

-- Prevent deleted customer usernames from being resurrected by RouterOS auto-sync.
CREATE TABLE IF NOT EXISTS customer_deletion_tombstones (
  username VARCHAR(100) PRIMARY KEY,
  customer_id BIGINT,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_customer_deletion_tombstones_deleted_at
  ON customer_deletion_tombstones(deleted_at DESC);


-- Customer billing-cycle and migration-safe manual expiry override.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_duration_days INTEGER;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS billing_expiry_override BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_billing_cycle_check;
ALTER TABLE customers ADD CONSTRAINT customers_billing_cycle_check CHECK (billing_cycle IN ('monthly','15_days','30_days','custom_days'));
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_billing_duration_days_check;
ALTER TABLE customers ADD CONSTRAINT customers_billing_duration_days_check CHECK (billing_duration_days IS NULL OR billing_duration_days BETWEEN 1 AND 3650);


-- Customer usage records: daily deltas collected from MikroTik PPPoE interface counters.
CREATE TABLE IF NOT EXISTS customer_usage_daily (
  customer_id BIGINT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL,
  download_bytes BIGINT NOT NULL DEFAULT 0 CHECK (download_bytes >= 0),
  upload_bytes BIGINT NOT NULL DEFAULT 0 CHECK (upload_bytes >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (customer_id, usage_date)
);
CREATE INDEX IF NOT EXISTS idx_customer_usage_daily_date ON customer_usage_daily(usage_date DESC);
CREATE TABLE IF NOT EXISTS customer_usage_counters (
  customer_id BIGINT PRIMARY KEY REFERENCES customers(id) ON DELETE CASCADE,
  username VARCHAR(100) NOT NULL,
  interface_name VARCHAR(150),
  download_bytes BIGINT NOT NULL DEFAULT 0,
  upload_bytes BIGINT NOT NULL DEFAULT 0,
  session_id VARCHAR(80),
  sampled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Reporting suite: expense tracking.
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(160) NOT NULL,
  category VARCHAR(80) NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  date DATE NOT NULL,
  notes TEXT,
  created_by VARCHAR(100) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category_date ON expenses(category,date DESC);


-- HR records are isolated from customer subscriptions, billing, and payment ledgers.
CREATE TABLE IF NOT EXISTS hr_departments (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_by VARCHAR(100) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_departments_name_ci ON hr_departments (LOWER(name));
CREATE INDEX IF NOT EXISTS idx_hr_departments_status_name ON hr_departments(status, name);

CREATE TABLE IF NOT EXISTS hr_employees (
  id BIGSERIAL PRIMARY KEY,
  employee_code VARCHAR(40),
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(40),
  email VARCHAR(254),
  department_id BIGINT REFERENCES hr_departments(id) ON DELETE SET NULL,
  designation VARCHAR(120),
  joining_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes VARCHAR(2000),
  created_by VARCHAR(100) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_hr_employees_code ON hr_employees (LOWER(employee_code)) WHERE employee_code IS NOT NULL AND employee_code <> '';
CREATE INDEX IF NOT EXISTS idx_hr_employees_department_status ON hr_employees(department_id,status);
CREATE INDEX IF NOT EXISTS idx_hr_employees_created_at ON hr_employees(created_at DESC);

-- Isolated staff/admin identities for role-based access; does not modify customer or billing tables.
CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(60) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash TEXT NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin','admin','staff')),
  is_first_login BOOLEAN NOT NULL DEFAULT TRUE,
  otp_code_hash CHAR(64),
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0 CHECK (otp_attempts BETWEEN 0 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_by VARCHAR(100) NOT NULL DEFAULT 'admin',
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_users_username_ci ON admin_users (lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_users_email_ci ON admin_users (lower(email));
CREATE INDEX IF NOT EXISTS idx_admin_users_role_status ON admin_users(role,status);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  actor_username VARCHAR(100) NOT NULL,
  actor_role VARCHAR(20) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created ON admin_audit_logs(created_at DESC);



-- Support ticket assignments are separate from customer and billing data.
CREATE TABLE IF NOT EXISTS support_tickets (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(40) NOT NULL DEFAULT 'general' CHECK (category IN ('general','software','website')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  priority VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  customer_username VARCHAR(100),
  assigned_to_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
  created_by VARCHAR(100) NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Safe upgrade for databases where support_tickets already existed before category-based views.
ALTER TABLE support_tickets ADD COLUMN IF NOT EXISTS category VARCHAR(40) NOT NULL DEFAULT 'general' CHECK (category IN ('general','software','website'));
CREATE INDEX IF NOT EXISTS idx_support_tickets_category_status ON support_tickets(category,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_status ON support_tickets(assigned_to_user_id,status,created_at DESC);


-- Email invitations are separate from accounts until OTP verification and password setup succeed.
CREATE TABLE IF NOT EXISTS admin_invitations (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(60) NOT NULL,
  email VARCHAR(254) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('super_admin','admin','staff')),
  target_user_id BIGINT REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash CHAR(64) UNIQUE,
  otp_code_hash CHAR(64),
  otp_expires_at TIMESTAMPTZ,
  otp_attempts INTEGER NOT NULL DEFAULT 0 CHECK (otp_attempts BETWEEN 0 AND 5),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','cancelled','expired','failed')),
  created_by VARCHAR(100) NOT NULL DEFAULT 'owner',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_status_created ON admin_invitations(status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_invitations_pending_username_ci ON admin_invitations(lower(username)) WHERE status='pending';
CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_invitations_pending_email_ci ON admin_invitations(lower(email)) WHERE status='pending';


-- Extensible inventory for network infrastructure. Credentials are intentionally not stored here.
CREATE TABLE IF NOT EXISTS network_devices (
  id BIGSERIAL PRIMARY KEY,
  device_type VARCHAR(24) NOT NULL CHECK (device_type IN ('mikrotik','olt','onu','ont','access_point','cpe','other')),
  name VARCHAR(120) NOT NULL,
  vendor VARCHAR(120),
  model VARCHAR(120),
  management_ip INET,
  mac_address MACADDR,
  serial_number VARCHAR(160),
  location VARCHAR(240),
  parent_device_id BIGINT REFERENCES network_devices(id) ON DELETE SET NULL,
  notes TEXT,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_network_devices_type_name ON network_devices(device_type, lower(name));
CREATE INDEX IF NOT EXISTS idx_network_devices_management_ip ON network_devices(management_ip);


-- Optional OLT management endpoint credentials; passwords are encrypted by the application.
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS management_port INTEGER CHECK (management_port IS NULL OR management_port BETWEEN 1 AND 65535);
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS management_username VARCHAR(160);
ALTER TABLE network_devices ADD COLUMN IF NOT EXISTS encrypted_management_password TEXT;


-- Universal network mapping foundation: append-only observations and explicit relationships.
-- Additive only: existing customer, billing, and device records are not rewritten.
CREATE TABLE IF NOT EXISTS network_discovery_sources (
  id BIGSERIAL PRIMARY KEY,
  device_id BIGINT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
  source_key VARCHAR(120) NOT NULL,
  protocol VARCHAR(40) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_attempt_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_status VARCHAR(24) NOT NULL DEFAULT 'not_configured'
    CHECK (last_status IN ('not_configured','pending','connected','partial','failed','disabled')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(device_id, source_key)
);
CREATE INDEX IF NOT EXISTS idx_network_discovery_sources_enabled
  ON network_discovery_sources(enabled, protocol);

CREATE TABLE IF NOT EXISTS network_discovery_runs (
  id BIGSERIAL PRIMARY KEY,
  source_id BIGINT REFERENCES network_discovery_sources(id) ON DELETE SET NULL,
  device_id BIGINT REFERENCES network_devices(id) ON DELETE SET NULL,
  run_type VARCHAR(40) NOT NULL DEFAULT 'scheduled',
  status VARCHAR(24) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','succeeded','partial','failed','cancelled')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  discovered_count INTEGER NOT NULL DEFAULT 0 CHECK (discovered_count >= 0),
  matched_count INTEGER NOT NULL DEFAULT 0 CHECK (matched_count >= 0),
  unmatched_count INTEGER NOT NULL DEFAULT 0 CHECK (unmatched_count >= 0),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_network_discovery_runs_device_started
  ON network_discovery_runs(device_id, started_at DESC);

-- Observations preserve their source and evidence; ambiguous identities remain unmatched.
CREATE TABLE IF NOT EXISTS network_observations (
  id BIGSERIAL PRIMARY KEY,
  discovery_run_id BIGINT REFERENCES network_discovery_runs(id) ON DELETE SET NULL,
  source_device_id BIGINT REFERENCES network_devices(id) ON DELETE SET NULL,
  customer_id BIGINT REFERENCES customers(id) ON DELETE SET NULL,
  observation_type VARCHAR(48) NOT NULL,
  identity_type VARCHAR(48),
  identity_value VARCHAR(255),
  observed_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  match_status VARCHAR(24) NOT NULL DEFAULT 'unmatched'
    CHECK (match_status IN ('matched','unmatched','ambiguous','unverified')),
  match_confidence NUMERIC(5,4) CHECK (match_confidence IS NULL OR (match_confidence >= 0 AND match_confidence <= 1)),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_network_observations_customer_recent
  ON network_observations(customer_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_observations_identity_recent
  ON network_observations(identity_type, lower(identity_value), observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_network_observations_unmatched_recent
  ON network_observations(match_status, observed_at DESC);

-- Explicit topology edges allow ONU->PON->OLT and router/session links without conflating MAC types.
CREATE TABLE IF NOT EXISTS network_topology_links (
  id BIGSERIAL PRIMARY KEY,
  from_device_id BIGINT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
  to_device_id BIGINT NOT NULL REFERENCES network_devices(id) ON DELETE CASCADE,
  relationship VARCHAR(48) NOT NULL,
  source_observation_id BIGINT REFERENCES network_observations(id) ON DELETE SET NULL,
  match_status VARCHAR(24) NOT NULL DEFAULT 'unverified'
    CHECK (match_status IN ('verified','unverified','stale','disputed')),
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(from_device_id, to_device_id, relationship)
);
CREATE INDEX IF NOT EXISTS idx_network_topology_links_from ON network_topology_links(from_device_id);
CREATE INDEX IF NOT EXISTS idx_network_topology_links_to ON network_topology_links(to_device_id);



-- Automated ONU optical telemetry cache. Values are written only by a verified OLT collector.
-- NULL means the OLT has not supplied a valid reading; no manual input is used.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS onu_rx_power_dbm NUMERIC(6,2)
  CHECK (onu_rx_power_dbm IS NULL OR (onu_rx_power_dbm >= -50 AND onu_rx_power_dbm <= 10));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS onu_rx_power_observed_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS onu_rx_power_source_device_id BIGINT
  REFERENCES network_devices(id) ON DELETE SET NULL;

-- Push-based local OLT collector telemetry cache.
CREATE TABLE IF NOT EXISTS olt_telemetry (
  id BIGSERIAL PRIMARY KEY,
  olt_id VARCHAR(160) NOT NULL,
  onu_mac MACADDR,
  onu_id VARCHAR(160) NOT NULL,
  pon_port VARCHAR(100),
  status VARCHAR(20) NOT NULL CHECK (status IN ('online','offline','los','unknown')),
  rx_power_dbm NUMERIC(6,2) CHECK (rx_power_dbm IS NULL OR (rx_power_dbm >= -50 AND rx_power_dbm <= 10)),
  tx_power_dbm NUMERIC(6,2) CHECK (tx_power_dbm IS NULL OR (tx_power_dbm >= -50 AND tx_power_dbm <= 20)),
  observed_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_agent VARCHAR(160),
  raw JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (olt_id, onu_id)
);
CREATE INDEX IF NOT EXISTS idx_olt_telemetry_mac ON olt_telemetry(onu_mac);
CREATE INDEX IF NOT EXISTS idx_olt_telemetry_seen ON olt_telemetry(received_at DESC);

ALTER TABLE olt_telemetry ADD COLUMN IF NOT EXISTS pppoe_username VARCHAR(160);
