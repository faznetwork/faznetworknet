# OLT Management: reusable MikroTik onboarding

This guide is intended for each ISP/site that uses the FAZ NETWORK panel. Registering an OLT is inventory only; it does not itself poll the device or prove that live ONU telemetry is arriving.

## 1. Register the device

In **Core System → OLT Management → Add OLT**, enter:
- **OLT Name**: a human-readable name for this site.
- **Vendor / Model**: the exact vendor and firmware model.
- **Management IP**: only the OLT's IP address (not the MikroTik IP).
- **Management Port**: the port as a separate value, if the management service uses one.
- **Username / Password**: only if the device management protocol needs them.
- **Location / Serial**: optional inventory metadata.

Credentials must stay private. Never put production tokens or passwords in screenshots, source control, or support chats.

## 2. Verify that the IP is really the OLT

Run this read-only command in the MikroTik terminal. Replace the placeholders locally:

```routeros
/tool snmp-get address=<OLT_IP> community=<SNMP_COMMUNITY> oid=1.3.6.1.2.1.1.1.0
```

The response should identify the OLT vendor/model. If it reports RouterOS, the entered IP points to a MikroTik router rather than the OLT. If it times out, verify routing, SNMP version/community, firewall ACL, and UDP port 161 reachability before proceeding.

Use vendor/firmware-verified MIB/OID definitions for PON, ONU identity, MAC, status, and optical power. OIDs and encoded power formats can differ between models; do not reuse an unverified OID map.

## 3. Configure the telemetry collector

The current backend accepts authenticated snapshots at:

`POST https://faznetwork-web.onrender.com/api/olt/sync-telemetry`

Required request format:

```json
{
  "oltId": "stable-site-specific-olt-id",
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
      "raw": {"index": 1}
    }
  ]
}
```

Use actual readings only. `status` must be `online`, `offline`, `los`, or `unknown`; optical power must be a valid dBm value or a format explicitly supported by the backend. The collector must send `Authorization: Bearer <OLT_COLLECTOR_TOKEN>` and `Content-Type: application/json`. Configure the same private token in Render and in the collector; never expose it to the browser or logs.

A successful ingestion returns `success: true` and `received` / `processed` counts. A successful `/healthz` GET only proves the web process responds; it does not prove POST authentication or database writes work.

## 4. Verify the data in the panel

After a successful POST:
1. Refresh OLT Management / ONT Information.
2. Confirm the record has a recent **Last Sync** and is not marked **STALE**.
3. Verify PON, ONU ID, ONU MAC, RX and TX power against the device's own SNMP output.
4. For Customer 360, match the exact ONU MAC assigned to the customer, or an explicitly verified PPPoE username sent by the authenticated collector. Never substitute the customer's router/caller-id MAC for an ONU MAC.

## Current automation boundary

This release contains a guided onboarding flow and an authenticated snapshot endpoint. It does **not** yet auto-detect arbitrary vendor OIDs or generate a fully model-aware RouterOS collector for every OLT. That requires a verified adapter/profile for each vendor and firmware family, plus per-ISP credential isolation. Until that is implemented, the panel must not claim an OLT is connected solely because its inventory record exists.
