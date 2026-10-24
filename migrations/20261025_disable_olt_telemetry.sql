-- One-time, repeatable retirement of cached OLT telemetry.
-- Customer, billing, package, payment, transaction, Router MAC, PPPoE and ONU inventory data are preserved.
BEGIN;

UPDATE customers
SET onu_rx_power_dbm = NULL,
    onu_rx_power_observed_at = NULL,
    onu_rx_power_source_device_id = NULL
WHERE onu_rx_power_dbm IS NOT NULL
   OR onu_rx_power_observed_at IS NOT NULL
   OR onu_rx_power_source_device_id IS NOT NULL;

DO $retire_olt_telemetry$
BEGIN
  IF to_regclass('olt_telemetry') IS NOT NULL THEN
    EXECUTE 'DELETE FROM olt_telemetry';
  END IF;
END;
$retire_olt_telemetry$;

COMMIT;
