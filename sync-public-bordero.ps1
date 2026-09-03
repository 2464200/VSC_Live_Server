<#
.SYNOPSIS
    Sincronizza i file client di Bordero e i file CSV nella cartella public/ per il deploy su Firebase Hosting.

.DESCRIPTION
    Copia le cartelle pages, js, assets, data di Bordero e i CSV radice (NextCoreo.csv, display.csv, servizio.csv)
    nella cartella public/, garantendo che l'URL Firebase https://.../Bordero/pages/display.html sia completo e funzionante.
#>

[CmdletBinding()]
param()

$repoRoot = $PSScriptRoot
$borderoSrc = Join-Path $repoRoot "Bordero"
$publicBordero = Join-Path $repoRoot "public\Bordero"

Write-Host "🔄 Sincronizzazione file Bordero in public/ per Firebase Hosting..." -ForegroundColor Cyan

# 1. Cartelle Bordero essenziali
$subfolders = @("pages", "js", "assets", "data")
foreach ($folder in $subfolders) {
    $src = Join-Path $borderoSrc $folder
    $dst = Join-Path $publicBordero $folder
    if (Test-Path $src) {
        if (-not (Test-Path $dst)) {
            New-Item -ItemType Directory -Path $dst -Force | Out-Null
        }
        Copy-Item -Path "$src\*" -Destination $dst -Recurse -Force
        Write-Host "  ✓ Copiato Bordero\$folder -> public\Bordero\$folder" -ForegroundColor Green
    }
}

# 2. File CSV radice
$rootCsvs = @("NextCoreo.csv", "display.csv", "servizio.csv")
foreach ($csv in $rootCsvs) {
    $src = Join-Path $repoRoot $csv
    $dst = Join-Path $repoRoot "public\$csv"
    if (Test-Path $src) {
        Copy-Item -Path $src -Destination $dst -Force
        Write-Host "  ✓ Copiato $csv -> public\$csv" -ForegroundColor Green
    }
}

Write-Host "✅ Sincronizzazione public/ completata con successo!" -ForegroundColor Green
