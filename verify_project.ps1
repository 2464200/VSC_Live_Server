# Verifica struttura e integrità del progetto
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host 'VERIFICA STRUTTURA PROGETTO' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host ''

Write-Host 'File critici (runtime corrente):' -ForegroundColor Yellow
$files = @(
  'package.json',
  'unified-server.js',
  'electron\main.js',
  'electron\preload.js',
  'script.js',
  'index.html',
  'Bordero\pages\bordero.html',
  'Bordero\pages\admin.html',
  'public\display.csv',
  'display.csv',
  'NextCoreo.csv'
)

$allOk = $true
foreach ($file in $files) {
  if (Test-Path $file) {
    $item = Get-Item $file
    $size = $item.Length
    Write-Host "  [OK] $file ($size bytes)" -ForegroundColor Green
  } else {
    Write-Host "  [MISSING] $file" -ForegroundColor Red
    $allOk = $false
  }
}

Write-Host ''
Write-Host 'Cartelle importanti:' -ForegroundColor Yellow
$dirs = @(
  'node_modules',
  'Bordero',
  'public',
  'electron',
  'Eventi',
  'logs'
)

foreach ($dir in $dirs) {
  if (Test-Path $dir -PathType Container) {
    $fileCount = (Get-ChildItem $dir -Recurse | Measure-Object).Count
    Write-Host "  [OK] $dir\ ($fileCount items)" -ForegroundColor Green
  } else {
    Write-Host "  [MISSING] $dir\" -ForegroundColor Red
    $allOk = $false
  }
}

Write-Host ''
if ($allOk) {
  Write-Host '[OK] Tutti i file e cartelle sono presenti!' -ForegroundColor Green
} else {
  Write-Host '[WARNING] Alcuni file o cartelle mancano!' -ForegroundColor Yellow
}

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
