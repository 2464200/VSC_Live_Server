param(
    [switch]$CheckOnly = $false,
    [switch]$NoBrowser = $false
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$packageJson = Join-Path $root 'package.json'
$envExample = Join-Path $root '.env.example'
$envFile = Join-Path $root '.env'

function Write-Section($title) {
    Write-Host ''
    Write-Host '========================================' -ForegroundColor Cyan
    Write-Host $title -ForegroundColor Cyan
    Write-Host '========================================' -ForegroundColor Cyan
}

function Test-Command($name) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($null -eq $cmd) { return $false }
    return $true
}

function Parse-EnvFile($path) {
    $result = @{}
    if (-not (Test-Path $path)) { return $result }

    foreach ($line in Get-Content $path) {
        $trimmed = $line.Trim()
        if (-not $trimmed -or $trimmed.StartsWith('#')) { continue }

        $idx = $trimmed.IndexOf('=')
        if ($idx -le 0) { continue }

        $key = $trimmed.Substring(0, $idx).Trim()
        $value = $trimmed.Substring($idx + 1).Trim()
        if ($value.Length -ge 2) {
            if (($value.StartsWith("'") -and $value.EndsWith("'")) -or ($value.StartsWith('"') -and $value.EndsWith('"'))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
        }

        $result[$key] = $value
    }

    return $result
}

function Test-PortAvailable($Port) {
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if ($connections) { return $false }
    }
    catch {}

    try {
        $pattern = ':' + [string]$Port + '\s'
        $netStat = netstat -ano -p tcp 2>$null | Select-String -Pattern $pattern
        if ($netStat) { return $false }
    }
    catch {}

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
        }
        catch {
        }
        Start-Sleep -Milliseconds 500
    }

    return $false
}

Write-Section 'MONSTER COUNTRY DJ SYSTEM'
Write-Host 'Verifica ambiente Windows e avvio automatico'

if (-not (Test-Path $packageJson)) {
    throw 'package.json non trovato nella cartella del progetto.'
}

$checks = @()
$checks += [pscustomobject]@{ Name = 'Node.js'; Ok = (Test-Command 'node'); Detail = if (Test-Command 'node') { (node -v 2>$null).Trim() } else { 'MANCANTE' } }
$checks += [pscustomobject]@{ Name = 'npm'; Ok = (Test-Command 'npm'); Detail = if (Test-Command 'npm') { (npm -v 2>$null).Trim() } else { 'MANCANTE' } }
$checks += [pscustomobject]@{ Name = 'Git'; Ok = (Test-Command 'git'); Detail = if (Test-Command 'git') { (git --version 2>$null).Trim() } else { 'MANCANTE' } }
$checks += [pscustomobject]@{ Name = 'Firebase CLI'; Ok = (Test-Command 'firebase'); Detail = if (Test-Command 'firebase') { (firebase --version 2>$null).Trim() } else { 'MANCANTE' } }
$checks += [pscustomobject]@{ Name = 'Project files'; Ok = (Test-Path $packageJson); Detail = $packageJson }

foreach ($item in $checks) {
    $color = if ($item.Ok) { 'Green' } else { 'Yellow' }
    Write-Host ('[{0}] {1}: {2}' -f $(if ($item.Ok) { 'OK' } else { 'WARN' }), $item.Name, $item.Detail) -ForegroundColor $color
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
    Write-Host '[INFO] Dipendenze mancanti: eseguo npm install...' -ForegroundColor Yellow
    Push-Location $root
    try {
        npm install --no-fund --no-audit
        if ($LASTEXITCODE -ne 0) { throw 'npm install fallito' }
    }
    finally {
        Pop-Location
    }
}

if (-not (Test-Path $envFile)) {
    if (Test-Path $envExample) {
        Copy-Item $envExample $envFile -Force
        Write-Host '[INFO] Creato .env da .env.example' -ForegroundColor Green
    }
    else {
        Write-Host '[WARN] Nessun file .env.example trovato' -ForegroundColor Yellow
    }
}

$envValues = Parse-EnvFile $envFile
$port = if ($envValues.ContainsKey('UNIFIED_PORT')) { [int]$envValues['UNIFIED_PORT'] } else { 5500 }

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

if (-not (Test-Path (Join-Path $root 'scripts\diagnostic-check.js'))) {
    throw 'Script di diagnostica non trovato.'
}

if (-not $CheckOnly) {
    Write-Section 'SERVER START'
    Write-Host ('[OK] Porta disponibile: {0}' -f $port) -ForegroundColor Green
    Write-Host ('[OK] Avvio server su http://localhost:{0}' -f $port) -ForegroundColor Green

    Push-Location $root
    $proc = Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory $root -PassThru -WindowStyle Normal
    Pop-Location

    if ($proc) {
        Write-Host ('[OK] Processo avviato PID: {0}' -f $proc.Id) -ForegroundColor Green
    }

    $uri = 'http://localhost:' + [string]$port + '/'
    $ready = Wait-ForHttp $uri 25
    if ($ready) {
        Write-Host ('[OK] Server pronto: {0}' -f $uri) -ForegroundColor Green
        if (-not $NoBrowser) {
            Start-Process $uri
        }
    }
    else {
        Write-Host ('[WARN] Server avviato ma non risponde entro 25s: {0}' -f $uri) -ForegroundColor Yellow
    }

    Write-Section 'PROGETTO PRONTO'
    Write-Host ('URL: http://localhost:{0}' -f $port) -ForegroundColor Green
    Write-Host 'Premere un tasto per chiudere questa finestra...' -ForegroundColor Gray
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
}
else {
    Write-Section 'CHECK COMPLETED'
    Write-Host ('[OK] Setup verificato. Porta prevista: {0}' -f $port) -ForegroundColor Green
    Write-Host 'Nessun avvio eseguito in modalita CheckOnly.' -ForegroundColor Gray
}
