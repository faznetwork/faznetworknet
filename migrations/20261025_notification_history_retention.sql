-- Notification history retention indexes. No data is deleted by this migration.
CREATE INDEX IF NOT EXISTS idx_sms_delivery_logs_retention
  ON public.sms_delivery_logs(created_at,id);
CREATE INDEX IF NOT EXISTS idx_email_outbox_terminal_retention
  ON public.email_outbox(created_at,id)
  WHERE status IN ('sent','failed');
