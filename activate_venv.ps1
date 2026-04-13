# Attivazione venv per VSC Live Server
# Questo script attiva il virtual environment Python

$venvPath = Join-Path $PSScriptRoot ".venv"
$pythonExe = Join-Path $venvPath "Scripts\python.exe"
$sitePackages = Join-Path $venvPath "Lib\site-packages"

# Aggiungi python.exe alla PATH
$env:PATH = "$(Split-Path $pythonExe);$env:PATH"

# Imposta PYTHONPATH
$env:PYTHONPATH = $sitePackages

# Imposta VIRTUAL_ENV
$env:VIRTUAL_ENV = $venvPath

# Cambia prompt
$env:VIRTUAL_ENV_PROMPT = "(.venv) "

Write-Host "Virtual environment attivato: $venvPath"
Write-Host "Python: $pythonExe"