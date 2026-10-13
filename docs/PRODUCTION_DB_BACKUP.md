# FAZ NETWORK Production PostgreSQL Backup

This is a logical backup procedure for the Production PostgreSQL database.

## Safety rules

- Never run destructive SQL against Production.
- Do not commit `DATABASE_URL`, passwords, or dump files to Git.
- Do not stop or delete the Render database until a backup has been created and a restore test has succeeded.
- Keep at least two independent copies of a verified dump.

## 1. Get the Production DATABASE_URL

Use the Production database's connection details from the hosting provider. Store it only as a local environment variable named `DATABASE_URL`; do not paste it into source code or commit it.

For Render, external access must be permitted for the computer that runs `pg_dump`. The database currently has an empty IP allowlist, so `pg_dump` cannot connect until that networking restriction is addressed.

## 2. Create the backup

Linux/macOS:
```bash
export DATABASE_URL='postgresql://...'
bash scripts/backup-postgres.sh
```

Windows PowerShell:
```powershell
$env:DATABASE_URL = "postgresql://..."
.\scripts\backup-postgres.ps1
```

The script creates a PostgreSQL custom-format dump and a SHA-256 checksum under `backups/postgres/`.

## 3. Verify

The script automatically runs `pg_restore --list`. A successful run prints `BACKUP_OK`.

Then copy the `.dump` and matching `.sha256` to a second safe location. Never commit them to Git.

## 4. Restore test

A real restore test must be performed against a separate, disposable PostgreSQL database before Production is retired. Do not restore over Production.

Only after the restore test succeeds should the Render database be considered safe to retire.
