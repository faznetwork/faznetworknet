# V-SOL OLT read-only RX telemetry

This collector is for the V-SOL V1601E04-DP on the local management network. Render cannot reach the OLT's private management address directly; a RouterOS v7.8+ device on the same network must poll SNMP and push readings to the existing authenticated API.

## Safety boundaries

- Uses SNMP v2c read-only community only; do not use the `private` read-write community.
- Does not write to the OLT or change MikroTik PPPoE, firewall, routing, or billing settings.
- The collector template is a manual import and is not installed or scheduled automatically.
- First run manually, check logs and the API response, and only then add the five-minute scheduler.
- The RX OID is documented as OCTET STRING for the V1600D family. The server accepts only a plain numeric value in the expected optical range or a value explicitly marked dBm. It intentionally stores unknown encodings as NULL instead of guessing a scale.

## Configuration

1. Set a strong `OLT_COLLECTOR_TOKEN` environment variable on the Render `faznetwork-web` service.
2. Replace `__OLT_COLLECTOR_TOKEN__` in `scripts/mikrotik/olt-telemetry-collector.rsc` with that exact token. Never commit a real token to Git.
3. Confirm SNMP read-only access from the MikroTik to OLT `103.54.37.182:161`. If the OLT has a source-IP allow list, allow only the MikroTik management source IP; do not enable SNMP writes or open SNMP to the Internet.
4. Upload/import the script on the MikroTik and run it manually once. It reads candidate indexes 1–4 / 1–64, sends only entries with both a MAC and RX object, and logs the server response. The script uses short per-query timeouts; a first scan may take time.
5. Check the server response `success:true` and then open Customer 360. The customer ONU MAC must match the OLT MAC exactly for RX to appear on that customer. Unknown/unparseable RX encodings remain blank by design.
6. Only after a successful manual run, add a scheduler interval of `5m` for the script. Do not run overlapping copies.

## MIB branches used

- RX optical power: `1.3.6.1.4.1.37950.1.1.5.12.2.1.8.1.7.<PON>.<ONU>`
- ONU MAC: `1.3.6.1.4.1.37950.1.1.5.12.2.1.2.1.5.<PON>.<ONU>`

The exact index ordering and RX value encoding must be confirmed from the live firmware response before treating values as validated dBm. This template is intentionally read-only and must not be described as active until a real push is received.
