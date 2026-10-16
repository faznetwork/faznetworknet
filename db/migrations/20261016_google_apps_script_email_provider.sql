-- Add Google Apps Script Web App as the recommended email provider.
-- Preserve any existing SMTP provider selection and credentials.
INSERT INTO app_settings(key,value) VALUES
  ('email_provider_mode','apps_script'),
  ('email_apps_script_url',''),
  ('email_apps_script_token','')
ON CONFLICT(key) DO NOTHING;
