-- Retire cached OLT optical telemetry without touching customer identity, ONU inventory,
-- Router MAC, PPPoE credentials, billing, payments, transactions, or MikroTik discovery.
-- Safe for both databases with the legacy cache columns and fresh schemas without them.
BEGIN;

DO $retire_olt_cache$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'customers'
      AND column_name = 'onu_rx_power_dbm'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'customers'
      AND column_name = 'onu_rx_power_observed_at'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'customers'
      AND column_name = 'onu_rx_power_source_device_id'
  ) THEN
    UPDATE customers
    SET onu_rx_power_dbm = NULL,
        onu_rx_power_observed_at = NULL,
        onu_rx_power_source_device_id = NULL
    WHERE onu_rx_power_dbm IS NOT NULL
       OR onu_rx_power_observed_at IS NOT NULL
       OR onu_rx_power_source_device_id IS NOT NULL;
  END IF;

  IF to_regclass('olt_telemetry') IS NOT NULL THEN
    EXECUTE 'DELETE FROM olt_telemetry';
    EXECUTE 'DROP TABLE olt_telemetry';
  END IF;
END;
$retire_olt_cache$;

ALTER TABLE customers DROP COLUMN IF EXISTS onu_rx_power_source_device_id;
ALTER TABLE customers DROP COLUMN IF EXISTS onu_rx_power_observed_at;
ALTER TABLE customers DROP COLUMN IF EXISTS onu_rx_power_dbm;

COMMIT;
