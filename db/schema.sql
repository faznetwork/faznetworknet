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

-- Universal Notification Hub defaults. Existing administrator values are preserved.
INSERT INTO app_settings(key,value) VALUES
 ('sms_provider_preset','custom'),
 ('sms_api_method','POST_JSON'),
 ('sms_http_param_mapping','{"to":"{to}","message":"{message}","token":"{token}","sender_id":"{sender_id}"}'),
 ('sms_device_http_method','POST_JSON'),
 ('sms_device_param_mapping','{"to":"{to}","message":"{message}","token":"{token}"}'),
 ('notification_channel_sms_enabled','true'),
 ('notification_channel_whatsapp_enabled','false'),
 ('notification_channel_email_enabled','false'),
 ('smtp_host',''),
 ('smtp_port','587'),
 ('smtp_secure','false'),
 ('smtp_username',''),
 ('smtp_password',''),
 ('email_from_name','FAZ NETWORK Billing'),
 ('email_from_address',''),
 ('whatsapp_enabled','false'),
 ('sms_event_welcome','true'),
 ('sms_template_welcome','Welcome to FAZ NETWORK, {name}. Your internet account {username} is ready. Helpline: {support_phone}'),
 ('notification_rule_hotspot_payment_sms_enabled','true'),
 ('notification_rule_hotspot_payment_whatsapp_enabled','false'),
 ('notification_rule_hotspot_recharge_sms_enabled','true'),
 ('notification_rule_hotspot_recharge_whatsapp_enabled','false'),
 ('notification_rule_hotspot_renewal_sms_enabled','true'),
 ('notification_rule_hotspot_renewal_whatsapp_enabled','false'),
 ('notification_rule_hotspot_welcome_sms_enabled','true'),
 ('notification_rule_hotspot_welcome_whatsapp_enabled','false'),
 ('notification_rule_hotspot_expiry_warning_sms_enabled','false'),
 ('notification_rule_hotspot_expiry_warning_whatsapp_enabled','false'),
 ('notification_rule_hotspot_expired_sms_enabled','false'),
 ('notification_rule_hotspot_expired_whatsapp_enabled','false'),
 ('notification_rule_pppoe_payment_sms_enabled','true'),
 ('notification_rule_pppoe_payment_whatsapp_enabled','false'),
 ('notification_rule_pppoe_recharge_sms_enabled','false'),
 ('notification_rule_pppoe_recharge_whatsapp_enabled','false'),
 ('notification_rule_pppoe_renewal_sms_enabled','true'),
 ('notification_rule_pppoe_renewal_whatsapp_enabled','false'),
 ('notification_rule_pppoe_welcome_sms_enabled','false'),
 ('notification_rule_pppoe_welcome_whatsapp_enabled','false'),
 ('notification_rule_pppoe_expiry_warning_sms_enabled','true'),
 ('notification_rule_pppoe_expiry_warning_whatsapp_enabled','false'),
 ('notification_rule_pppoe_expired_sms_enabled','true'),
 ('notification_rule_pppoe_expired_whatsapp_enabled','false')
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

