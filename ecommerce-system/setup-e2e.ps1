#Requires -Version 5.1
<#
  Full setup: portable Node in tools\, npm installs, optional Docker infra, start all services.
  Run from PowerShell:  cd <path>\ecommerce-system
                         .\setup-e2e.ps1 -StartAll
#>
param(
  [switch]$StartAll,
  [switch]$SkipDocker,
  [int]$MaxRetries = 8
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$NodeHome = Join-Path (Split-Path $Root -Parent) "tools\node-v20.18.0-win-x64"
$NodeExe = Join-Path $NodeHome "node.exe"

if (-not (Test-Path $NodeExe)) {
  Write-Host "Portable Node not found at $NodeHome"
  Write-Host "Download node-v20.18.0-win-x64.zip from https://nodejs.org/dist/v20.18.0/ extract to tools\"
  exit 1
}

$env:Path = "$NodeHome;$env:Path"
Set-Location $Root

function Npm-InstallWithRetry {
  param([string]$Dir)
  Set-Location $Dir
  for ($r = 1; $r -le $MaxRetries; $r++) {
    Write-Host "[try $r/$MaxRetries] npm install in $Dir"
    & npm.cmd install --no-fund --no-audit 2>&1 | Write-Host
    if ($LASTEXITCODE -eq 0) { Set-Location $Root; return $true }
    Start-Sleep -Seconds (5 * $r)
  }
  Set-Location $Root
  return $false
}

# Optional: Docker Desktop
$docker = $null
foreach ($c in @(
  "docker",
  "${env:ProgramFiles}\Docker\Docker\resources\bin\docker.exe",
  "${env:ProgramFiles(x86)}\Docker\Docker\resources\bin\docker.exe"
)) {
  if (Get-Command $c -ErrorAction SilentlyContinue) { $docker = (Get-Command $c).Source; break }
  if ($c -like "*\*" -and (Test-Path $c)) { $docker = $c; break }
}

if (-not $SkipDocker -and $docker) {
  Write-Host "Starting Docker Compose services..."
  Push-Location $Root
  & $docker compose up -d 2>&1 | Write-Host
  Pop-Location
  Start-Sleep -Seconds 15
} elseif (-not $SkipDocker) {
  Write-Host "Docker not found: start Postgres/Redis/Kafka/ES manually or install Docker Desktop."
}

$dirs = @(
  ".",
  "api-gateway",
  "user-service",
  "product-service",
  "cart-service",
  "order-service",
  "payment-service",
  "inventory-service",
  "notification-service",
  "ai-service",
  "microservices-dashboard"
)

$failed = @()
foreach ($d in $dirs) {
  $full = Join-Path $Root $d
  if (-not (Test-Path $full)) { continue }
  if (-not (Npm-InstallWithRetry -Dir $full)) { $failed += $d }
}

if ($failed.Count -gt 0) {
  Write-Host "FAILED installs: $($failed -join ', ')" -ForegroundColor Red
  Write-Host ""
  Write-Host "If you see ENOTFOUND registry.npmjs.org:" -ForegroundColor Yellow
  Write-Host "  Run as Administrator: .\Add-NpmHosts-Admin.ps1"
  Write-Host "  Or: .\Add-NpmHosts-Elevated.ps1  (UAC), then: ipconfig /flushdns"
  Write-Host "If you see ETIMEDOUT or HTTPS fails:" -ForegroundColor Yellow
  Write-Host "  Allow outbound TCP 443, disable blocking VPN/firewall, or use npm proxy / another network."
  Write-Host ""
  exit 1
}

Write-Host "All npm installs OK." -ForegroundColor Green

if ($StartAll) {
  $env:Path = "$NodeHome;$env:Path"
  Set-Location $Root
  Write-Host "Starting all Node processes (gateway + 8 services + AI + dashboard)..."
  & npm.cmd run start:all
}
