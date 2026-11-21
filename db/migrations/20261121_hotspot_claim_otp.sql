-- Phase 3 (C1): one-time claim codes for unbound pending_claim packages.
-- Idempotent: safe to re-run. Stores ONLY the sha256 hash of the 6-digit
-- code, never the code itself. One code = one claim (used_at set on verify).
CREATE TABLE IF NOT EXISTS public.hotspot_claim_otps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  voucher_id bigint NOT NULL REFERENCES public.hotspot_vouchers(id),
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  attempts int NOT NULL DEFAULT 0,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS hotspot_claim_otps_phone_expires_idx
  ON public.hotspot_claim_otps (phone, expires_at);
CREATE INDEX IF NOT EXISTS hotspot_claim_otps_voucher_idx
  ON public.hotspot_claim_otps (voucher_id, created_at DESC);
