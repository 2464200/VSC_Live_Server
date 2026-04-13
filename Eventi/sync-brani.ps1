# Script di sincronizzazione: CSV -> JSON
# Usa la stessa logica centralizzata del progetto Node per unire
# Elenco_Brani_statico.csv e Coreografie_Aggiuntive.csv

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$nodeScript = Join-Path $scriptDir 'sync-brani.js'

if (-not (Test-Path $nodeScript)) {
    Write-Host "Errore: script Node non trovato: $nodeScript" -ForegroundColor Red
    exit 1
}

Write-Host "Sincronizzazione brani CSV -> JSON" -ForegroundColor Cyan
node $nodeScript

if ($LASTEXITCODE -ne 0) {
    Write-Host "Errore durante la sincronizzazione." -ForegroundColor Red
    exit $LASTEXITCODE
}
