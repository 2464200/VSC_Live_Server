# Script per registrare il task automatico in Windows Task Scheduler
# Esegui come Amministratore: powershell -ExecutionPolicy Bypass -File setup_report_scheduler.ps1

param(
    [string]$Interval = "5",
    [string]$TaskName = "VSC_Report_DataUpdate"
)

Write-Host "===== Configurazione Task Scheduler =====" -ForegroundColor Cyan
Write-Host ""

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "ERRORE: Questo script deve essere eseguito come Amministratore" -ForegroundColor Red
    exit 1
}

$pythonExe = "C:\VSC_Live_Server\.venv\Scripts\python.exe"
$scriptPath = "C:\VSC_Live_Server\generate_report_data.py"

if (-not (Test-Path $pythonExe)) {
    Write-Host "ERRORE: Python executable non trovato" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path $scriptPath)) {
    Write-Host "ERRORE: Script Python non trovato" -ForegroundColor Red
    exit 1
}

Write-Host "File verificati: OK" -ForegroundColor Green
Write-Host ""

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Write-Host "Rimozione task precedente..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Start-Sleep -Seconds 2
}

$trigger = New-ScheduledTaskTrigger -RepetitionInterval (New-TimeSpan -Minutes $Interval) -Once -At (Get-Date)
$action = New-ScheduledTaskAction -Execute $pythonExe -Argument $scriptPath -WorkingDirectory "C:\VSC_Live_Server"
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 1)

try {
    Register-ScheduledTask -TaskName $TaskName -Trigger $trigger -Action $action -Settings $settings -Description "Aggiornamento automatico report dati" -Force -ErrorAction Stop | Out-Null
    
    Write-Host "Task registrato con successo!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Dettagli:" -ForegroundColor Cyan
    Write-Host "  Nome: $TaskName"
    Write-Host "  Intervallo: ogni $Interval minuti"
    Write-Host "  Script: $scriptPath"
    Write-Host ""
    
    Write-Host "Avvio del task..." -ForegroundColor Yellow
    Start-ScheduledTask -TaskName $TaskName -ErrorAction Stop
    
    Start-Sleep -Seconds 1
    Write-Host "Task eseguito!" -ForegroundColor Green
}
catch {
    Write-Host "ERRORE: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "===== Configurazione completata =====" -ForegroundColor Green
Write-Host "Log file: C:\VSC_Live_Server\logs\report_update.log"
