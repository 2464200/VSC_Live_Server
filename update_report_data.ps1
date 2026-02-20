# Script PowerShell per aggiornare automaticamente i dati del report
# Esegue generate_report_data.py e aggiorna border_data.json

param(
    [string]$Interval = "5",  # Intervallo in minuti (default 5)
    [switch]$Once             # Se specificato, esegue una sola volta senza loop
)

$pythonExe = "C:\VSC_Live_Server\.venv\Scripts\python.exe"
$scriptPath = "C:\VSC_Live_Server\generate_report_data.py"
$logPath = "C:\VSC_Live_Server\logs\report_update.log"

# Crea la cartella logs se non esiste
$logsDir = Split-Path $logPath
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

# Funzione per eseguire l'aggiornamento
function Update-ReportData {
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] Aggiornamento dati report in corso..." -ForegroundColor Cyan
    
    try {
        & $pythonExe $scriptPath 2>&1 | Tee-Object -FilePath $logPath -Append
        Write-Host "[$timestamp] ✓ Aggiornamento completato con successo" -ForegroundColor Green
    }
    catch {
        $errorMsg = "Errore durante l'aggiornamento: $_"
        Write-Host "[$timestamp] ✗ $errorMsg" -ForegroundColor Red
        Add-Content -Path $logPath -Value "[$timestamp] ERRORE: $errorMsg"
    }
}

# Se -Once, esegui una sola volta
if ($Once) {
    Update-ReportData
    exit
}

# Altrimenti, esegui in loop con intervallo specificato
Write-Host "Script di aggiornamento automatico del report" -ForegroundColor Yellow
Write-Host "Intervallo: ogni $Interval minuti" -ForegroundColor Yellow
Write-Host "Log: $logPath" -ForegroundColor Yellow
Write-Host "Premi Ctrl+C per fermare" -ForegroundColor Yellow
Write-Host ""

$intervalSeconds = [int]$Interval * 60

while ($true) {
    Update-ReportData
    Write-Host "Prossimo aggiornamento tra $($Interval) minuti..." -ForegroundColor Cyan
    Start-Sleep -Seconds $intervalSeconds
}