-- Untrusted webhook messages are retained for review, outside payment tables
-- used by automatic TrxID verification and provisioning.
CREATE TABLE IF NOT EXISTS payment_webhook_quarantine (
  id BIGSERIAL PRIMARY KEY,
  status VARCHAR(20) NOT NULL DEFAULT 'unmatched' CHECK (status = 'unmatched'),
  rejection_code VARCHAR(80) NOT NULL,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_quarantine_received
  ON payment_webhook_quarantine(received_at DESC);

CREATE TABLE IF NOT EXISTS hotspot_vouchers (
  id BIGSERIAL PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(100) NOT NULL,
  profile VARCHAR(100) NOT NULL,
  validity VARCHAR(50) NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','active','expired')),
  comment VARCHAR(500),
  transaction_id BIGINT REFERENCES transactions(id) ON DELETE SET NULL,
  renewal_stacked BOOLEAN NOT NULL DEFAULT FALSE,
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
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(100);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS claim_flow VARCHAR(20);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS needs_reconciliation BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_transactions_processing_claimed_at
  ON transactions(claimed_at) WHERE status='processing';
CREATE INDEX IF NOT EXISTS idx_transactions_reconciliation
  ON transactions(needs_reconciliation, claimed_at) WHERE needs_reconciliation=true;
CREATE TABLE IF NOT EXISTS payment_reconciliation_audit (
  id BIGSERIAL PRIMARY KEY,
  transaction_id BIGINT NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  flow VARCHAR(20) NOT NULL CHECK (flow IN ('hotspot','pppoe','webhook','recovery')),
  account_identifier VARCHAR(100),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_audit_transaction
  ON payment_reconciliation_audit(transaction_id, created_at DESC);
-- A stale claim is flagged for reconciliation, never automatically released: RouterOS may already have provisioned service.
UPDATE transactions
SET needs_reconciliation=true
WHERE status='processing' AND used=true AND claimed_at < NOW() - INTERVAL '5 minutes'
  AND needs_reconciliation=false;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS phone VARCHAR(40);
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS customer_name VARCHAR(160);
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS note TEXT;
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
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS profile_id VARCHAR(100);
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS mac_address VARCHAR(17);
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS transaction_id BIGINT;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS renewal_stacked BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS pre_expiry_notified BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_pre_expiry_due ON hotspot_vouchers (expires_at, id) WHERE status='active' AND pre_expiry_notified=FALSE;
DO $hotspot_fk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'hotspot_vouchers_transaction_id_fkey') THEN
    ALTER TABLE hotspot_vouchers ADD CONSTRAINT hotspot_vouchers_transaction_id_fkey FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL;
  END IF;
END $hotspot_fk$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_vouchers_transaction_id ON hotspot_vouchers(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS hotspot_voucher_payments (
  transaction_id BIGINT PRIMARY KEY REFERENCES transactions(id) ON DELETE RESTRICT,
  voucher_id BIGINT REFERENCES hotspot_vouchers(id) ON DELETE SET NULL,
  phone VARCHAR(40) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_hotspot_voucher_payments_voucher ON hotspot_voucher_payments(voucher_id, created_at DESC);
-- Backfill historical payment-to-voucher associations using the stable phone key.
INSERT INTO hotspot_voucher_payments(transaction_id,voucher_id,phone,amount,created_at)
SELECT t.id,v.id,COALESCE(NULLIF(v.phone,''),t.matched_username),t.amount,t.created_at
FROM transactions t
JOIN LATERAL (
  SELECT hv.id,hv.phone FROM hotspot_vouchers hv
  WHERE LOWER(BTRIM(COALESCE(hv.phone,''))) = LOWER(BTRIM(COALESCE(t.matched_username,'')))
     OR LOWER(BTRIM(hv.username)) = LOWER(BTRIM(COALESCE(t.matched_username,'')))
  ORDER BY CASE WHEN LOWER(BTRIM(COALESCE(hv.phone,''))) = LOWER(BTRIM(COALESCE(t.matched_username,''))) THEN 0 ELSE 1 END, hv.id DESC
  LIMIT 1
) v ON TRUE
WHERE t.claim_flow IN ('hotspot','manual_hotspot') AND t.status IN ('processed','PAID')
  AND NULLIF(BTRIM(t.matched_username),'') IS NOT NULL
ON CONFLICT(transaction_id) DO NOTHING;
ALTER TABLE hotspot_vouchers DROP CONSTRAINT IF EXISTS hotspot_vouchers_status_check;
ALTER TABLE hotspot_vouchers ADD CONSTRAINT hotspot_vouchers_status_check CHECK (status IN ('pending_claim','unused','active','expired','disabled','assigned','archived'));
-- Permit repeat purchases after expiry while preventing simultaneous live vouchers for one phone.
ALTER TABLE hotspot_vouchers DROP CONSTRAINT IF EXISTS hotspot_vouchers_username_key;
DROP INDEX IF EXISTS uq_hotspot_vouchers_live_username_ci;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_vouchers_live_username_ci ON hotspot_vouchers (LOWER(username)) WHERE status IN ('pending_claim','unused','active');
DROP INDEX IF EXISTS uq_hotspot_vouchers_mac_address_ci;
CREATE UNIQUE INDEX IF NOT EXISTS uq_hotspot_vouchers_active_mac_ci ON hotspot_vouchers (LOWER(mac_address)) WHERE status = 'active' AND mac_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_profile_id ON hotspot_vouchers(profile_id);
CREATE TABLE IF NOT EXISTS hotspot_voucher_sales_archive (
  transaction_id BIGINT PRIMARY KEY,
  channel VARCHAR(40),
  trx_id VARCHAR(150),
  sender_phone VARCHAR(40),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL,
  matched_username VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_hotspot_voucher_sales_archive_created_at ON hotspot_voucher_sales_archive(created_at DESC);
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
ALTER TABLE customers ADD COLUMN IF NOT EXISTS router_mac VARCHAR(32);
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


ALTER TABLE olt_telemetry ADD COLUMN IF NOT EXISTS pppoe_username VARCHAR(160);


-- Dedicated RouterOS connection records for MikroTik Management > Add Device.
-- Separate from network_devices inventory and completely independent of customer/billing tables.
CREATE TABLE IF NOT EXISTS router_devices (
  id BIGSERIAL PRIMARY KEY,
  router_name VARCHAR(120) NOT NULL,
  host VARCHAR(253) NOT NULL,
  api_type VARCHAR(20) NOT NULL CHECK (api_type IN ('native_api','rest_api')),
  api_port INTEGER NOT NULL CHECK (api_port BETWEEN 1 AND 65535),
  username VARCHAR(160) NOT NULL,
  password_encrypted TEXT NOT NULL,
  use_ssl BOOLEAN NOT NULL DEFAULT FALSE,
  timeout_ms INTEGER NOT NULL DEFAULT 8000 CHECK (timeout_ms BETWEEN 1000 AND 30000),
  status VARCHAR(20) NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','auth_failed')),
  last_synced TIMESTAMPTZ,
  board_model VARCHAR(160),
  ros_version VARCHAR(120),
  cpu_load SMALLINT CHECK (cpu_load IS NULL OR cpu_load BETWEEN 0 AND 100),
  identity VARCHAR(160),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_router_devices_status ON router_devices(status);
CREATE INDEX IF NOT EXISTS idx_router_devices_host ON router_devices(lower(host));
CREATE UNIQUE INDEX IF NOT EXISTS uq_router_devices_name ON router_devices(lower(router_name));
CREATE UNIQUE INDEX IF NOT EXISTS uq_router_devices_host_api ON router_devices(lower(host), api_type);


-- Baileys auth credentials and Signal keys must survive ephemeral Render restarts.
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- Custom channel-specific notification templates. Empty/inactive rows do not override defaults.
CREATE TABLE IF NOT EXISTS notification_templates (
  id BIGSERIAL PRIMARY KEY,
  event_key VARCHAR(80) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','sms','email')),
  template_body TEXT NOT NULL,
  email_subject TEXT,
  email_body TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_key, channel)
);
-- Upgrade existing installations as well as creating fresh schemas.
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS email_body TEXT;
DO $faz_email_template_channel$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'notification_templates'::regclass
      AND conname = 'notification_templates_channel_check'
      AND pg_get_constraintdef(oid) NOT LIKE '%email%'
  ) THEN
    ALTER TABLE notification_templates DROP CONSTRAINT notification_templates_channel_check;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'notification_templates'::regclass
      AND conname = 'notification_templates_channel_check'
  ) THEN
    ALTER TABLE notification_templates
      ADD CONSTRAINT notification_templates_channel_check
      CHECK (channel IN ('whatsapp','sms','email'));
  END IF;
END;
$faz_email_template_channel$;
CREATE INDEX IF NOT EXISTS idx_notification_templates_active
  ON notification_templates(event_key, channel) WHERE is_active = TRUE;

-- Durable broadcast jobs and per-recipient delivery records support progress, audit, and restart recovery.
CREATE TABLE IF NOT EXISTS broadcast_logs (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  channel VARCHAR(40) NOT NULL,
  audience VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  total_recipients INTEGER NOT NULL DEFAULT 0 CHECK (total_recipients >= 0),
  success_count INTEGER NOT NULL DEFAULT 0 CHECK (success_count >= 0),
  failed_count INTEGER NOT NULL DEFAULT 0 CHECK (failed_count >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','running','completed','failed','cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  worker_token TEXT,
  worker_lease_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE broadcast_logs ADD COLUMN IF NOT EXISTS worker_token TEXT;
ALTER TABLE broadcast_logs ADD COLUMN IF NOT EXISTS worker_lease_until TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_broadcast_logs_created_at ON broadcast_logs(created_at DESC);

CREATE TABLE IF NOT EXISTS broadcast_recipients (
  id BIGSERIAL PRIMARY KEY,
  broadcast_id BIGINT NOT NULL REFERENCES broadcast_logs(id) ON DELETE CASCADE,
  user_type VARCHAR(20) NOT NULL,
  recipient_name VARCHAR(200),
  username VARCHAR(120),
  phone VARCHAR(24) NOT NULL,
  package_name VARCHAR(160),
  expiry_date VARCHAR(40),
  amount NUMERIC(12,2),
  status VARCHAR(20) NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','sending','sent','failed')),
  results JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(broadcast_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_broadcast_recipients_queue
  ON broadcast_recipients(broadcast_id, status, id);

-- Google Apps Script Web App is the recommended email provider; SMTP remains available.
INSERT INTO app_settings(key,value) VALUES
 ('email_provider_mode','apps_script'),
 ('email_apps_script_url',''),
 ('email_apps_script_token','')
ON CONFLICT(key) DO NOTHING;

ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS mac_lock BOOLEAN NOT NULL DEFAULT TRUE;
-- Keep deployed Hotspot voucher identity columns compatible with MACs, synthetic usernames, and customer names.
ALTER TABLE hotspot_vouchers
  ALTER COLUMN username TYPE VARCHAR(160),
  ALTER COLUMN password TYPE VARCHAR(160),
  ALTER COLUMN mac_address TYPE VARCHAR(32),
  ALTER COLUMN status TYPE VARCHAR(32),
  ALTER COLUMN cleanup_status TYPE VARCHAR(32);
DO $faz_hotspot_voucher_customer_name_length$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'hotspot_vouchers'
      AND column_name = 'customer_name'
  ) THEN
    ALTER TABLE hotspot_vouchers ALTER COLUMN customer_name TYPE VARCHAR(200);
  END IF;
END;
$faz_hotspot_voucher_customer_name_length$;


-- Captive portal branding and login-method settings.
CREATE TABLE IF NOT EXISTS hotspot_portal_settings (id SERIAL PRIMARY KEY,display_mode VARCHAR(32) NOT NULL DEFAULT 'default',banner_url VARCHAR(500),custom_html TEXT,notice_text TEXT,brand_title VARCHAR(120) NOT NULL DEFAULT 'FAZ NETWORK',brand_subtitle VARCHAR(255) NOT NULL DEFAULT 'স্বয়ংক্রিয় হাই-স্পিড হটস্পট জোন',helpline_number VARCHAR(32) NOT NULL DEFAULT '01339932887',redirect_url VARCHAR(500),enable_online_payment BOOLEAN NOT NULL DEFAULT true,enable_voucher_pin BOOLEAN NOT NULL DEFAULT true,enable_qr_scan BOOLEAN NOT NULL DEFAULT true,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT hotspot_portal_settings_display_mode_check CHECK(display_mode IN ('default','banner','custom_code')));
ALTER TABLE hotspot_portal_settings ADD COLUMN IF NOT EXISTS portal_logo_url VARCHAR(500);
ALTER TABLE hotspot_portal_settings ADD COLUMN IF NOT EXISTS default_user_profile VARCHAR(128) NOT NULL DEFAULT '';
INSERT INTO hotspot_portal_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('hotspot_portal_settings','id'),GREATEST((SELECT COALESCE(MAX(id),1) FROM hotspot_portal_settings),1));


-- Hotspot sale-origin audit metadata. Historical sales stay on transactions even when
-- an expired subscriber/voucher row is hard-deleted after successful router cleanup.
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sale_type VARCHAR(24);
UPDATE transactions
SET sale_type = CASE
  WHEN claim_flow IN ('hotspot','manual_hotspot') THEN 'online_mfs'
  WHEN channel = 'cash' THEN 'scratch_card'
  WHEN claim_flow = 'pppoe' THEN 'online_mfs'
  ELSE 'other'
END
WHERE sale_type IS NULL OR BTRIM(sale_type) = '';
ALTER TABLE transactions ALTER COLUMN sale_type SET DEFAULT 'other';
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_sale_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_sale_type_check
  CHECK (sale_type IN ('online_mfs','scratch_card','manual','other'));
CREATE INDEX IF NOT EXISTS idx_transactions_sales_type_created
  ON transactions(sale_type, created_at DESC) WHERE status IN ('processed','PAID');

ALTER TABLE hotspot_voucher_payments ADD COLUMN IF NOT EXISTS profile VARCHAR(100);
ALTER TABLE hotspot_voucher_payments ADD COLUMN IF NOT EXISTS sale_type VARCHAR(24);
UPDATE hotspot_voucher_payments hp
SET profile = COALESCE(hp.profile, (SELECT v.profile FROM hotspot_vouchers v WHERE v.id=hp.voucher_id)),
    sale_type = COALESCE(hp.sale_type, (SELECT t.sale_type FROM transactions t WHERE t.id=hp.transaction_id), 'other')
WHERE hp.profile IS NULL OR hp.sale_type IS NULL;
UPDATE hotspot_voucher_payments SET sale_type='other' WHERE sale_type IS NULL;
ALTER TABLE hotspot_voucher_payments ALTER COLUMN sale_type SET DEFAULT 'other';
ALTER TABLE hotspot_voucher_payments DROP CONSTRAINT IF EXISTS hotspot_voucher_payments_sale_type_check;
ALTER TABLE hotspot_voucher_payments ADD CONSTRAINT hotspot_voucher_payments_sale_type_check
  CHECK (sale_type IN ('online_mfs','scratch_card','manual','other'));
CREATE INDEX IF NOT EXISTS idx_hotspot_voucher_payments_sales_type_created
  ON hotspot_voucher_payments(sale_type, created_at DESC);


-- Explicitly distinguish admin-created direct subscribers from legacy/scratch vouchers.
-- Existing rows remain 'legacy' to avoid falsely reclassifying historical voucher inventory.
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS subscriber_type VARCHAR(24) NOT NULL DEFAULT 'legacy';
ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS batch_id VARCHAR(36);
CREATE INDEX IF NOT EXISTS idx_hotspot_vouchers_batch_status ON hotspot_vouchers(batch_id,status) WHERE batch_id IS NOT NULL;
-- Backfill pre-existing unused scratch cards into stable legacy groups so they can be reprinted.
UPDATE hotspot_vouchers
SET batch_id = (
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),1,8) || '-' ||
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),9,4) || '-' ||
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),13,4) || '-' ||
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),17,4) || '-' ||
  substr(md5(date_trunc('minute',created_at)::text || '|' || COALESCE(profile,'') || '|' || COALESCE(price::text,'0')),21,12)
)
WHERE subscriber_type='scratch_voucher' AND status='unused' AND batch_id IS NULL;

