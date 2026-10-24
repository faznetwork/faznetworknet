# FAZ NETWORK Local OLT Collector

This agent runs inside the private LAN and pushes telemetry to Render over outbound HTTPS. Render does not initiate a connection to the OLT.

## Important vendor-specific setup
The V-SOL OLT's exact MIB/OIDs and status/power encoding depend on model and firmware. **Do not use guessed OIDs or guessed dBm scaling.** Obtain the official MIB for the installed firmware and verify the table indexes/units first. This collector intentionally refuses to run until the required OIDs are configured. If the OLT exposes data only through CLI instead of SNMP, implement and test a firmware-specific adapter rather than guessing CLI commands.

## Install
1. Copy this directory to an always-on LAN PC/server/VM.
2. Install Python 3.10+ and create a virtual environment:
   `python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt`
3. Copy `.env.example` to `.env`, set the local OLT IP, read-only SNMP community, Render endpoint and shared bearer token.
4. Fill all required `OID_ONU_*` values from the official MIB. Confirm the table index alignment and raw power units with one known ONU before production.
5. If Customer 360 should automatically match a telemetry row before its ONU MAC has already been saved to the customer, populate `ONU_CUSTOMER_MAP_JSON` with the exact SNMP table suffix/ONU ID mapped to the panel PPPoE username. Do not guess ONU indexes; verify them from the OLT.\n6. Run `python collector.py`; inspect logs and Render's JSON acknowledgement.

## systemd
Copy the directory to `/opt/faz-olt-collector`, create a dedicated unprivileged user, protect .env (mode 600), then install the included service:
`sudo cp faz-olt-collector.service /etc/systemd/system/`
`sudo systemctl daemon-reload && sudo systemctl enable --now faz-olt-collector`
View logs: `journalctl -u faz-olt-collector -f`.

The process retries on the next interval after SNMP/HTTP errors and does not send an empty snapshot. Set the server's OLT_COLLECTOR_TOKEN to the same high-entropy value as the agent. Rotate it if exposed.
