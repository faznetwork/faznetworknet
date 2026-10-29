-- FAZ NETWORK reseller email-first invitation support.
-- Additive and transactional. Apply manually after review; never at application startup.
BEGIN;

ALTER TABLE resellers
  ADD COLUMN IF NOT EXISTS email VARCHAR(254),
  ADD COLUMN IF NOT EXISTS invite_token_hash CHAR(64),
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

-- Legacy username/password accounts remain supported; new invite-first accounts
-- are allowed to leave these fields NULL until invitation acceptance.
ALTER TABLE resellers ALTER COLUMN username DROP NOT NULL;
ALTER TABLE resellers ALTER COLUMN password_hash DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_resellers_email_ci
  ON resellers (LOWER(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_resellers_invite_token_hash
  ON resellers (invite_token_hash)
  WHERE invite_token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_resellers_invite_expiry
  ON resellers (invite_expires_at)
  WHERE invite_token_hash IS NOT NULL;

COMMIT;
