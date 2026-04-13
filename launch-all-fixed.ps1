######################################################################
# launch-all-fixed.ps1
# Wrapper legacy allineato al server unificato
######################################################################

param(
    [switch]$NoWait = $false
)

$Root = $PSScriptRoot
$StartupScript = Join-Path $Root 'startup.ps1'

Write-Host ""
Write-Host "========================================================"
Write-Host "  launch-all-fixed.ps1 e' stato riallineato"
Write-Host "========================================================"
Write-Host ""
Write-Host "Uso corretto del progetto:" -ForegroundColor Cyan
Write-Host "  http://localhost:5500/..." -ForegroundColor Green
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
