# Scheduled RouterOS read-only snapshots

The web service can poll the configured MikroTik RouterOS API from Render, provided the existing API host/port credentials and network route are reachable. This collector runs after database initialization and repeats every five minutes by default. Set `ROUTER_READONLY_SYNC_INTERVAL_MS` to a value of at least 60000 to adjust the cadence.

## Data collected

The collector saves timestamped, sanitized snapshots in `router_readonly_snapshots` for router identity/resources, PPP profiles, IP pools and pool usage, interfaces, and bridge hosts. It runs queries sequentially to avoid opening a burst of concurrent RouterOS API sockets.

## Safety boundary

- This job uses read-only RouterOS print/monitor operations only.
- It never writes to MikroTik configuration.
- It does not insert/update/delete `customers`, `pppoe_users`, billing, payments, expiry, or package records.
- It does not store PPPoE passwords or raw RouterOS configuration.
- A failed poll preserves the last successful payload and marks the latest attempt as failed.
- Bridge-host MACs are raw L2 observations, not automatically treated as ONU MACs or assigned to customers.
- This snapshot job does not replace the existing live PPPoE session path.

## Discovery and OLT limitations

RouterOS IP Neighbor Discovery being enabled on the router is different from the application's `network_discovery_sources.enabled` database flag. The existing discovery-history job can still report no enabled source if no app inventory source row is enabled. This snapshot job deliberately does not create or enable inventory sources or attach observations to customers.

ONU RX Power (dBm) must come from a verified OLT telemetry collector and exact OLT/ONU identity mapping. It cannot be inferred from MikroTik bridge hosts or router caller-id. The existing local OLT collector requires official firmware MIB/OID validation and a live collector configured to post to `/api/olt/sync-telemetry`; this PR does not fabricate optical readings or claim RX Power is fixed.
