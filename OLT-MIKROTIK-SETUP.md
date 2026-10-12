# Universal OLT Connector — network path and integration contract

## Goal

An ISP must be able to use the panel without a public IP at the OLT site. The supported path is:

`OLT (private management network) → MikroTik collector → outbound HTTPS/TCP 443 → FAZ NETWORK API → PostgreSQL telemetry → OLT Management / Customer 360`

The server does not initiate an inbound connection to the ISP's MikroTik or OLT. CGNAT/public-IP absence is therefore not a blocker by itself, provided the MikroTik has outbound internet and can reach the OLT on the private network.

## ISP-side prerequisites

The ISP is responsible for its local network permissions:

1. Route from the MikroTik to the OLT management IP.
2. Enable a supported read-only OLT management protocol (usually SNMP) and allow the MikroTik's management-side IP/subnet in the OLT ACL.
3. Permit MikroTik outbound HTTPS to `faznetwork-web.onrender.com:443`.
4. If the panel is to connect to RouterOS API directly, provide a reachable and restricted RouterOS API endpoint. A private IP behind CGNAT is not directly reachable from the cloud; use the outbound-collector model instead.
5. Do not expose the OLT management service or RouterOS API to the whole internet.

## Server ingestion contract

The authenticated endpoint is:

`POST https://faznetwork-web.onrender.com/api/olt/sync-telemetry`

Header:

`Authorization: Bearer <OLT_COLLECTOR_TOKEN>`

`Content-Type: application/json`

Example body (use real values from the selected OLT profile):

```json
{
  "oltId": "stable-site-specific-id",
  "readings": [
    {
      "onuId": "vendor-specific-onu-id",
      "onuMac": "aa:bb:cc:dd:ee:ff",
      "ponPort": "EPON0/1",
      "status": "online",
      "rxPowerDbm": -22.4,
      "txPowerDbm": 2.1,
      "observedAt": "2026-10-12T12:00:00.000Z",
      "sourceAgent": "mikrotik-routeros-snmp",
      "raw": { "index": 1 }
    }
  ]
}
```

A successful response must include `success: true`, `received`, and `processed`. `/healthz` is only a server health check; it is not evidence that a telemetry POST authenticated or wrote database rows.

## Universal connector behavior required

The connector must perform these checks in order:

1. Validate the saved device identity and its vendor/model/firmware profile.
2. Test OLT reachability from the MikroTik-side collector; verify `sysDescr` before reading vendor-specific tables.
3. Use a verified adapter for the exact vendor/model/firmware to discover ONU identity, PON, status, MAC, and RX/TX power. Never guess OIDs or decode opaque power values as dBm without a verified rule.
4. Generate the RouterOS collector configuration for that adapter, using a site-specific stable OLT ID and server endpoint.
5. Store secrets server-side; use a dedicated collector credential, not a shared hard-coded production token. Never render secrets back to the browser or write them to logs.
6. Post readings on a controlled interval with bounded payloads and timeouts.
7. Show Connected only after authenticated ingestion succeeds and fresh records can be read back from PostgreSQL. Show distinct statuses for unreachable OLT, unsupported profile, SNMP denied, authentication failure, invalid payload, and stale data.
8. Match Customer 360 only by an explicitly assigned ONU MAC or verified PPPoE username. A router/CPE caller-id MAC is not an ONU MAC.

## Current implementation boundary

The current application already has an authenticated telemetry ingestion endpoint and a V-SOL-oriented MikroTik SNMP script used for the existing site. The endpoint accepts normalized readings, but the application does not yet automatically generate and validate a collector for every OLT vendor/model or firmware. OLT inventory fields by themselves do not start collection. Until an adapter has been tested against real OLT output, the UI must not claim universal compatibility or live telemetry.

## Security and operational requirements

- Keep each ISP/site's device credentials and collector credential isolated.
- Prefer SNMPv3 where supported; otherwise use a read-only community restricted by source ACL and management VLAN.
- Never paste passwords or bearer tokens into support chats, screenshots, or source control.
- Do not overwrite existing customer/billing data as part of discovery or OLT sync.
- Keep collector execution read-only against the OLT; RouterOS script installation must be an explicit, reviewable action.
