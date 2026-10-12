@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-unattended.ps1" -NoBrowser
if errorlevel 1 (
  echo [ERROR] Avvio non riuscito. Controllare logs\unified-server.stderr.log.
  pause
  exit /b 1
)
