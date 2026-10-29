param(
  [Parameter(Position = 0)]
  [ValidateSet('init', 'start', 'stop', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$localRoot = Join-Path $repoRoot '.local-postgres'
$dataDir = Join-Path $localRoot 'data'
$passwordFile = Join-Path $localRoot '.pw'
$logFile = Join-Path $localRoot 'server.log'
$postgresBin = 'C:\Program Files\PostgreSQL\17\bin'
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
$initDb = Join-Path $postgresBin 'initdb.exe'
$pgIsReady = Join-Path $postgresBin 'pg_isready.exe'

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw "PostgreSQL 17 was not found at $postgresBin. Install it or update postgresBin in this script."
}

if ($Action -eq 'init') {
  if (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION')) {
    Write-Host 'The isolated local PostgreSQL cluster already exists.'
    exit 0
  }
  New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
  $password = node -p "require('crypto').randomBytes(32).toString('hex')"
  if ($LASTEXITCODE -ne 0) { throw 'Could not generate a database password.' }
  Set-Content -LiteralPath $passwordFile -Value $password -NoNewline -Encoding ascii
  & $initDb -D $dataDir -U clearhold -A scram-sha-256 --pwfile=$passwordFile --encoding=UTF8 --no-instructions
  if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL cluster initialization failed.' }
  Write-Host 'Created isolated PostgreSQL cluster in .local-postgres.'
  exit 0
}

if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'PG_VERSION'))) {
  throw 'The isolated cluster does not exist. Run: .\scripts\local-db.ps1 init'
}

if ($Action -eq 'start') {
  & $pgCtl status -D $dataDir *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host 'Local PostgreSQL is already running.'
    exit 0
  }
  & $pgCtl start -D $dataDir -l $logFile -o '-p 55432 -h 127.0.0.1' -w -t 60
  if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL failed to start. Check .local-postgres/server.log.' }
  exit 0
}

if ($Action -eq 'stop') {
  & $pgCtl status -D $dataDir *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Local PostgreSQL is already stopped.'
    exit 0
  }
  & $pgCtl stop -D $dataDir -m fast -w -t 60
  if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL failed to stop.' }
  exit 0
}

& $pgCtl status -D $dataDir
& $pgIsReady -h 127.0.0.1 -p 55432
