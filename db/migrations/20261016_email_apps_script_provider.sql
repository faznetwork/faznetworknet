-- Google Apps Script email provider settings; existing SMTP settings remain available as fallback.
INSERT INTO app_settings(key,value) VALUES
  ('email_provider_mode','apps_script'),
  ('email_apps_script_url',''),
  ('email_apps_script_token','')
ON CONFLICT(key) DO NOTHING;
