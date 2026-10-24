-- FAZ NETWORK native email engine.
-- Additive only: does not modify or delete existing customer, billing, payment, or transaction rows.
CREATE TABLE IF NOT EXISTS email_outbox (
  id BIGSERIAL PRIMARY KEY,
  idempotency_key VARCHAR(200) NOT NULL UNIQUE,
  event_key VARCHAR(100) NOT NULL DEFAULT 'manual',
  recipient_address VARCHAR(254) NOT NULL,
  payload_ciphertext TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lease_until TIMESTAMPTZ,
  provider_message_id VARCHAR(255),
  last_error_code VARCHAR(80),
  last_error_message VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_email_outbox_pending
  ON email_outbox (available_at, id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_email_outbox_expired_lease
  ON email_outbox (lease_until, id) WHERE status = 'processing';
CREATE INDEX IF NOT EXISTS idx_email_outbox_event_created
  ON email_outbox (event_key, created_at DESC);
