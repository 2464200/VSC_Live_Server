# CSV Sync Script for VSC_Live_Server
# Copies public-facing CSV files to public/

param(
    [string]$SourceDir = (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))),  # Workspace root
    [string]$DestDir = (Join-Path (Split-Path -Parent (Split-Path -Parent (Split-Path -Parent $PSScriptRoot))) "public")
)

$csvFiles = @("display.csv", "NextCoreo.csv")
$braniSourcePath = Join-Path $SourceDir "Bordero\data\brani.csv"
$braniDestPath = Join-Path $DestDir "brani.csv"

if (Test-Path $braniSourcePath) {
    Copy-Item -Path $braniSourcePath -Destination $braniDestPath -Force
    Write-Host "Copied Bordero/data/brani.csv to public/"
} else {
    Write-Error "Source file $braniSourcePath not found"
    exit 1
}

foreach ($file in $csvFiles) {
    $sourcePath = Join-Path $SourceDir $file
    $destPath = Join-Path $DestDir $file

    if (Test-Path $sourcePath) {
        Copy-Item -Path $sourcePath -Destination $destPath -Force
        Write-Host "Copied $file to public/"
    } else {
        Write-Error "Source file $sourcePath not found"
        exit 1
    }
}

Write-Host "CSV sync completed successfully"