@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js non trovato.
  echo Installa Node.js LTS e riavvia questo script.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm non trovato.
  echo Installa Node.js LTS e riavvia questo script.
  pause
  exit /b 1
)

if not exist package.json (
  echo [ERROR] Nessun package.json trovato nella cartella del progetto.
  pause
  exit /b 1
)

if not exist node_modules (
  echo [INFO] Dipendenze mancanti. Installazione in corso...
  npm install --no-fund --no-audit
  if errorlevel 1 (
    echo [ERROR] npm install fallito.
    pause
    exit /b 1
  )
)

if not exist .env (
  if exist .env.example (
    copy .env.example .env >nul
    echo [INFO] Creato file .env da .env.example
  )
)

for /f "usebackq tokens=* delims=" %%A in (".env") do (
  echo %%A | findstr /I /C:"UNIFIED_PORT=" >nul && set "PORT_LINE=%%A"
)

if defined PORT_LINE (
  for /f "tokens=2 delims==" %%B in ("%PORT_LINE%") do set "APP_PORT=%%B"
) else (
  set "APP_PORT=5500"
)

if not defined APP_PORT set "APP_PORT=5500"

node scripts\diagnostic-check.js

echo.
echo [INFO] Avvio server locale su http://localhost:%APP_PORT%
echo [INFO] Se la porta e' occupata, il server provera automaticamente la successiva.
start "Monster Country DJ" http://localhost:%APP_PORT%
node scripts\start-portable.js
pause
