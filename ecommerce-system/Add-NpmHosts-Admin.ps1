# Run this script AS ADMINISTRATOR once if npm fails with ENOTFOUND registry.npmjs.org
# Right-click PowerShell -> Run as administrator, then:
#   cd "c:\xampp\htdocs\Jurasic Tek Automation\AI-Ecommerce\ecommerce-system"
#   .\Add-NpmHosts-Admin.ps1

$hostsPath = "$env:WINDIR\System32\drivers\etc\hosts"
$lines = @(
  "",
  "# AI-Ecommerce npm (Cloudflare anycast for registry.npmjs.org)",
  "104.16.4.34 registry.npmjs.org",
  "104.16.5.34 registry.npmjs.org"
)

$existing = Get-Content $hostsPath -Raw -ErrorAction SilentlyContinue
if ($existing -match "registry\.npmjs\.org") {
  Write-Host "registry.npmjs.org already listed in hosts."
  exit 0
}

Add-Content -Path $hostsPath -Value ($lines -join "`r`n") -Encoding ascii
Write-Host "hosts file updated. Test: ping registry.npmjs.org"
ipconfig /flushdns | Out-Null
