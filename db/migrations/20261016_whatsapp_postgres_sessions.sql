-- PostgreSQL-backed Baileys credentials and Signal keys survive ephemeral Render instances.
-- Session data is isolated from app_settings and never includes customer/payment records.
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  key VARCHAR(255) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
