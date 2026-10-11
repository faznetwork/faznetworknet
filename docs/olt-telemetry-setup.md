# V-SOL OLT read-only RX telemetry

Target OLT: V-SOL V1601E04-DP / V1600D4 family at management IP `172.21.21.2:161`. Prior MikroTik SNMPv2c read-only testing returned `sysDescr=V1600D4`. The old address `103.54.37.182` returned `SUMON_RB4011_VPN` and is not the OLT endpoint.

## Current status

The checked-in script is a **safe discovery guard**, not an active telemetry collector. It verifies the target's SNMP description and prints the known V-SOL enterprise ONU table branch. It intentionally does not poll guessed RX/MAC columns or POST any readings until the actual column OIDs, index order, and RX value encoding are verified against this firmware.

## Safety boundaries

- Uses SNMP v2c read-only community `public`; never use the `private` read-write community.
- Does not write to the OLT or change MikroTik PPPoE, firewall, routing, or billing settings.
- Does not create a scheduler and does not POST telemetry.
- Do not enable a five-minute scheduler until verified RX/MAC readings are being sent successfully.

## Confirmed SNMP exploration

- OLT `sysDescr`: `V1600D4`
- Enterprise: `1.3.6.1.4.1.37950`
- Candidate ONU table branch: `1.3.6.1.4.1.37950.1.1.5.10`
- Previously tried branches `.1.3.6.1.4.1.37950.1.1.5.2.1.8` and `.1.3.6.1.4.1.37950.1.1.5.2.1` returned empty.
- A next lookup entered `.1.3.6.1.4.1.37950.1.1.5.10.1.1.1.1.1.1` with integer value `1`. This is not yet identified as RX power or ONU MAC.

## Next engineering step

Inspect the V-SOL MIB/table definitions for the `.5.10` branch and verify actual live column values and index order. Only then restore telemetry POST, with unknown OCTET STRING RX encodings remaining NULL rather than guessed as dBm.
