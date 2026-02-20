######################################################################
# start-pdf-server.ps1
# Avvia il server PDF in modo intelligente e sicuro
# Usa: .\start-pdf-server.ps1 [-Port 8765] [-UsePort5500]
######################################################################

param(
    [int]$Port = 8765,
    [switch]$UsePort5500 = $false
)

if ($UsePort5500) {
    $Port = 5500
}

$ScriptPath = Join-Path $PSScriptRoot "pdf-server.js"
$PackageJsonPath = Join-Path $PSScriptRoot "package.json"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "🚀 Avvio Server PDF" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

# Verifica Node.js
Write-Host "🔍 Verifico Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = & node --version
    Write-Host "✅ Node.js trovato: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js non trovato! Installa Node.js prima di continuare." -ForegroundColor Red
    Write-Host "   Download: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Controlla se il server è già in esecuzione
Write-Host "🔍 Verifico se il server è già in esecuzione..." -ForegroundColor Cyan
$existingProcess = Get-Process node -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -like "*pdf-server*" 
}

if ($existingProcess) {
    Write-Host "⚠️  Server PDF già in esecuzione (PID: $($existingProcess.Id))" -ForegroundColor Yellow
    Write-Host "   Porta: http://127.0.0.1:8765" -ForegroundColor Cyan
    Write-Host "   Usa: .\stop-pdf-server.ps1 per fermarlo" -ForegroundColor Yellow
    exit 0
}

# Verifica file
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ File pdf-server.js non trovato: $ScriptPath" -ForegroundColor Red
    exit 1
}

# Installa dipendenze se necessario
if (Test-Path $PackageJsonPath) {
    Write-Host "📦 Verifico dipendenze npm..." -ForegroundColor Cyan
    $nodeModulesPath = Join-Path $PSScriptRoot "node_modules"
    
    if (-not (Test-Path $nodeModulesPath)) {
        Write-Host "   Installo dipendenze (questo potrebbe richiedere un momento)..." -ForegroundColor Yellow
        & npm install --silent 2>&1 | Out-Null
        
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  npm install ha avuto problemi, tentando di continuare..." -ForegroundColor Yellow
        } else {
            Write-Host "✅ Dipendenze installate" -ForegroundColor Green
        }
    } else {
        Write-Host "✅ Dipendenze già installate" -ForegroundColor Green
    }
}

# Avvia il server in background
Write-Host "`n🚀 Avviamento server sulla porta $Port..." -ForegroundColor Green
$env:PDF_SERVER_PORT = $Port

# Avvia il processo
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "node"
$psi.Arguments = $ScriptPath
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $false
$psi.Environment["PDF_SERVER_PORT"] = $Port

$process = [System.Diagnostics.Process]::Start($psi)

if ($process) {
    Write-Host "✅ Server avviato" -ForegroundColor Green
    Write-Host "   PID: $($process.Id)" -ForegroundColor Cyan
    Write-Host "   URL: http://127.0.0.1:$Port" -ForegroundColor Cyan
    Write-Host "   API: http://127.0.0.1:$Port/api/pdf-list" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor Cyan
    Write-Host "💡 Per fermare: .\stop-pdf-server.ps1" -ForegroundColor Yellow
    Write-Host "💡 Per i log: Guarda la finestra sepxarata del server" -ForegroundColor Yellow
    Write-Host "" -ForegroundColor Cyan
} else {
    Write-Host "❌ Errore nell'avvio del server" -ForegroundColor Red
    exit 1
}
