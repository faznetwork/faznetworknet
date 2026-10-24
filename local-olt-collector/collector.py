#!/usr/bin/env python3
"""Retired OLT telemetry collector.

OLT telemetry ingestion has been disabled for FAZ NETWORK. This entry point is
intentionally inert so an old service/container cannot collect or push data.
Do not restore collection without an explicitly approved replacement design.
"""
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
LOG = logging.getLogger("faz-olt-collector-disabled")


def main():
    LOG.warning("OLT telemetry collector is disabled; no SNMP collection or API push will run.")


if __name__ == "__main__":
    main()
