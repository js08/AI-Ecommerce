# Launches an elevated PowerShell to add registry.npmjs.org to hosts (fixes ENOTFOUND when DNS is broken).
# Double-click this file or run:  .\Add-NpmHosts-Elevated.ps1
$script = Join-Path $PSScriptRoot "Add-NpmHosts-Admin.ps1"
if (-not (Test-Path $script)) {
  Write-Error "Add-NpmHosts-Admin.ps1 not found next to this script."
  exit 1
}
Start-Process powershell.exe -ArgumentList @(
  "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "`"$script`""
) -Verb RunAs -Wait
Write-Host "Done. Run: ipconfig /flushdns   then retry npm install."
