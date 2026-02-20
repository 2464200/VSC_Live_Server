######################################################################
# start-server-manager.ps1
# Avvia il Server Manager che gestisce il ciclo di vita del PDF Server
# 
# Il Server Manager rimane in ascolto e consente auto-start/stop del PDF Server
# quando viene richiesto dalle pagine HTML
######################################################################

Write-Host "`n" -ForegroundColor Cyan
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║              Avvio Server Manager                          ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

param(
    [int]$Port = 3000
)

$ScriptPath = Join-Path $PSScriptRoot "server-manager.js"
$PackageJsonPath = Join-Path $PSScriptRoot "package.json"

# Verifica Node.js
Write-Host "🔍 Verifico Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = & node --version
    Write-Host "✅ Node.js trovato: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js non trovato! Installa Node.js prima di continuare." -ForegroundColor Red
    exit 1
}

# Controlla se il server è già in esecuzione
Write-Host "🔍 Verifico se il manager è già in esecuzione..." -ForegroundColor Cyan
$existingProcess = Get-Process node -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -like "*server-manager*" 
}

if ($existingProcess) {
    Write-Host "⚠️  Server Manager già in esecuzione (PID: $($existingProcess.Id))" -ForegroundColor Yellow
    Write-Host "   Porta: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "   Usa: stop-server-manager.ps1 per fermarlo" -ForegroundColor Yellow
    exit 0
}

# Verifica file
if (-not (Test-Path $ScriptPath)) {
    Write-Host "❌ File server-manager.js non trovato: $ScriptPath" -ForegroundColor Red
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

# Avvia il server manager
Write-Host "`n🚀 Avviamento Server Manager sulla porta $Port..." -ForegroundColor Green
$env:MANAGER_PORT = $Port

# Crea un processo visibile
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "node"
$psi.Arguments = $ScriptPath
$psi.UseShellExecute = $true
$psi.CreateNoWindow = $false
$psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Normal
$psi.Environment["MANAGER_PORT"] = $Port

$process = [System.Diagnostics.Process]::Start($psi)

if ($process) {
    Write-Host "✅ Server Manager avviato" -ForegroundColor Green
    Write-Host "   PID: $($process.Id)" -ForegroundColor Cyan
    Write-Host "   URL: http://localhost:$Port" -ForegroundColor Cyan
    Write-Host "   API: http://localhost:$Port/api/manager/status" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor Cyan
    Write-Host "📝 Funzionalità:" -ForegroundColor Yellow
    Write-Host "   - Gestisce l'avvio/arresto automatico del PDF Server" -ForegroundColor Cyan
    Write-Host "   - Monitora l'inattività (30 secondi)" -ForegroundColor Cyan
    Write-Host "   - Mantiene il server attivo mentre è in uso" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor Cyan
    Write-Host "💡 Usa questo con ScriptPDF1.html:" -ForegroundColor Yellow
    Write-Host "   1. Apri: http://localhost:5500/Prova/ScriptPDF1.html" -ForegroundColor Cyan
    Write-Host "   2. La pagina AUTOMATICAMENTE:" -ForegroundColor Cyan
    Write-Host "      - Rileva il Manager" -ForegroundColor Cyan
    Write-Host "      - Avvia il PDF Server se necessario" -ForegroundColor Cyan
    Write-Host "      - Lo mantiene attivo mentre usi la pagina" -ForegroundColor Cyan
    Write-Host "      - Lo spegne quando chiudi la pagina" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor Cyan
    Write-Host "🛑 Per fermare:" -ForegroundColor Yellow
    Write-Host "   Esegui: .\stop-server-manager.ps1" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor Cyan
} else {
    Write-Host "❌ Errore nell'avvio del Server Manager" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Server Manager attivo!" -ForegroundColor Green
