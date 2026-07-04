#!/usr/bin/env powershell
<#
 # BORDERÒ - Auto Start Server
 # Script per avviare il server HTTP e aprire il browser automaticamente
 #
 # Uso: .\start-server.ps1
 #>

# Configurazione
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$port = 8000
$baseUrl = "http://localhost:$port/Bordero/"

Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          🚀 BORDERÒ - AUTO SERVER STARTUP                 ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Step 1: Verifica se Python è installato
Write-Host "📋 Step 1: Verificando Python..." -ForegroundColor Yellow
try {
  $pythonVersion = python --version 2>&1
  Write-Host "✅ Python trovato: $pythonVersion" -ForegroundColor Green
} catch {
  Write-Host "❌ Python non trovato. Installalo da https://www.python.org/" -ForegroundColor Red
  Write-Host ""
  exit 1
}

Write-Host ""

# Step 2: Verifica porta disponibile
Write-Host "🔍 Step 2: Verificando porta $port..." -ForegroundColor Yellow
try {
  $portCheck = netstat -ano | Select-String ":$port"
  if ($portCheck) {
    Write-Host "⚠️  Porta $port in uso. Provo $($port + 1)..." -ForegroundColor Yellow
    $port = $port + 1
  } else {
    Write-Host "✅ Porta $port libera" -ForegroundColor Green
  }
} catch {
  Write-Host "⚠️  Non riesco a verificare porta, continuo comunque..." -ForegroundColor Yellow
}

Write-Host ""

# Step 3: Avvia il server
Write-Host "🌐 Step 3: Avviando server HTTP sulla porta $port..." -ForegroundColor Yellow
Write-Host ""

cd $projectRoot
$pythonProcess = Start-Process python -ArgumentList "-m http.server $port" -PassThru -NoNewWindow

Write-Host "✅ Server avviato (PID: $($pythonProcess.Id))" -ForegroundColor Green
Write-Host "📡 URL: http://localhost:$port/Bordero/" -ForegroundColor Cyan
Write-Host ""

# Step 4: Attendi che il server sia pronto
Write-Host "⏳ Step 4: Attendo che il server sia pronto..." -ForegroundColor Yellow
$maxRetries = 10
$retry = 0

do {
  Start-Sleep -Seconds 1
  try {
    $response = Invoke-WebRequest "http://localhost:$port/Bordero/" -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
      Write-Host "✅ Server pronto!" -ForegroundColor Green
      break
    }
  } catch {
    $retry++
    if ($retry -le 3) {
      Write-Host "⏳ Tentativo $retry/$maxRetries..." -ForegroundColor Gray
    }
  }
} while ($retry -lt $maxRetries)

Write-Host ""

# Step 5: Apri il browser
Write-Host "🌐 Step 5: Aprendo il browser..." -ForegroundColor Yellow
Start-Process "http://localhost:$port/Bordero/"
Write-Host "✅ Browser aperto a http://localhost:$port/Bordero/" -ForegroundColor Green

Write-Host ""
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "✅ BORDERÒ è ONLINE e PRONTO!" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "📌 IMPORTANTE:" -ForegroundColor Yellow
Write-Host "   - Non chiudere questa finestra (il server continuerà a girare)" -ForegroundColor White
Write-Host "   - Premi Ctrl+C quando vuoi fermare il server" -ForegroundColor White
Write-Host ""
Write-Host "🎯 URL Principali:" -ForegroundColor Cyan
Write-Host "   Home:           http://localhost:$port/Bordero/" -ForegroundColor White
Write-Host "   Tabella:        http://localhost:$port/Bordero/pages/bordero.html" -ForegroundColor White
Write-Host "   Monitor:        http://localhost:$port/Bordero/pages/display.html" -ForegroundColor White
Write-Host "   NextCoreo:      http://localhost:$port/Bordero/pages/next-coreo.html" -ForegroundColor White
Write-Host "   Lista Serata:   http://localhost:$port/Bordero/pages/lista-serata.html" -ForegroundColor White
Write-Host "   Risultati:      http://localhost:$port/Bordero/pages/risultati.html" -ForegroundColor White
Write-Host "   VideoClip:      http://localhost:$port/Bordero/pages/videoclip.html" -ForegroundColor White
Write-Host ""

# Mantieni il processo attivo
Wait-Process -Id $pythonProcess.Id

Write-Host ""
Write-Host "🛑 Server stoppato." -ForegroundColor Yellow