ALTER TABLE hotspot_vouchers ADD COLUMN IF NOT EXISTS activation_type VARCHAR(24) NOT NULL DEFAULT 'legacy';
ALTER TABLE hotspot_vouchers DROP CONSTRAINT IF EXISTS hotspot_vouchers_subscriber_type_check;
ALTER TABLE hotspot_vouchers ADD CONSTRAINT hotspot_vouchers_subscriber_type_check
  CHECK (subscriber_type IN ('direct_subscriber','scratch_voucher','legacy'));
ALTER TABLE hotspot_vouchers DROP CONSTRAINT IF EXISTS hotspot_vouchers_activation_type_check;
ALTER TABLE hotspot_vouchers ADD CONSTRAINT hotspot_vouchers_activation_type_check
  CHECK (activation_type IN ('preassigned','first_login','legacy'));
CREATE INDEX IF NOT EXISTS idx_hotspot_direct_subscriber_phone
  ON hotspot_vouchers (REGEXP_REPLACE(COALESCE(phone,''),'[^0-9]','','g'), id DESC)
  WHERE subscriber_type='direct_subscriber' AND status IN ('pending_claim','unused','active','expired');
CREATE INDEX IF NOT EXISTS idx_hotspot_direct_subscriber_mac
  ON hotspot_vouchers (LOWER(mac_address), id DESC)
  WHERE subscriber_type='direct_subscriber' AND mac_address IS NOT NULL;


