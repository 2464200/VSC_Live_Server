# Verifica struttura e integrità del progetto
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host 'VERIFICA STRUTTURA PROGETTO' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host ''

Write-Host 'File critici:' -ForegroundColor Yellow
$files = @(
  'package.json',
  'pdf-server.js',
  'script.js',
  'index.html',
  'Prova\ScriptPDF1.html',
  'Prova\test-scriptpdf1.html',
  'test_scriptpdf1_monitor_fixed.ps1',
  'public\display.csv',
  'display.csv'
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
  'Prova',
  'public',
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
