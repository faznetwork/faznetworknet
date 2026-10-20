-- Make the seven core operational modules explicit for every existing tenant.
-- This intentionally enables all seven modules, including flags previously set false,
-- per the approved clean-rebuild policy. Additional module flags are preserved.
BEGIN;

UPDATE public.tenants
SET modules =
  (CASE
     WHEN jsonb_typeof(modules) = 'object' THEN modules
     ELSE '{}'::jsonb
   END)
  || '{"customers":true,"hotspot":true,"billing":true,"pppoe":true,"mikrotik":true,"olt":true,"reports":true}'::jsonb,
  updated_at = NOW();

ALTER TABLE public.tenants
  ALTER COLUMN modules SET DEFAULT '{"customers":true,"hotspot":true,"billing":true,"pppoe":true,"mikrotik":true,"olt":true,"reports":true,"sms_gateway":true,"whatsapp":true}'::jsonb;

ALTER TABLE public.tenants
  ALTER COLUMN modules SET NOT NULL;

COMMIT;
