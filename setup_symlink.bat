
@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem === Configura i percorsi qui se diverso ===
set "PROJECT=C:\VSC_Live_Server"
set "TARGET=C:\VIDEOCLIP"
set "LINK=%PROJECT%\VIDEOCLIP"

echo ===== Impostazione symlink =====
echo Progetto : %PROJECT%
echo Target   : %TARGET%
echo Link     : %LINK%
echo.

rem 1) Crea cartella progetto se non esiste
if not exist "%PROJECT%" (
  echo Creo cartella progetto: "%PROJECT%"
  mkdir "%PROJECT%" || (echo ERRORE nel creare "%PROJECT%" & exit /b 1)
)

rem 2) Controlla privilegi amministrativi (se non in Developer Mode)
net session >nul 2>&1
if %errorlevel% NEQ 0 (
  echo Servono privilegi elevati per creare symlink (a meno di Developer Mode).
  echo Rilancio lo script come Amministratore...
  powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

rem 3) Se esiste gia' qualcosa in %LINK%, verifica che sia un symlink
if exist "%LINK%" (
  echo Trovato esistente: "%LINK%"
  rem Prova a capire se e' un reparse point (symlink / junction)
  fsutil reparsepoint query "%LINK%" >nul 2>&1
  if %errorlevel% EQU 0 (
    echo E' gia' un collegamento (reparse point). Lascio invariato.
    goto :DONE
  ) else (
    echo ATTENZIONE: "%LINK%" esiste ma non e' un symlink.
    echo Se e' una cartella reale, NON la cancello. Rinominala o rimuovila manualmente e riesegui.
    exit /b 1
  )
)

rem 4) Crea symlink
echo Creo symlink: "%LINK%" -> "%TARGET%"
mklink /D "%LINK%" "%TARGET%"
if errorlevel 1 (
  echo ERRORE: impossibile creare il collegamento simbolico.
  echo Suggerimenti:
  echo - Esegui questo file come Amministratore
  echo - Oppure attiva "Modalita' sviluppatore" su Windows
  exit /b 1
)

:DONE
echo OK. Symlink pronto.
echo Percorso pubblicato da Live Server: %LINK%
pause
