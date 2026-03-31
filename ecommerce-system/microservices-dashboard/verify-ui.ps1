# Automated smoke test: starts the CRA dev server briefly and checks HTTP 200 + HTML shell.
# Requires Node.js on PATH. Run: powershell -ExecutionPolicy Bypass -File .\verify-ui.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "ERROR: Node.js is not in PATH. Install from https://nodejs.org then re-run."
  exit 1
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Running npm install..."
  npm install
}

$port = 3001
if (Test-Path ".env") {
  foreach ($line in Get-Content ".env") {
    if ($line -match '^\s*PORT\s*=\s*(\d+)') { $port = [int]$Matches[1]; break }
  }
}

$env:CI = "true"
$env:BROWSER = "none"
$env:PORT = "$port"

Write-Host "Starting react-scripts (child process)..."
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "cmd.exe"
$psi.Arguments = "/c npm start"
$psi.WorkingDirectory = $PSScriptRoot
$psi.UseShellExecute = $false
$psi.CreateNoWindow = $true
$p = [System.Diagnostics.Process]::Start($psi)

$url = "http://127.0.0.1:$port/"
$ok = $false
try {
  for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try {
      $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 8
      if ($r.StatusCode -eq 200 -and $r.Content.Length -gt 100) {
        $ok = $true
        Write-Host "OK: GET $url returned $($r.StatusCode), body length $($r.Content.Length)"
        break
      }
    } catch { }
    Write-Host "  waiting... ($($i+1)/60)"
  }
} finally {
  if (-not $p.HasExited) {
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
  }
  Get-CimInstance Win32_Process -Filter "ParentProcessId=$($p.Id)" -ErrorAction SilentlyContinue |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

if ($ok) {
  Write-Host ""
  Write-Host "Smoke test passed. For a full browser check, run: npm start"
  Write-Host "Then open http://localhost:$port/ in Chrome/Edge and confirm the dashboard loads."
  exit 0
}

Write-Host "FAIL: Dev server did not respond in time."
exit 1
