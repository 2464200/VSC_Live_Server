param(
    [switch]$NoBrowser = $false,
    [int]$PortOverride = 0
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$startupScript = Join-Path $root 'startup.ps1'

if (-not (Test-Path $startupScript)) {
    throw "Script di avvio non trovato: $startupScript"
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    throw 'Node.js non trovato nel PATH. Installare Node.js LTS e riaprire il terminale.'
}

Write-Host '[INFO] Avvio del server unificato tramite startup.ps1...' -ForegroundColor Cyan
if ($PortOverride -gt 0) {
    & $startupScript -NoWait -PortOverride $PortOverride
} else {
    & $startupScript -NoWait
}

$basePort = if ($PortOverride -gt 0) { $PortOverride } else { 5500 }
$envFile = Join-Path $root '.env'
if ($PortOverride -le 0 -and (Test-Path $envFile)) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match '^\s*UNIFIED_PORT\s*=\s*["'']?(\d+)["'']?\s*(?:#.*)?$') {
            $basePort = [int]$Matches[1]
            break
        }
    }
}

$activePort = $null
foreach ($port in $basePort..($basePort + 19)) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/health" -TimeoutSec 2
        $eventi = Invoke-RestMethod -Uri "http://127.0.0.1:$port/eventi/api/ping" -TimeoutSec 2
        if ($health.status -eq 'ok' -and $health.server -eq 'unified-server' -and $eventi.ok -eq $true) {
            $activePort = $port
            break
        }
    } catch {}
}

if (-not $activePort) {
    throw "Il server non risponde alle verifiche API sulle porte $basePort-$($basePort + 19)."
}

$url = "http://localhost:$activePort/"
Write-Host "[OK] Server pronto: $url" -ForegroundColor Green
if (-not $NoBrowser) {
    Start-Process $url
}
