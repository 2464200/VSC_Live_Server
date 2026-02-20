######################################################################
# launch-all.ps1
# Script master per avviare l'intera soluzione:
# - Live Server (5500)
# - Server Manager (3000) 
# - Gestione automatica PDF Server (8765)
######################################################################

Write-Host "`n" -ForegroundColor Cyan
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          Avvio Completo della Soluzione                    ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Colori
$ColorSuccess = "Green"
$ColorInfo = "Cyan"
$ColorWarning = "Yellow"
$ColorError = "Red"

# Variabili
$RootPath = $PSScriptRoot
$LiveServerPort = 5500
$ManagerPort = 3000
$PdfServerPort = 8765

Write-Host "📁 Cartella progetto: $RootPath" -ForegroundColor $ColorInfo
Write-Host "🌐 Live Server porta: $LiveServerPort" -ForegroundColor $ColorInfo
Write-Host "🎯 Server Manager porta: $ManagerPort" -ForegroundColor $ColorInfo
Write-Host "📄 PDF Server porta: $PdfServerPort (gestito automaticamente)" -ForegroundColor $ColorInfo
Write-Host ""

# Funzione per controllare porta
function Test-PortAvailable {
    param([int]$Port)
    try {
        $test = [System.Net.Sockets.TcpClient]::new()
        $test.Connect("127.0.0.1", $Port)
        $test.Close()
        return $false
    } catch {
        return $true
    }
}

# Verifica Node.js
Write-Host "🔍 Verifico Node.js..." -ForegroundColor $ColorInfo
$nodeVersion = & node --version -ErrorAction SilentlyContinue
if ($nodeVersion) {
    Write-Host "✅ Node.js trovato: $nodeVersion" -ForegroundColor $ColorSuccess
} else {
    Write-Host "❌ Node.js non trovato!" -ForegroundColor $ColorError
    Write-Host "   Download: https://nodejs.org/" -ForegroundColor $ColorWarning
    exit 1
}

# Verifica npm
Write-Host "🔍 Verifico npm..." -ForegroundColor $ColorInfo
$npmVersion = & npm --version -ErrorAction SilentlyContinue
if ($npmVersion) {
    Write-Host "✅ npm trovato: v$npmVersion" -ForegroundColor $ColorSuccess
} else {
    Write-Host "❌ npm non trovato!" -ForegroundColor $ColorError
    exit 1
}

# Installa dipendenze se necessario
Write-Host "`n📦 Verifico dipendenze..." -ForegroundColor $ColorInfo
$nodeModulesPath = Join-Path $RootPath "node_modules"
if (-not (Test-Path $nodeModulesPath)) {
    Write-Host "   Installo pacchetti npm (questo potrebbe richiedere un momento)..." -ForegroundColor $ColorWarning
    & npm install --silent 2>&1 | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Dipendenze installate" -ForegroundColor $ColorSuccess
    } else {
        Write-Host "⚠️  Errore durante npm install" -ForegroundColor $ColorWarning
    }
} else {
    Write-Host "✅ Dipendenze già presenti" -ForegroundColor $ColorSuccess
}

# Verifica porte disponibili
Write-Host "`n🔍 Verifico disponibilità porte..." -ForegroundColor $ColorInfo
$liveServerAvailable = Test-PortAvailable -Port $LiveServerPort
$managerAvailable = Test-PortAvailable -Port $ManagerPort
$pdfServerAvailable = Test-PortAvailable -Port $PdfServerPort

if ($liveServerAvailable) {
    Write-Host "✅ Porta $LiveServerPort disponibile" -ForegroundColor $ColorSuccess
} else {
    Write-Host "⚠️  Porta $LiveServerPort occupata" -ForegroundColor $ColorWarning
}

if ($managerAvailable) {
    Write-Host "✅ Porta $ManagerPort disponibile" -ForegroundColor $ColorSuccess
} else {
    Write-Host "⚠️  Porta $ManagerPort occupata" -ForegroundColor $ColorWarning
}

