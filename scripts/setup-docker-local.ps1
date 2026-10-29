$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$target = Join-Path $projectRoot '.env.deploy'
if (Test-Path -LiteralPath $target) {
  throw '.env.deploy already exists. It was not changed; keep its existing keys and database password.'
}

function New-Secret {
  $bytes = [byte[]]::new(32)
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
  return [Convert]::ToHexString($bytes).ToLowerInvariant()
}

$postgresPassword = New-Secret
$nextAuthSecret = New-Secret
$masterKey = New-Secret
$idempotencyHashKey = New-Secret
$schedulerSecret = New-Secret

$content = @"
# Local Docker Desktop only. This file is ignored by Git. Keep it for future restarts.
POSTGRES_PASSWORD=$postgresPassword
PUBLIC_URL=http://localhost:8080
SITE_ADDRESS=:80
BIND_ADDRESS=127.0.0.1
HTTP_PORT=8080
HTTPS_PORT=8443
NEXTAUTH_SECRET=$nextAuthSecret
MASTER_KEY=$masterKey
IDEMPOTENCY_HASH_KEY=$idempotencyHashKey
SCHEDULER_SECRET=$schedulerSecret
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
"@

[System.IO.File]::WriteAllText($target, $content, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Created ignored .env.deploy with independent random secrets for localhost.'
Write-Host 'Do not regenerate it after data has been stored; that would change the database password and encryption key.'
