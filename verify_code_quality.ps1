# Verifica della validità del codice JavaScript e configurazione
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host 'VERIFICA VALIDITA CODICE' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host ''

# Verifica JavaScript con Node.js
Write-Host 'Controllo validità JavaScript...' -ForegroundColor Yellow
Write-Host ''

$jsFiles = @(
  'pdf-server.js',
  'script.js'
)

foreach ($file in $jsFiles) {
  if (Test-Path $file) {
    Write-Host "Verifica $file..." -ForegroundColor Yellow
    # Tenta di parsare il file con Node
    $output = & node.exe -c "$file" 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  [OK] Sintassi valida" -ForegroundColor Green
    } else {
      Write-Host "  [ERROR] Problemi di sintassi:" -ForegroundColor Red
      Write-Host "  $output" -ForegroundColor Red
    }
  }
}

Write-Host ''
Write-Host 'Verifica dipendenze Node.js...' -ForegroundColor Yellow
Write-Host ''

# Leggi package.json
$packageJson = Get-Content package.json | ConvertFrom-Json

Write-Host 'Dipendenze principali:' -ForegroundColor Yellow
if ($packageJson.dependencies) {
  foreach ($dep in $packageJson.dependencies.PSObject.Properties) {
    Write-Host "  - $($dep.Name): $($dep.Value)" -ForegroundColor Green
  }
}

Write-Host ''
Write-Host 'Dipendenze sviluppo:' -ForegroundColor Yellow
if ($packageJson.devDependencies) {
  foreach ($dep in $packageJson.devDependencies.PSObject.Properties) {
    Write-Host "  - $($dep.Name): $($dep.Value)" -ForegroundColor Green
  }
}

Write-Host ''
Write-Host 'Verifica disponibilità moduli Node.js...' -ForegroundColor Yellow
Write-Host ''

$modules = @('express', 'fs', 'path', 'os')
foreach ($module in $modules) {
  $testCode = "try { require('$module'); console.log('OK'); } catch(e) { console.log('ERROR: ' + e.message); }"
  $result = & node.exe -e $testCode 2>&1
  if ($result -eq 'OK') {
    Write-Host "  [OK] Modulo '$module' disponibile" -ForegroundColor Green
  } else {
    Write-Host "  [WARNING] Modulo '$module' - $result" -ForegroundColor Yellow
  }
}

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host 'VERIFICA COMPLETATA' -ForegroundColor Green
Write-Host '=====================================================' -ForegroundColor Cyan
