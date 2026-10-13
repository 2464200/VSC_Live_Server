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
    $activePort = & $startupScript -NoWait -PortOverride $PortOverride
} else {
    $activePort = & $startupScript -NoWait
}

if ($activePort -is [array]) {
    $activePort = $activePort | Select-Object -Last 1
}
$parsedPort = 0
if (-not [int]::TryParse([string]$activePort, [ref]$parsedPort) -or $parsedPort -lt 1 -or $parsedPort -gt 65535) {
    throw 'startup.ps1 non ha restituito una porta valida dopo le verifiche di disponibilità.'
}
$activePort = $parsedPort

$url = "http://localhost:$activePort/"
Write-Host "[OK] Server pronto: $url" -ForegroundColor Green
if (-not $NoBrowser) {
    Start-Process $url
}
