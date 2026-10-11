# V-SOL OLT read-only RX telemetry

The collector targets V-SOL V1600D4 / V1601E04-DP at management IP `172.21.21.2:161`, the address previously identified as returning the V1600D4 system description. The old `103.54.37.182` returned `SUMON_RB4011_VPN` and is a MikroTik, not the OLT.

## Safety

- Uses SNMP v2c read-only community `public`; never use `private`.
- Checks the SNMP sysDescr contains `V1600D` before scanning or posting.
- Does not write to the OLT or change PPPoE, firewall, routing, or billing settings.
- Does not create a scheduler. Run manually first.
- The documented V-SOL RX OID is an OCTET STRING; backend parsing intentionally leaves unknown encodings blank instead of guessing a dBm scale.

## Setup

1. Set `OLT_COLLECTOR_TOKEN` on Render `faznetwork-web`.
2. Replace `__OLT_COLLECTOR_TOKEN__` locally in the .rsc file; never commit a real token.
3. Upload the file to MikroTik Files and import it. If a script with the same name already exists, do not re-import over it blindly; remove/replace that script deliberately after saving the existing source.
4. Run `/system script run faz-olt-telemetry` manually and wait for completion. The scan checks PON 1–4 / ONU 1–64 and posts only rows with both MAC and RX OID responses.
5. Confirm the API response is successful and inspect Customer 360. RX appears only when the OLT MAC matches the customer's saved ONU MAC exactly. Unknown RX encodings remain blank.
6. Only after a successful manual run and verified RX values, add the five-minute scheduler.

## OIDs used

- RX optical power: `1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.7.<PON>.<ONU>`
- ONU MAC: `1.3.6.1.4.1.37950.1.1.5.12.2.1.2.1.5.<PON>.<ONU>`

The OID definitions identify the RX object as read-only OCTET STRING; exact index order and value encoding must still be validated on live firmware before claiming RX is displayed as dBm.
