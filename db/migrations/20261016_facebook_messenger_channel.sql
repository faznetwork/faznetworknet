-- Facebook Messenger recipient linking and webhook credentials.
-- Preserve any existing production settings.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS messenger_psid VARCHAR(150);
CREATE INDEX IF NOT EXISTS idx_customers_messenger_psid ON customers(messenger_psid) WHERE messenger_psid IS NOT NULL;

INSERT INTO app_settings(key,value) VALUES
 ('messenger_app_secret',''),
 ('messenger_verify_token','')
ON CONFLICT(key) DO NOTHING;