if ($pdfServerAvailable) {
    Write-Host "✅ Porta $PdfServerPort disponibile" -ForegroundColor $ColorSuccess
} else {
    Write-Host "⚠️  Porta $PdfServerPort occupata" -ForegroundColor $ColorWarning
}

# Avvia Live Server
Write-Host "`n🌐 Avvio Live Server..." -ForegroundColor $ColorInfo
if ($liveServerAvailable) {
    try {
        Write-Host "   Comando: npx http-server -c-1 -p $LiveServerPort" -ForegroundColor $ColorInfo
        Start-Process -FilePath "npx" -ArgumentList "http-server -c-1 -p $LiveServerPort" `
            -WorkingDirectory $RootPath -NoNewWindow
        Write-Host "✅ Live Server avviato su http://localhost:$LiveServerPort" -ForegroundColor $ColorSuccess
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "❌ Errore nell'avvio di Live Server: $_" -ForegroundColor $ColorError
    }
} else {
    Write-Host "⚠️  Porta $LiveServerPort occupata, skipping Live Server" -ForegroundColor $ColorWarning
}

# Avvia Server Manager
Write-Host "`n🎯 Avvio Server Manager..." -ForegroundColor $ColorInfo
if ($managerAvailable) {
    try {
        $managerPath = Join-Path $RootPath "start-server-manager.ps1"
        if (Test-Path $managerPath) {
            & $managerPath
            Write-Host "✅ Server Manager avviato su http://localhost:$ManagerPort" -ForegroundColor $ColorSuccess
        } else {
            Write-Host "❌ Script start-server-manager.ps1 non trovato" -ForegroundColor $ColorError
        }
    } catch {
        Write-Host "❌ Errore nell'avvio di Server Manager: $_" -ForegroundColor $ColorError
    }
} else {
    Write-Host "⚠️  Porta $ManagerPort occupata, skipping Server Manager" -ForegroundColor $ColorWarning
}

# Riepilogo
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor $ColorSuccess
Write-Host "║                    🎉 AVVIO COMPLETATO                      ║" -ForegroundColor $ColorSuccess
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor $ColorSuccess
Write-Host ""
Write-Host "📍 URL per accedere all'applicazione:" -ForegroundColor $ColorInfo
Write-Host "   🏠 Home page:           http://localhost:$LiveServerPort/index.html" -ForegroundColor $ColorSuccess
Write-Host "   📊 Servizio:            http://localhost:$LiveServerPort/servizio2.html" -ForegroundColor $ColorSuccess
Write-Host "   📄 Gestione PDF:        http://localhost:$LiveServerPort/Prova/ScriptPDF1.html" -ForegroundColor $ColorSuccess
Write-Host "   🔍 Diagnostica:         http://localhost:$LiveServerPort/diagnostica.html" -ForegroundColor $ColorSuccess
Write-Host ""
Write-Host "💡 Cosa accade quando apri ScriptPDF1.html:" -ForegroundColor $ColorWarning
Write-Host "   1. La pagina rileva il Server Manager sulla porta $ManagerPort" -ForegroundColor $ColorInfo
Write-Host "   2. Chiede al Manager di AVVIARE il PDF Server" -ForegroundColor $ColorInfo
Write-Host "   3. Il PDF Server si avvia AUTOMATICAMENTE" -ForegroundColor $ColorInfo
Write-Host "   4. Quando chiudi la pagina, il server si spegne AUTOMATICAMENTE" -ForegroundColor $ColorInfo
Write-Host ""
Write-Host "🛑 Per fermare i server:" -ForegroundColor $ColorInfo
Write-Host "   - Server Manager: .\stop-server-manager.ps1" -ForegroundColor $ColorWarning
Write-Host "   - Live Server: Ctrl+C nella finestra dei server" -ForegroundColor $ColorWarning
Write-Host ""
Write-Host "📚 Per maggiori informazioni:" -ForegroundColor $ColorInfo
Write-Host "   Vedi: README_SERVER_MANAGER.md" -ForegroundColor $ColorInfo
Write-Host ""