-- Short-lived server-authoritative sessions for public PPPoE bill payments.
CREATE TABLE IF NOT EXISTS public_payment_sessions (
  session_id VARCHAR(128) PRIMARY KEY,
  username VARCHAR(100) NOT NULL,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('bkash','nagad','rocket','upay')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_public_payment_sessions_expires_at
  ON public_payment_sessions(expires_at);


-- Durable audit trail for outbound SMS attempts. Gateway acceptance is not handset delivery confirmation.
CREATE TABLE IF NOT EXISTS sms_delivery_logs (
  id BIGSERIAL PRIMARY KEY,
  recipient_phone VARCHAR(40) NOT NULL DEFAULT '',
  recipient_address VARCHAR(254),
  channel VARCHAR(20) NOT NULL DEFAULT 'sms' CHECK (channel IN ('sms','whatsapp','email')),
  message TEXT NOT NULL,
  event_key VARCHAR(80) NOT NULL DEFAULT 'manual',
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent','failed','skipped')),
  gateway_mode VARCHAR(40),
  http_method VARCHAR(20),
  http_status INTEGER,
  error TEXT,
  provider_message_id VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE sms_delivery_logs ADD COLUMN IF NOT EXISTS recipient_address VARCHAR(254);
ALTER TABLE sms_delivery_logs ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'sms';
ALTER TABLE sms_delivery_logs ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);
UPDATE sms_delivery_logs SET recipient_address = recipient_phone WHERE recipient_address IS NULL;
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_channel_created ON sms_delivery_logs(channel, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_created_at ON sms_delivery_logs(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_phone_created ON sms_delivery_logs(recipient_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_status_created ON sms_delivery_logs(status, created_at DESC);
