-- Notification history customer scope. Legacy rows without reliable identity remain NULL.
ALTER TABLE public.sms_delivery_logs ADD COLUMN IF NOT EXISTS user_type VARCHAR(20);
DO $migration$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sms_delivery_logs_user_type_check') THEN
    ALTER TABLE public.sms_delivery_logs ADD CONSTRAINT sms_delivery_logs_user_type_check
      CHECK (user_type IS NULL OR user_type IN ('hotspot','pppoe'));
  END IF;
END
$migration$;
UPDATE public.sms_delivery_logs
SET user_type = CASE
  WHEN event_key LIKE 'hotspot%' THEN 'hotspot'
  WHEN event_key LIKE 'pppoe%' THEN 'pppoe'
  ELSE NULL
END
WHERE user_type IS NULL;
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_user_type_created
  ON public.sms_delivery_logs(user_type, created_at DESC);
