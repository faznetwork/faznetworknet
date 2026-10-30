[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$DatabaseUrl,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ExpectedDatabaseName
)

$ErrorActionPreference = 'Stop'

# This runner is intentionally restricted to explicitly named staging/test databases.
# It never reads DATABASE_URL implicitly and refuses production-like database names.
if ($ExpectedDatabaseName -notmatch '(?i)(stage|staging|test|disposable)' -or
    $ExpectedDatabaseName -match '(?i)(prod|production|live)') {
    throw "Refusing migration: ExpectedDatabaseName must clearly identify a non-production staging/test database."
}

$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psql) {
    throw "PostgreSQL client 'psql' was not found in PATH. Install PostgreSQL client tools and retry."
}

$actualDatabaseName = (& $psql.Source $DatabaseUrl --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command 'SELECT current_database();')
if ($LASTEXITCODE -ne 0) {
    throw "Could not verify the target PostgreSQL database. No migrations were executed."
}
$actualDatabaseName = ([string]$actualDatabaseName).Trim()
if ($actualDatabaseName -cne $ExpectedDatabaseName) {
    throw "Database target mismatch. Expected '$ExpectedDatabaseName' but connected to '$actualDatabaseName'. No migrations were executed."
}
if ($actualDatabaseName -match '(?i)(prod|production|live)') {
    throw "Refusing migration against a production-like database name."
}

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$migrationFiles = @(
    (Join-Path $repositoryRoot 'db/migrations/20261030_pop_reseller_architecture.sql'),
    (Join-Path $repositoryRoot 'db/migrations/20261030_reseller_email_invitations.sql')
)

$composite = New-Object System.Text.StringBuilder
[void]$composite.AppendLine('-- Generated in memory by scripts/apply-pop-reseller-migrations.ps1.')
[void]$composite.AppendLine('-- Original migration files are not modified.')
[void]$composite.AppendLine('-- psql --single-transaction owns the single atomic transaction.')

foreach ($migrationFile in $migrationFiles) {
    if (-not (Test-Path -LiteralPath $migrationFile -PathType Leaf)) {
        throw "Required migration file is missing: $migrationFile"
    }

    $sql = [System.IO.File]::ReadAllText($migrationFile)
    $beginMatches = [regex]::Matches($sql, '(?im)^\s*BEGIN\s*;\s*(?:--[^\r\n]*)?$')
    $commitMatches = [regex]::Matches($sql, '(?im)^\s*COMMIT\s*;\s*(?:--[^\r\n]*)?$')
    if ($beginMatches.Count -ne 1 -or $commitMatches.Count -ne 1) {
        throw "Migration '$migrationFile' must contain exactly one standalone BEGIN; and COMMIT; marker. Refusing unsafe composition."
    }

    $sql = [regex]::Replace($sql, '(?im)^\s*BEGIN\s*;\s*(?:--[^\r\n]*)?$', '-- BEGIN omitted: outer psql transaction')
    $sql = [regex]::Replace($sql, '(?im)^\s*COMMIT\s*;\s*(?:--[^\r\n]*)?$', '-- COMMIT omitted: outer psql transaction')
    [void]$composite.AppendLine()
    [void]$composite.AppendLine('-- >>> ' + [System.IO.Path]::GetFileName($migrationFile))
    [void]$composite.AppendLine($sql)
    [void]$composite.AppendLine('-- <<< ' + [System.IO.Path]::GetFileName($migrationFile))
}

$tempSql = Join-Path ([System.IO.Path]::GetTempPath()) ('faz-pop-reseller-' + [guid]::NewGuid().ToString('N') + '.sql')
try {
    [System.IO.File]::WriteAllText($tempSql, $composite.ToString(), (New-Object System.Text.UTF8Encoding($false)))

    Write-Host "Verified non-production database: $actualDatabaseName"
    Write-Host 'Applying both POP/reseller migrations in one PostgreSQL transaction...'

    & $psql.Source $DatabaseUrl --no-psqlrc --set ON_ERROR_STOP=1 --single-transaction --file $tempSql
    if ($LASTEXITCODE -ne 0) {
        throw "Composite migration failed. PostgreSQL rolled back the unified transaction; inspect the psql error above."
    }

    Write-Host 'SUCCESS: both migrations committed atomically.'
}
finally {
    if (Test-Path -LiteralPath $tempSql) {
        Remove-Item -LiteralPath $tempSql -Force
    }
}
