@echo off
REM Script batch per avviare ScriptPDF1
REM Questo file rende più facile l'avvio per utenti Windows standard

setlocal enabledelayedexpansion

REM Imposta il titolo della finestra
title ScriptPDF1 - Gestione PDF

REM Cambia cartella
cd /d "%~dp0"

echo.
echo ====================================================================
echo                      ScriptPDF1 - Gestione PDF
echo ====================================================================
echo.

REM Controlla se PowerShell è disponibile
where powershell >nul 2>nul
if errorlevel 1 (
    echo ERRORE: PowerShell non trovato
    echo Assicurati che PowerShell 5.0+ sia installato
    pause
    exit /b 1
)

REM Esegui setup se necessario
if not exist "node_modules\" (
    echo.
    echo PRIMO AVVIO - Configurazione in corso...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -File "Setup_ScriptPDF1.ps1"
    if errorlevel 1 (
        echo.
        echo SETUP FALLITO - Controlla gli errori sopra
        pause
        exit /b 1
    )
) else (
    echo ✓ Configurazione trovata
)

REM Avvia il server
echo.
echo Avvio di ScriptPDF1...
echo.
echo Attendere il caricamento in Chrome...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "Start_ScriptPDF1.ps1"

REM Se arriviamo qui, il programma è stato chiuso
echo.
echo SessioneScriptPDF1 conclusa
echo.
pause
