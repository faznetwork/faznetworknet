-- Decommission Telegram and Facebook Messenger notification channels.
-- Legacy customer contact columns are intentionally retained in already-migrated
-- databases to avoid destructive data loss and to keep older reports compatible.
-- No active application code reads these fields or dispatches either channel.
DELETE FROM app_settings
WHERE key IN (
  'notification_channel_telegram_enabled',
  'notification_channel_messenger_enabled',
  'telegram_bot_token',
  'telegram_default_chat_id',
  'messenger_page_access_token',
  'messenger_page_id',
  'messenger_app_secret',
  'messenger_verify_token'
)
OR key ~ '^notification_rule_.*_(telegram|messenger)_enabled$';

-- Remove retired templates before tightening the channel constraint.
DELETE FROM notification_templates WHERE channel IN ('telegram', 'messenger');
ALTER TABLE notification_templates
  DROP CONSTRAINT IF EXISTS notification_templates_channel_check;
ALTER TABLE notification_templates
  ADD CONSTRAINT notification_templates_channel_check
  CHECK (channel IN ('whatsapp', 'sms', 'email'));
