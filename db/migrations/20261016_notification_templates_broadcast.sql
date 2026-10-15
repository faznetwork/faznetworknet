-- Custom notification templates and durable broadcast history/recipient queue.
CREATE TABLE IF NOT EXISTS notification_templates (
  id BIGSERIAL PRIMARY KEY,
  event_key VARCHAR(80) NOT NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('whatsapp','sms','telegram','messenger')),
  template_body TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_key, channel)
);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active
  ON notification_templates(event_key, channel) WHERE is_active = TRUE;

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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
