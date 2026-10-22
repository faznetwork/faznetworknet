-- Durable outbound SMS attempt history. Existing customer/payment rows are untouched.
CREATE TABLE IF NOT EXISTS sms_delivery_logs (
  id BIGSERIAL PRIMARY KEY,
  recipient_phone VARCHAR(40) NOT NULL,
  message TEXT NOT NULL,
  event_key VARCHAR(80) NOT NULL DEFAULT 'manual',
  status VARCHAR(20) NOT NULL CHECK (status IN ('sent','failed','skipped')),
  gateway_mode VARCHAR(40),
  http_method VARCHAR(20),
  http_status INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_created_at ON sms_delivery_logs(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_phone_created ON sms_delivery_logs(recipient_phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_status_created ON sms_delivery_logs(status, created_at DESC);
