# RouterOS-native OLT telemetry collector v2

This file is an experimental alternative to the previous fixed 4x64 OID scan:
`scripts/mikrotik/olt-telemetry-collector-v2.rsc`

## Why this version exists
- It targets the observed V-SOL table roots under `1.3.6.1.4.1.37950.1.1.5.12.1.12.1` and the observed RX/TX optical table roots.
- It walks MAC table rows using SNMP GETNEXT and queries the other columns by the same row suffix.
- It sends readings directly from RouterOS to the existing authenticated Render endpoint, so no separate PC/server is needed if the RB4011 can reach the OLT's management IP and the Render endpoint.
- It only reads SNMP data and posts telemetry. It does not alter OLT settings, RouterOS networking, PPPoE, firewall, or schedulers.

## Mandatory limitations
- This is **not yet production-verified on the live RB4011/OLT**. RouterOS `/tool snmp-get next=yes` return fields and actual OID table alignment must be checked on the installed RouterOS/OLT firmware.
- The script has a 256-row cap and stores its payload in RouterOS variables; very large tables may exceed RouterOS variable/payload limits.
- OLT status codes are deliberately reported as `unknown`. RX/TX power is sent as returned by SNMP; the backend only accepts plain numeric values or explicit dBm text. If the OLT returns an unlabelled numeric or binary OCTET STRING, power remains blank/ambiguous until its encoding is confirmed.
- Customer matching is exact by saved ONU MAC or explicit PPPoE username. This collector does not guess customer associations.
- It creates a script named `faz-olt-telemetry-v2`; it does not overwrite the existing `faz-olt-telemetry` script and does not create a scheduler.

## Safe validation procedure
1. Set `OLT_COLLECTOR_TOKEN` on Render to a strong secret and put the same secret into the script locally. Never commit the real token.
2. Review current RouterOS version and ensure the OLT SNMP community is read-only. The example uses `public` only because that community was previously used for read-only diagnostics; use the configured read-only community if different.
3. Import the file only after backing up the current script source. Run `/system script run faz-olt-telemetry-v2` manually, not on a scheduler.
4. Verify the first returned OID and MAC, the number of rows, RX raw value/units, and API acknowledgement against the OLT UI for several known ONUs.
5. Do not schedule it until the row alignment and power units are confirmed. If the script errors or reports zero rows, stop and inspect the returned SNMP fields rather than changing the OLT or firewall.

This draft is intentionally not auto-deployed and does not modify the running router.