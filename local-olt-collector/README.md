# FAZ NETWORK OLT Collector — Retired

OLT optical telemetry collection and ingestion have been retired. The retained `collector.py` entry point is intentionally inert and only logs that collection is disabled; it does not open SNMP sessions or make HTTP requests.

Do not install or re-enable an old service unit for this collector. Customer records, saved ONU/fiber inventory, Router MAC values, PPPoE sessions, billing, payment records, and MikroTik RouterOS discovery remain separate and are not modified by this retired collector.
