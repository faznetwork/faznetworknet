$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) { throw "DATABASE_URL is required" }

$BackupDir = if ($env:BACKUP_DIR) { $env:BACKUP_DIR } else { ".\backups\postgres" }
$Timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddTHHmmssZ")
$Out = Join-Path $BackupDir "faznetwork-postgres-$Timestamp.dump"
$Sha = "$Out.sha256"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

if (-not (Get-Command pg_dump -ErrorAction SilentlyContinue)) { throw "pg_dump is required." }
if (-not (Get-Command pg_restore -ErrorAction SilentlyContinue)) { throw "pg_restore is required." }

Write-Host "Creating logical backup: $Out"
& pg_dump $env:DATABASE_URL --format=custom --no-owner --no-acl --file=$Out
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed." }

if ((Get-Item $Out).Length -le 0) { throw "Backup file is empty." }

Write-Host "Verifying dump catalog..."
& pg_restore --list $Out | Out-Null
if ($LASTEXITCODE -ne 0) { throw "pg_restore verification failed." }

$hash = (Get-FileHash -Algorithm SHA256 $Out).Hash
"$hash  $Out" | Set-Content -Encoding ASCII $Sha

Write-Host "BACKUP_OK"
Write-Host "Dump: $Out"
Write-Host "Checksum: $Sha"
