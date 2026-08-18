param(
    [switch]$NoBrowser = $false,
    [int]$PortOverride = 0
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$logsDir = Join-Path $root 'logs'
$pidDir = Join-Path $root 'pids'
$serverLog = Join-Path $logsDir 'server-portable.log'
$serverErr = Join-Path $logsDir 'server-portable.err.log'
$envFile = Join-Path $root '.env'
$envExample = Join-Path $root '.env.example'

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

function Test-PortAvailable($Port) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) { return $false }
    } catch {}

    try {
        $netStat = netstat -ano -p tcp 2>$null | Select-String -Pattern (':' + [string]$Port + '\s')
        if ($netStat) { return $false }
    } catch {}

    return $true
}

function Wait-ForHttp($Uri, $TimeoutSeconds = 30) {
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-WebRequest -Uri $Uri -Method Get -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) {
                return $true
            }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    return $false
}

Ensure-Dir $logsDir
Ensure-Dir $pidDir

if (-not (Test-Path (Join-Path $root 'package.json'))) {
    throw 'package.json non trovato nella cartella del progetto.'
}

# Crea .env da .env.example se mancante
if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile -Force
        Write-Host '[INFO] Creato .env da .env.example' -ForegroundColor Green
    }
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host '[INFO] Dipendenze mancanti. Installazione in corso...' -ForegroundColor Yellow
    Push-Location $root
    npm install --no-fund --no-audit
    Pop-Location
}

$envConfig = Parse-EnvFile (Join-Path $root '.env')
$defaultPort = if ($envConfig.ContainsKey('UNIFIED_PORT')) { [int]$envConfig['UNIFIED_PORT'] } else { 5500 }
$port = if ($PortOverride -gt 0) { $PortOverride } else { $defaultPort }

if (-not (Test-PortAvailable $port)) {
    $candidate = $port + 1
    while (-not (Test-PortAvailable $candidate) -and $candidate -lt ($port + 20)) {
        $candidate++
    }
    if ($candidate -lt ($port + 20)) {
        Write-Host ('[WARN] Porta {0} occupata. Uso fallback {1}.' -f $port, $candidate) -ForegroundColor Yellow
        $port = $candidate
    }
}

$env:UNIFIED_PORT = [string]$port
$proc = Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $root -PassThru -WindowStyle Hidden -RedirectStandardOutput $serverLog -RedirectStandardError $serverErr

if (-not $proc) {
    throw 'Impossibile avviare il server.'
}

$pidFile = Join-Path $pidDir 'portable-server.pid'
$proc.Id | Out-File -FilePath $pidFile -Encoding utf8

$uri = 'http://localhost:' + [string]$port + '/'
$ready = Wait-ForHttp $uri 25

Write-Host '========================================' -ForegroundColor Cyan
Write-Host 'MONSTER COUNTRY DJ - SERVER START' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ('[OK] Porta: {0}' -f $port) -ForegroundColor Green
Write-Host ('[OK] PID: {0}' -f $proc.Id) -ForegroundColor Green
Write-Host ('[OK] URL: {0}' -f $uri) -ForegroundColor Green
Write-Host ('[OK] Log: {0}' -f $serverLog) -ForegroundColor Green

if ($ready) {
    Write-Host '[OK] Server pronto.' -ForegroundColor Green
    if (-not $NoBrowser) {
        Start-Process $uri
    }
} else {
    Write-Host '[WARN] Il server non ha risposto entro il timeout, controlla il log.' -ForegroundColor Yellow
}
