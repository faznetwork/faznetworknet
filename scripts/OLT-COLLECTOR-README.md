# V-SOL V1600D4 SNMP telemetry collector

Configure these environment variables on a host that can reach the OLT over UDP/161 and the FAZ NETWORK API:
- `OLT_SNMP_HOST=172.21.21.2`
- `OLT_SNMP_COMMUNITY=public` (SNMP v2c)
- `OLT_SNMP_PORT=161`
- `OLT_ID=OLT-V1600D4`
- `OLT_API_URL=https://YOUR-FAZ-NETWORK-HOST/api/olt/sync-telemetry`
- `OLT_COLLECTOR_TOKEN=the-same-token-configured-on-the-API-server`
- `OLT_POLL_INTERVAL_MS=60000`
- `OLT_SNMP_TIMEOUT_MS=5000`
- `OLT_SNMP_RETRIES=1`

Optional overrides: `OLT_ONU_MAC_OID`, `OLT_ONU_RX_OID`, `OLT_ONU_TX_OID`, `OLT_ONU_STATUS_OID`, `OLT_MAC_TABLE_MAC_OID`, `OLT_MAC_TABLE_TYPE_OID`, and `OLT_MAC_TABLE_PORT_OID`. The learned-MAC defaults use the V-SOL V1600D private MIB table `.1.3.6.1.4.1.37950.1.1.5.10.3.8.1` (columns 1–4: MAC index/value, VLAN, static/dynamic type, and port ID). Without a configured status OID, the worker sends `status: "unknown"`; the supplied MAC/RX/TX OIDs do not prove online/offline state.

Run `npm install`, then `npm run collect:olt`. Use a process supervisor and run only one worker, not one per web replica. The worker polls immediately and then every 60 seconds.

The collector joins the supplied tables by their matching suffix. It expects either `PON.ONU` indexes (PON 1–4, ONU 1–64) or flat indexes 1–256. Verify this index layout on the actual V1600D4 firmware before production. Optical values are divided by 100 and raw samples are retained.

The collector joins the learned MAC, type, and port columns by the same SNMP index. It includes only dynamic learned MAC entries whose port ID can be parsed unambiguously as a PON/ONU location; unrecognized port encodings are ignored rather than guessed. Confirm the returned `macPortId1` value format on the target firmware before relying on automatic mapping. Each ONU reading includes `raw.clientMacs`, for example `["30:07:5c:73:39:ab"]`. The background discovery job compares a RouterOS PPPoE caller-id (router MAC) only against this learned-MAC list; it never stores that router MAC as `customers.onu_mac`. Only one fresh telemetry match can map the customer, and conflicting or ambiguous assignments are refused.
