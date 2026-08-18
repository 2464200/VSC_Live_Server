@echo off
setlocal
cd /d "%~dp0"
node scripts\diagnostic-check.js
pause
