# MikroTik OLT telemetry scheduler diagnostics

The sourceAgent value `mikrotik-routeros-snmp` identifies the sender recorded in old rows; by itself it does **not** prove why collection stopped. Check the RouterOS script, scheduler, SNMP reachability, and last HTTP response before changing credentials or OIDs.

## Inspect current script and scheduler

Run in MikroTik Terminal:

```routeros
/system script print detail where name="faz-olt-telemetry"
/system scheduler print detail where name="olt-telemetry"
/log print where message~"OLT|olt|SNMP|snmp|fetch|Fetch"
/system script run faz-olt-telemetry
```

Immediately check the log for SNMP timeout, script policy/permission errors, HTTP status, TLS/certificate errors, API 401/403, or payload validation failures. Confirm the script posts to the currently configured API endpoint and uses the same collector token configured in Render. Do not print or share the token in logs/screenshots.

## Enable the existing script every five minutes

Only do this after manually running the existing script once and confirming it posts a fresh sample successfully. If the scheduler already exists, enable/update it rather than creating a duplicate:

```routeros
/system scheduler set [find where name="olt-telemetry"] disabled=no interval=5m start-time=startup on-event="/system script run faz-olt-telemetry"
/system scheduler print detail where name="olt-telemetry"
```

If no scheduler exists, add one:

```routeros
/system scheduler add name="olt-telemetry" interval=5m start-time=startup on-event="/system script run faz-olt-telemetry" policy=read,write,test,policy,sensitive
```

The scheduler's permissions must not exceed the minimum required by the script; if RouterOS rejects the policy, compare the existing script's policy and use the minimum set that permits its SNMP reads and `/tool fetch` POST. Avoid creating a second scheduler with a different name.

## Verify fresh ingest

1. Run `/system script run faz-olt-telemetry` and inspect RouterOS logs.
2. Confirm the server accepted `POST /api/olt/sync-telemetry` and the HTTP response was successful.
3. From an authenticated admin session, query `GET /api/olt/telemetry`; verify `observedAt` advances, `receivedAt` advances, and `sourceAgent` matches the expected collector.
4. If `receivedAt` advances but `observedAt` remains old, fix the script payload timestamp. The API freshness rule is based on source observation time.
5. If SNMP read failures occur, verify reachability to OLT `172.21.21.2:161/UDP`, the actual community, OID, and value encoding. Do not guess the RX/TX scaling or PON/ONU index format.

The script name and scheduler name above match the previously used FAZ NETWORK convention. If they do not exist on the router, inspect the actual script list before adding anything. This document does not change MikroTik configuration automatically.