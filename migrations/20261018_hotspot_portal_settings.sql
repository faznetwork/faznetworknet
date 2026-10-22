CREATE TABLE IF NOT EXISTS hotspot_portal_settings (id SERIAL PRIMARY KEY,display_mode VARCHAR(32) NOT NULL DEFAULT 'default',banner_url VARCHAR(500),custom_html TEXT,notice_text TEXT,brand_title VARCHAR(120) NOT NULL DEFAULT 'FAZ NETWORK',brand_subtitle VARCHAR(255) NOT NULL DEFAULT 'স্বয়ংক্রিয় হাই-স্পিড হটস্পট জোন',helpline_number VARCHAR(32) NOT NULL DEFAULT '01339932887',redirect_url VARCHAR(500),enable_online_payment BOOLEAN NOT NULL DEFAULT true,enable_voucher_pin BOOLEAN NOT NULL DEFAULT true,enable_qr_scan BOOLEAN NOT NULL DEFAULT true,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),CONSTRAINT hotspot_portal_settings_display_mode_check CHECK(display_mode IN ('default','banner','custom_code')));
INSERT INTO hotspot_portal_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('hotspot_portal_settings','id'),GREATEST((SELECT COALESCE(MAX(id),1) FROM hotspot_portal_settings),1));

ALTER TABLE hotspot_portal_settings ADD COLUMN IF NOT EXISTS portal_logo_url VARCHAR(500);
ALTER TABLE hotspot_portal_settings ADD COLUMN IF NOT EXISTS default_user_profile VARCHAR(128) NOT NULL DEFAULT '';
