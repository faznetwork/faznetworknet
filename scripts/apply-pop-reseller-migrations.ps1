[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$DatabaseUrl,

    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ExpectedDatabaseName,

    [Parameter(Mandatory = $true)]
    [switch]$ConfirmNonProductionTarget
)

$ErrorActionPreference = 'Stop'

if (-not $ConfirmNonProductionTarget) {
    throw 'Refusing migration: pass -ConfirmNonProductionTarget only after independently verifying this is a disposable/staging database.'
}

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

# Parse the URI into libpq environment variables so the database password is
# not exposed in the psql process command line.
try {
    $connectionUri = [System.Uri]::new($DatabaseUrl)
} catch {
    throw "DatabaseUrl must be a valid PostgreSQL connection URI."
}
if ($connectionUri.Scheme -notin @('postgres', 'postgresql') -or -not $connectionUri.Host) {
    throw "DatabaseUrl must use the postgres:// or postgresql:// scheme and include a host."
}

$databaseFromUri = [System.Uri]::UnescapeDataString($connectionUri.AbsolutePath.TrimStart('/'))
if ([string]::IsNullOrWhiteSpace($databaseFromUri) -or $databaseFromUri -cne $ExpectedDatabaseName) {
    throw "Database URL database name does not exactly match ExpectedDatabaseName. No migrations were executed."
}

$userInfoRaw = $connectionUri.UserInfo
$credentialSeparator = $userInfoRaw.IndexOf(':')
if ($credentialSeparator -lt 1) {
    throw "DatabaseUrl must include an explicit PostgreSQL username and password."
}
$userNameEncoded = $userInfoRaw.Substring(0, $credentialSeparator)
$passwordEncoded = $userInfoRaw.Substring($credentialSeparator + 1)

$pgNames = @('PGHOST', 'PGPORT', 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSSLMODE', 'PGAPPNAME')
$previousPgValues = @{}
foreach ($name in $pgNames) {
    $previousPgValues[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}

$tempSql = $null
try {
    $env:PGHOST = $connectionUri.DnsSafeHost
    $env:PGPORT = if ($connectionUri.IsDefaultPort -or $connectionUri.Port -lt 1) { '5432' } else { [string]$connectionUri.Port }
    $env:PGDATABASE = $databaseFromUri
    $env:PGUSER = [System.Uri]::UnescapeDataString($userNameEncoded)
    $env:PGPASSWORD = [System.Uri]::UnescapeDataString($passwordEncoded)
    $env:PGSSLMODE = $null
    $env:PGAPPNAME = 'faznetwork-pop-reseller-migration'

    foreach ($part in $connectionUri.Query.TrimStart('?').Split('&')) {
        if (-not $part) { continue }
        $separator = $part.IndexOf('=')
        if ($separator -gt 0 -and [System.Uri]::UnescapeDataString($part.Substring(0, $separator)) -eq 'sslmode') {
            $env:PGSSLMODE = [System.Uri]::UnescapeDataString($part.Substring($separator + 1))
        }
    }

    $actualDatabaseName = (& $psql.Source --no-psqlrc --tuples-only --no-align --set ON_ERROR_STOP=1 --command 'SELECT current_database();')
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
        (Join-Path $repositoryRoot 'db/migrations/20261030_reseller_email_invitations.sql'),
        (Join-Path $repositoryRoot 'db/migrations/20261030_rate_limits.sql')
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
    [System.IO.File]::WriteAllText($tempSql, $composite.ToString(), (New-Object System.Text.UTF8Encoding($false)))

    Write-Host "Verified non-production database: $actualDatabaseName"
    Write-Host 'Applying all three POP/reseller migrations in one PostgreSQL transaction...'

    & $psql.Source --no-psqlrc --set ON_ERROR_STOP=1 --single-transaction --file $tempSql
    if ($LASTEXITCODE -ne 0) {
        throw "Composite migration failed. PostgreSQL rolled back the unified transaction; inspect the psql error above."
    }

    Write-Host 'SUCCESS: all three migrations committed atomically.'
}
finally {
    if ($tempSql -and (Test-Path -LiteralPath $tempSql)) {
        Remove-Item -LiteralPath $tempSql -Force
    }
    foreach ($name in $pgNames) {
        [Environment]::SetEnvironmentVariable($name, $previousPgValues[$name], 'Process')
    }
}
