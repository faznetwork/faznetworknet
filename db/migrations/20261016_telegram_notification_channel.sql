-- Telegram customer direct-message addressing. Existing contact/profile values are preserved.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS telegram_chat_id VARCHAR(150);
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_telegram_chat_id
  ON customers(telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL AND telegram_chat_id <> '';

INSERT INTO app_settings(key, value) VALUES
  ('telegram_bot_token', ''),
  ('telegram_default_chat_id', ''),
  ('notification_channel_telegram_enabled', 'false')
ON CONFLICT(key) DO NOTHING;
