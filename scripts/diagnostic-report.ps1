$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Check-Command($Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    return $null -ne $cmd
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'MONSTER COUNTRY DJ - DIAGNOSTIC REPORT' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan

$checks = @(
    @{ Label = 'Windows'; Value = $env:OS; Ok = $true },
    @{ Label = 'Node.js'; Value = if (Check-Command 'node') { (node -v 2>$null).Trim() } else { 'MANCANTE' }; Ok = (Check-Command 'node') },
    @{ Label = 'npm'; Value = if (Check-Command 'npm') { (npm -v 2>$null).Trim() } else { 'MANCANTE' }; Ok = (Check-Command 'npm') },
    @{ Label = 'Git'; Value = if (Check-Command 'git') { (git --version 2>$null).Trim() } else { 'MANCANTE' }; Ok = (Check-Command 'git') },
    @{ Label = 'Firebase CLI'; Value = if (Check-Command 'firebase') { (firebase --version 2>$null).Trim() } else { 'MANCANTE' }; Ok = (Check-Command 'firebase') },
    @{ Label = 'Dependencies'; Value = if (Test-Path (Join-Path $root 'node_modules')) { 'Presenti' } else { 'Mancanti' }; Ok = (Test-Path (Join-Path $root 'node_modules')) },
    @{ Label = '.env'; Value = if (Test-Path (Join-Path $root '.env')) { 'Presente' } else { 'Mancante' }; Ok = (Test-Path (Join-Path $root '.env')) },
    @{ Label = 'Config'; Value = if (Test-Path (Join-Path $root 'config\config.js')) { 'Presente' } else { 'Mancante' }; Ok = (Test-Path (Join-Path $root 'config\config.js')) },
    @{ Label = 'Port 5500'; Value = if ((Get-NetTCPConnection -LocalPort 5500 -ErrorAction SilentlyContinue)) { 'Occupata' } else { 'Libera' }; Ok = -not (Get-NetTCPConnection -LocalPort 5500 -ErrorAction SilentlyContinue) }
)

foreach ($check in $checks) {
    $label = if ($check.Ok) { '[OK]' } else { '[WARN]' }
    Write-Host ($label + ' ' + $check.Label + ': ' + $check.Value) -ForegroundColor $(if ($check.Ok) { 'Green' } else { 'Yellow' })
}

Write-Host ''
Write-Host 'Project root: ' + $root -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
