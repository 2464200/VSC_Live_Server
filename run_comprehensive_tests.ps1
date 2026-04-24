# Verifica server e esecuzione test
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host 'VERIFICA SERVER E TEST' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host ''

Write-Host 'Verifica server in esecuzione...' -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri 'http://localhost:5500/api/pdf-list' -UseBasicParsing -TimeoutSec 2
  if ($response.StatusCode -eq 200) {
    Write-Host '[OK] Server è in esecuzione sulla porta 5500' -ForegroundColor Green
    $isServerRunning = $true
  }
} catch {
  Write-Host '[WARNING] Server non raggiungibile' -ForegroundColor Yellow
  Write-Host 'Avviando il server...' -ForegroundColor Yellow
  Start-Process cmd.exe -ArgumentList '/c node unified-server.js' -WindowStyle Hidden
  Start-Sleep -Seconds 3
  $isServerRunning = $false
}

Write-Host ''
Write-Host 'Esecuzione test PowerShell...' -ForegroundColor Yellow
Write-Host ''

# Esegui il test PowerShell
if (Test-Path '.\test_scriptpdf1_monitor_fixed.ps1') {
  & .\test_scriptpdf1_monitor_fixed.ps1
} else {
  Write-Host '[ERROR] File test non trovato!' -ForegroundColor Red
}

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host 'TEST COMPLETATI' -ForegroundColor Green
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Prossimi step:' -ForegroundColor Yellow
Write-Host '  1. Apri http://localhost:5500/Prova/test-scriptpdf1.html nel browser' -ForegroundColor White
Write-Host '  2. Verifica che tutti i test HTML passino' -ForegroundColor White
Write-Host '  3. Testa la funzionalita completa del progetto' -ForegroundColor White
