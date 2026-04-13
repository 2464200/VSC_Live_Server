######################################################################
# stop-pdf-server.ps1
# Ferma il server PDF
######################################################################

Write-Host "🛑 Fermo il server PDF..." -ForegroundColor Yellow

# Cerca i processi Node.js con pdf-server
$processes = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*pdf-server*" }

if ($processes.Count -eq 0) {
    Write-Host "⚠️  Nessun processo pdf-server trovato" -ForegroundColor Yellow
    exit 0
}

# Ferma i processi
foreach ($proc in $processes) {
    Write-Host "  Termino processo PID: $($proc.Id)" -ForegroundColor Cyan
    Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
}

# Ferma anche eventuali job PowerShell
$jobs = Get-Job | Where-Object { $_.CommandLine -like "*pdf-server*" }
foreach ($job in $jobs) {
    Write-Host "  Rimuovo job: $($job.Id)" -ForegroundColor Cyan
    Stop-Job -Job $job -ErrorAction SilentlyContinue
    Remove-Job -Job $job -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Milliseconds 500

# Verifica che siano effettivamente chiusi
$remaining = Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*pdf-server*" }
if ($remaining.Count -eq 0) {
    Write-Host "✅ Server PDF fermato con successo" -ForegroundColor Green
} else {
    Write-Host "⚠️  Alcuni processi non sono stati chiusi, forzare la chiusura..." -ForegroundColor Yellow
    foreach ($proc in $remaining) {
        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
    }
    Write-Host "✅ Processi forzati a chiudersi" -ForegroundColor Green
}
