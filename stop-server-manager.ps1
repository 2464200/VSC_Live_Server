######################################################################
# stop-server-manager.ps1
# Ferma il Server Manager e il PDF Server
######################################################################

Write-Host "`n" -ForegroundColor Yellow
Write-Host "🛑 Arresto Server Manager..." -ForegroundColor Yellow

# Cerca processi Node.js con server-manager
$processes = Get-Process node -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -like "*server-manager*" 
}

if ($processes.Count -eq 0) {
    Write-Host "⚠️  Nessun processo server-manager trovato" -ForegroundColor Yellow
    exit 0
}

# Ferma i processi
foreach ($proc in $processes) {
    Write-Host "  Termino processo PID: $($proc.Id)" -ForegroundColor Cyan
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 500

# Verifica che siano effettivamente chiusi
$remaining = Get-Process node -ErrorAction SilentlyContinue | Where-Object { 
    $_.CommandLine -like "*server-manager*" 
}

if ($remaining.Count -eq 0) {
    Write-Host "✅ Server Manager fermato con successo" -ForegroundColor Green
    Write-Host "💡 Il PDF Server è stato fermato automaticamente" -ForegroundColor Yellow
    Write-Host "" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Alcuni processi non sono stati chiusi, forzare la chiusura..." -ForegroundColor Yellow
    foreach ($proc in $remaining) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Processi forzati a chiudersi" -ForegroundColor Green
    Write-Host "" -ForegroundColor Cyan
}
