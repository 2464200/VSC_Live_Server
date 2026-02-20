@echo off
REM Script rapido per avviare la configurazione del Task Scheduler come Amministratore
REM Fare click destro su questo file e scegliere "Esegui come amministratore"

setlocal enabledelayedexpansion

REM Controlla se è admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo.
    echo *** ERRORE: Questo script deve essere eseguito come Amministratore ***
    echo.
    echo Soluzione:
    echo 1. Fare click destro su questo file (.bat)
    echo 2. Selezionare "Esegui come amministratore"
    echo.
    pause
    exit /b 1
)

echo.
echo ===== Configurazione Task Scheduler =====
echo.

REM Intervallo in minuti (default 5)
set INTERVAL=5

echo Avvio Script PowerShell per registrare il task...
echo Intervallo: ogni %INTERVAL% minuti
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "C:\VSC_Live_Server\setup_report_scheduler.ps1" -Interval %INTERVAL%

echo.
pause
