$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Check-Command($Name) {
    $cmd = Get-Command $Name -ErrorAction SilentlyContinue
    return $null -ne $cmd
}

function Ensure-Dir($Path) {
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Parse-EnvFile($Path) {
    $result = @{}
    if (-not (Test-Path $Path)) { return $result }

    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }
        $idx = $trimmed.IndexOf('=')
        if ($idx -lt 0) { continue }
        $key = $trimmed.Substring(0, $idx).Trim()
        $value = $trimmed.Substring($idx + 1).Trim()
        if (($value.StartsWith("'") -and $value.EndsWith("'")) -or ($value.StartsWith('"') -and $value.EndsWith('"'))) {
            $value = $value.Substring(1, $value.Length - 2)
        }
        $result[$key] = $value
    }

    return $result
}

Write-Host ''
Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'MONSTER COUNTRY DJ - INSTALLER PORTABLE' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan

$checks = @(
    @{ Name = 'Node.js'; Status = Check-Command 'node'; Value = if (Check-Command 'node') { (node -v 2>$null).Trim() } else { 'MANCANTE' } },
    @{ Name = 'npm'; Status = Check-Command 'npm'; Value = if (Check-Command 'npm') { (npm -v 2>$null).Trim() } else { 'MANCANTE' } },
    @{ Name = 'Git'; Status = Check-Command 'git'; Value = if (Check-Command 'git') { (git --version 2>$null).Trim() } else { 'MANCANTE' } },
    @{ Name = 'Firebase CLI'; Status = Check-Command 'firebase'; Value = if (Check-Command 'firebase') { (firebase --version 2>$null).Trim() } else { 'MANCANTE' } }
)

foreach ($check in $checks) {
    $label = if ($check.Status) { '[OK]' } else { '[WARN]' }
    Write-Host ($label + ' ' + $check.Name + ': ' + $check.Value) -ForegroundColor $(if ($check.Status) { 'Green' } else { 'Yellow' })
}

if (-not (Check-Command 'node')) { throw 'Node.js non installato. Installare Node.js LTS.' }
if (-not (Check-Command 'npm')) { throw 'npm non installato. Installare Node.js LTS.' }

Push-Location $root
try {
    if (-not (Test-Path (Join-Path $root 'node_modules'))) {
        Write-Host '[INFO] Installazione dipendenze in corso...' -ForegroundColor Yellow
        npm install --no-fund --no-audit
    }
    else {
        Write-Host '[OK] Dipendenze gia presenti.' -ForegroundColor Green
    }
}
finally {
    Pop-Location
}

$envFile = Join-Path $root '.env'
$envExample = Join-Path $root '.env.example'
if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile -Force
        Write-Host '[OK] File .env creato dal template.' -ForegroundColor Green
    }
    else {
        Write-Host '[WARN] Nessun .env.example trovato.' -ForegroundColor Yellow
    }
}

$envValues = Parse-EnvFile $envFile
$port = if ($envValues.ContainsKey('UNIFIED_PORT')) { [int]$envValues['UNIFIED_PORT'] } else { 5500 }

foreach ($dir in @('logs', 'pids', 'videos', 'exports', 'exports/siae', 'userform-recordings', 'legacy-recordings')) {
    Ensure-Dir (Join-Path $root $dir)
}

Write-Host ('[OK] Configurazione portabile pronta. Porta target: {0}' -f $port) -ForegroundColor Green
Write-Host '[OK] Setup completo.' -ForegroundColor Green
Write-Host 'Esegui START-PORTABLE.bat per avviare il progetto.' -ForegroundColor Cyan
