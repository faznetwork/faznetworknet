# FAZ NETWORK — V-SOL EPON Telnet collector (RouterOS v7 Container)

This collector is intended for a MikroTik RouterOS v7 Container on the same management LAN as a V-SOL V1601E04-DP. It reads optical diagnostics from EPON ports 0/1–0/4 and POSTs the results to the existing authenticated Render ingest endpoint. It does not change OLT or MikroTik configuration.

## Important accuracy/security notes

- This starts with Telnet on port 23 as requested. Telnet sends credentials in cleartext; keep the OLT management network isolated. Prefer a verified SSH adapter when the OLT supports it.
- The sample table parser expects the stated pipe-delimited columns: `Port / ONU ID | Voltage | Bias | TX Power | RX Power`. Exact firmware output can differ. The collector skips rows it cannot parse and refuses to push if no optical rows were parsed; verify against real CLI output before relying on telemetry.
- A row with both power values missing or N/A is sent as `status: unknown`, not falsely declared online/offline. This command alone does not prove ONU operational status.
- ONU MAC is attached only if `show onu mac` returns the EPON identifier and MAC on the same line. No MAC is invented, and router MAC is not treated as ONU MAC.
- The image has a Telnet adapter only. `OLT_PROTOCOL=ssh` intentionally fails closed; SSH fallback needs a separately tested adapter and image dependency.
- Render API token is a secret. Never commit the real token to Git. Set it in RouterOS container environment variables and keep backups protected.

## Build a multi-architecture image

Build and push to a registry accessible by the MikroTik. Replace `REGISTRY_USER` and use a private repository if possible:

```sh
docker buildx build --platform linux/arm/v7,linux/arm64 -t REGISTRY_USER/faz-vsol-collector:1.0.0 --push ./mikrotik-vsol-collector
```

Confirm the chosen RouterOS device supports the Container package, its CPU architecture, storage, and device-mode requirements before enabling containers. Device-mode changes may require physical confirmation.

## RouterOS v7 example

First create a VETH on a management-LAN address that is unused and in the correct subnet. Bridge membership, gateway, and DNS must match the actual router; do not paste the example IPs blindly.

```routeros
/interface/veth/add name=veth-vsol address=192.0.2.20/24 gateway=192.0.2.1
/interface/bridge/port/add bridge=bridge interface=veth-vsol
/container/config/set registry-url=https://registry-1.docker.io
/container/envs/add list=vsol key=OLT_HOST value=192.0.2.10
/container/envs/add list=vsol key=OLT_PORT value=23
/container/envs/add list=vsol key=OLT_PROTOCOL value=telnet
/container/envs/add list=vsol key=OLT_USERNAME value=readonly-user
/container/envs/add list=vsol key=OLT_PASSWORD value=CHANGE_ME
/container/envs/add list=vsol key=OLT_ENABLE_PASSWORD value=
/container/envs/add list=vsol key=RENDER_INGEST_URL value=https://faznetwork-web.onrender.com/api/olt/sync-telemetry
/container/envs/add list=vsol key=OLT_COLLECTOR_TOKEN value=SET_THE_RENDER_SECRET_HERE
/container/envs/add list=vsol key=OLT_ID value=vsol-v1601e04-dp
/container/envs/add list=vsol key=POLL_INTERVAL_SECONDS value=300
/container/add remote-image=REGISTRY_USER/faz-vsol-collector:1.0.0 interface=veth-vsol envlist=vsol root-dir=disk1/containers/vsol start-on-boot=yes logging=yes
/container/start [find where interface=veth-vsol]
```

The example uses documentation-only IPs (192.0.2.0/24) and placeholders. Replace them with the real, reserved management-LAN values and secret. RouterOS syntax/paths can differ by version; verify `/container print`, `/interface/veth print`, bridge name, storage path, and device-mode locally before running. Do not enable Container mode remotely if physical access is unavailable.

## Configuration

Copy `.env.example` to `.env` for local testing, or configure equivalent environment variables in RouterOS. Required values: `OLT_HOST`, `OLT_USERNAME`, `OLT_PASSWORD`, `RENDER_INGEST_URL`, `OLT_COLLECTOR_TOKEN`, and `OLT_ID`. Optional `OLT_OPM_COMMAND_TEMPLATE` defaults to `show onu opm-diag epon 0/{port}`; `OLT_MAC_COMMAND` defaults to `show onu mac`.

The process polls every 300 seconds by default. It retries on the next cycle after connection, command, parser, or HTTP errors. HTTPS certificate validation is enabled.

## API payload

The agent sends `{"oltId":"...","readings":[{"onuId":"EPON0/1:1","ponPort":"EPON0/1","onuMac":null,"status":"online","rxPowerDbm":-19.45,"txPowerDbm":2.15,"observedAt":"...","sourceAgent":"mikrotik-vsol-container","raw":{}}]}` to `POST /api/olt/sync-telemetry` using `Authorization: Bearer <OLT_COLLECTOR_TOKEN>`.

## Before production use

1. Verify read-only login and the exact prompt on the actual OLT.
2. Compare all four port outputs with the parser; confirm TX/RX column order and N/A formatting.
3. Confirm Render replies with `success: true` and Customer 360 matches the correct PPPoE username/ONU. This implementation does not guess a PPPoE username when the OLT output does not provide one.

## Automated GHCR publishing

The GitHub Actions workflow `.github/workflows/build-vsol-container.yml` builds multi-architecture images for `linux/arm/v7` and `linux/arm64` and publishes them to:

`ghcr.io/fozlerabbiofficialgmcservice-cyber/faz-vsol-collector:latest`

It runs after relevant changes reach `main`, on `vsol-collector-v*` tags, or when manually started from the Actions tab. After the first successful run, set the GHCR package visibility to **Public** if the MikroTik should pull without registry credentials; otherwise create a read:packages token and configure registry credentials on RouterOS. The workflow has not been run against a live MikroTik as part of this code change.

## Final RouterOS setup checklist

1. Check `/system/resource/print`, `/system/device-mode/print`, `/container/print`, `/interface/bridge/print`, and `/ip/address/print`. Confirm Container package/device-mode requirements and physical access first.
2. Reserve an unused management-LAN IP for VETH and use the actual bridge name, gateway, DNS and OLT management IP. Do not copy `192.0.2.x` examples.
3. Configure the collector variables shown above. Keep OLT and Render tokens out of shell history/screenshots; use a read-only OLT account and restrict management LAN access.
4. After the workflow succeeds and the GHCR package is public (or registry auth is configured), use this image:
   `ghcr.io/fozlerabbiofficialgmcservice-cyber/faz-vsol-collector:latest`
5. Start the container and inspect `/container/print` and `/log/print where topics~"container"`. Check container logs for a successful authenticated Render response.
6. In Customer 360, confirm the timestamp updates and values match the OLT CLI. Until then, treat the topology as partial/unverified.

The example RouterOS commands earlier in this document are templates, not safe-to-paste production commands: replace placeholder addresses, bridge, image registry access and secrets first. RouterOS versions and hardware may differ in supported container syntax.
