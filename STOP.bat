@echo off
setlocal
cd /d "%~dp0"

for /f "skip=1 tokens=1" %%P in ('wmic process where "name='node.exe'" get processid 2^>nul ^| findstr /R "^[0-9]"') do (
  taskkill /PID %%P /F >nul 2>&1
)

for /f "skip=1 tokens=1" %%P in ('wmic process where "name='cmd.exe'" get processid 2^>nul ^| findstr /R "^[0-9]"') do (
  wmic process where "processid=%%P" get commandline 2>nul | findstr /I "server.js" >nul && taskkill /PID %%P /F >nul 2>&1
)

echo [INFO] Server arrestato.
pause
