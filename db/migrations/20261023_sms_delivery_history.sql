-- Durable outbound message history across SMS, WhatsApp and email.
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
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_created_at ON sms_delivery_logs(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_phone_created ON sms_delivery_logs(recipient_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_status_created ON sms_delivery_logs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_channel_created ON sms_delivery_logs(channel, created_at DESC);
