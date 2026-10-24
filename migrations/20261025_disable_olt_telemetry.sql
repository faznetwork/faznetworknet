-- One-time, repeatable retirement of cached OLT telemetry.
-- Customer, billing, package, payment, transaction, Router MAC, PPPoE and ONU inventory data are preserved.
BEGIN;

UPDATE customers
SET onu_mac = NULL,
    onu_rx_power_dbm = NULL,
    onu_rx_power_observed_at = NULL,
    onu_rx_power_source_device_id = NULL,
    olt_pon_port = NULL
WHERE onu_mac IS NOT NULL
   OR onu_rx_power_dbm IS NOT NULL
   OR onu_rx_power_observed_at IS NOT NULL
   OR onu_rx_power_source_device_id IS NOT NULL
   OR olt_pon_port IS NOT NULL;

DO $retire_olt_telemetry$
BEGIN
  IF to_regclass('olt_telemetry') IS NOT NULL THEN
    EXECUTE 'DROP TABLE olt_telemetry';
  END IF;
END;
$retire_olt_telemetry$;

COMMIT;
