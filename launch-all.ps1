######################################################################
# launch-all.ps1
# Wrapper legacy allineato al server unificato
######################################################################

param(
    [switch]$NoWait = $false
)

$Root = $PSScriptRoot
$StartupScript = Join-Path $Root 'startup.ps1'

Write-Host ""
Write-Host "========================================================"
Write-Host "  launch-all.ps1 e' ora un wrapper verso startup.ps1"
Write-Host "========================================================"
Write-Host ""
Write-Host "Modalita standard del progetto:" -ForegroundColor Cyan
Write-Host "  - unified-server.js sulla porta 5500" -ForegroundColor Green
Write-Host "  - niente Live Server separato" -ForegroundColor Green
Write-Host "  - niente Server Manager richiesto nel flusso standard" -ForegroundColor Green
Write-Host ""

if (-not (Test-Path $StartupScript)) {
    Write-Host "ERRORE: startup.ps1 non trovato in $Root" -ForegroundColor Red
    exit 1
}

$args = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $StartupScript
)

if ($NoWait) {
    $args += "-NoWait"
}

& powershell @args
exit $LASTEXITCODE
