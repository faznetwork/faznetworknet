-- SMTP email notification channel; idempotent for existing deployments.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS email VARCHAR(254);

ALTER TABLE notification_templates
  DROP CONSTRAINT IF EXISTS notification_templates_channel_check;
ALTER TABLE notification_templates
  ADD CONSTRAINT notification_templates_channel_check
  CHECK (channel IN ('whatsapp','sms','telegram','messenger','email'));
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS email_subject TEXT;
ALTER TABLE notification_templates ADD COLUMN IF NOT EXISTS email_body TEXT;

INSERT INTO app_settings(key,value) VALUES
  ('notification_channel_email_enabled','false'),
  ('smtp_host',''),
  ('smtp_port','587'),
  ('smtp_secure','false'),
  ('smtp_username',''),
  ('smtp_password',''),
  ('email_from_name','FAZ NETWORK Billing'),
  ('email_from_address','')
ON CONFLICT(key) DO NOTHING;
