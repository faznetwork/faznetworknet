#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${BACKUP_DIR}/faznetwork-postgres-${TIMESTAMP}.dump"
SHA="${OUT}.sha256"

mkdir -p "${BACKUP_DIR}"

command -v pg_dump >/dev/null 2>&1 || { echo "ERROR: pg_dump is required."; exit 1; }
command -v pg_restore >/dev/null 2>&1 || { echo "ERROR: pg_restore is required."; exit 1; }

echo "Creating logical backup: ${OUT}"
pg_dump "${DATABASE_URL}" \
  --format=custom \
  --no-owner \
  --no-acl \
  --file="${OUT}"

test -s "${OUT}"
echo "Verifying dump catalog..."
pg_restore --list "${OUT}" >/dev/null

if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${OUT}" > "${SHA}"
else
  shasum -a 256 "${OUT}" > "${SHA}"
fi

echo "BACKUP_OK"
echo "Dump: ${OUT}"
echo "Checksum: ${SHA}"
