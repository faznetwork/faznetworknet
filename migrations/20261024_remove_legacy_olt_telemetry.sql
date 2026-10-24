-- Retire the legacy push-based OLT telemetry cache after application code no longer reads it.
-- Deliberately omit CASCADE: if any object depends on this telemetry-only table, fail safely.
BEGIN;
DROP TABLE IF EXISTS olt_telemetry;
COMMIT;
