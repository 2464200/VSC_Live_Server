# Script di automazione per aggiornamento ambiente di sviluppo e dipendenze
# VSC Live Server - Auto Update Script

param (
    [switch]$SkipRestart,
    [switch]$NoWinget
)

$ErrorActionPreference = 'Continue'
$workspaceFolder = $PSScriptRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "   Aggiornamento Automatico Ambiente di Sviluppo" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Arresto temporaneo dei server per liberare le librerie (node_modules, process locks)
if (Test-Path (Join-Path $workspaceFolder "shutdown.ps1")) {
    Write-Host "[1/5] Arresto temporaneo dei server in corso..." -ForegroundColor Yellow
    & (Join-Path $workspaceFolder "shutdown.ps1")
    Start-Sleep -Seconds 1
} else {
    Write-Host "[1/5] Shutdown script non trovato, proseguo..." -ForegroundColor Gray
}

# 2. Aggiornamento Software di Sistema via Winget
if (-not $NoWinget) {
    Write-Host "[2/5] Controllo ed aggiornamento software di sistema (Winget)..." -ForegroundColor Yellow
    try {
        winget upgrade Python.Python.3.14 Node.js Git "Visual Studio Code" --accept-source-agreements --accept-package-agreements
    } catch {
        Write-Host "Avviso durante winget upgrade: $_" -ForegroundColor Red
    }
} else {
    Write-Host "[2/5] Salto aggiornamento Winget (flag -NoWinget)." -ForegroundColor Gray
}

# 3. Aggiornamento Python pip
Write-Host "[3/5] Aggiornamento pip per Python..." -ForegroundColor Yellow
try {
    python -m pip install --upgrade pip
} catch {
    Write-Host "Avviso durante aggiornamento pip: $_" -ForegroundColor Red
}

# 4. Aggiornamento dipendenze npm locali
Write-Host "[4/5] Aggiornamento dipendenze npm del progetto..." -ForegroundColor Yellow
try {
    Set-Location $workspaceFolder
    npm update
} catch {
    Write-Host "Avviso durante npm update: $_" -ForegroundColor Red
}

# 5. Riavvio dei Server
if (-not $SkipRestart -and (Test-Path (Join-Path $workspaceFolder "startup.ps1"))) {
    Write-Host "[5/5] Riavvio del sistema e dei server..." -ForegroundColor Green
    & (Join-Path $workspaceFolder "startup.ps1")
} else {
    Write-Host "[5/5] Riavvio del server ignorato o completato." -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "          Aggiornamento Completato con Successo!" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
