# Test completo di tutte le API disponibili
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host 'TEST COMPLETO API' -ForegroundColor Cyan
Write-Host '=====================================================' -ForegroundColor Cyan
Write-Host ''

$baseUrl = 'http://localhost:5500'
$allTestsPassed = $true

# Test 1: API /api/pdf-list
Write-Host 'TEST 1: GET /api/pdf-list' -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "$baseUrl/api/pdf-list" -UseBasicParsing
  $data = $response.Content | ConvertFrom-Json
  
  if ($data.success -and $data.files) {
    Write-Host '  [OK] API restituisce lista PDF' -ForegroundColor Green
    Write-Host "       Total files: $($data.files.Count)" -ForegroundColor Green
    Write-Host "       First file: $($data.files[0].name)" -ForegroundColor Green
  } else {
    Write-Host '  [ERROR] API non restituisce dati validi' -ForegroundColor Red
    $allTestsPassed = $false
  }
} catch {
  Write-Host "  [ERROR] Errore nella richiesta: $($_.Exception.Message)" -ForegroundColor Red
  $allTestsPassed = $false
}

Write-Host ''

# Test 2: API /api/monitor-info
Write-Host 'TEST 2: GET /api/monitor-info' -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "$baseUrl/api/monitor-info" -UseBasicParsing
  $data = $response.Content | ConvertFrom-Json
  
  if ($data.primaryMonitor -and $data.secondaryMonitor) {
    Write-Host '  [OK] API restituisce info monitor' -ForegroundColor Green
    Write-Host "       Primary: $($data.primaryMonitor.width)x$($data.primaryMonitor.height) @ X=$($data.primaryMonitor.x),Y=$($data.primaryMonitor.y)" -ForegroundColor Green
    Write-Host "       Secondary: $($data.secondaryMonitor.width)x$($data.secondaryMonitor.height) @ X=$($data.secondaryMonitor.x),Y=$($data.secondaryMonitor.y)" -ForegroundColor Green
  } else {
    Write-Host '  [ERROR] Dati monitor non validi' -ForegroundColor Red
    $allTestsPassed = $false
  }
} catch {
  Write-Host "  [ERROR] Errore nella richiesta: $($_.Exception.Message)" -ForegroundColor Red
  $allTestsPassed = $false
}

Write-Host ''

# Test 3: API /api/open-pdf (POST) - Se ci sono file PDF
Write-Host 'TEST 3: POST /api/open-pdf' -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "$baseUrl/api/pdf-list" -UseBasicParsing
  $data = $response.Content | ConvertFrom-Json
  
  if ($data.files.Count -gt 0) {
    $pdfFile = $data.files[0]
    $payload = @{
      filePath = $pdfFile.path
      fileName = $pdfFile.name
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "$baseUrl/api/open-pdf" `
      -Method POST `
      -ContentType "application/json" `
      -Body $payload `
      -UseBasicParsing
    
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success -and $data.pid) {
      Write-Host '  [OK] PDF aperto con successo' -ForegroundColor Green
      Write-Host "       PID Chrome: $($data.pid)" -ForegroundColor Green
      Write-Host "       Monitor X=$($data.monitor.x), Y=$($data.monitor.y)" -ForegroundColor Green
      
      # Attendi un po'
      Start-Sleep -Seconds 5
      
      # Chiudi il processo
      try {
        Stop-Process -Id $data.pid -Force 2>$null
        Write-Host '  [OK] Chrome chiuso correttamente' -ForegroundColor Green
      } catch {
        Write-Host '  [WARNING] Impossibile chiudere Chrome' -ForegroundColor Yellow
      }
    } else {
      Write-Host '  [ERROR] Errore nell''apertura PDF' -ForegroundColor Red
      $allTestsPassed = $false
    }
  } else {
    Write-Host '  [SKIPPED] Nessun file PDF disponibile' -ForegroundColor Yellow
  }
} catch {
  Write-Host "  [ERROR] Errore nella richiesta: $($_.Exception.Message)" -ForegroundColor Red
  $allTestsPassed = $false
}

Write-Host ''

# Test 4: Test CORS Headers
Write-Host 'TEST 4: CORS Headers' -ForegroundColor Yellow
try {
  $response = Invoke-WebRequest -Uri "$baseUrl/api/pdf-list" -UseBasicParsing
  $corsHeader = $response.Headers['Access-Control-Allow-Origin']
  
  if ($corsHeader) {
    Write-Host "  [OK] CORS abilitato: $corsHeader" -ForegroundColor Green
  } else {
    Write-Host '  [WARNING] CORS header non trovato' -ForegroundColor Yellow
  }
} catch {
  Write-Host "  [ERROR] Errore nel controllo CORS: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ''

# Test 5: Test pagine HTML
Write-Host 'TEST 5: Pagine HTML' -ForegroundColor Yellow
$htmlPages = @(
  'index.html',
  'Prova/ScriptPDF1.html',
  'Prova/test-scriptpdf1.html'
)

foreach ($page in $htmlPages) {
  try {
    $response = Invoke-WebRequest -Uri "$baseUrl/$page" -UseBasicParsing
    if ($response.StatusCode -eq 200) {
      Write-Host "  [OK] $page accessibile" -ForegroundColor Green
    }
  } catch {
    Write-Host "  [ERROR] $page non accessibile" -ForegroundColor Red
    $allTestsPassed = $false
  }
}

Write-Host ''
Write-Host '=====================================================' -ForegroundColor Cyan
if ($allTestsPassed) {
  Write-Host 'TUTTE LE API FUNZIONANO PERFETTAMENTE!' -ForegroundColor Green
} else {
  Write-Host 'Alcuni test hanno riportato errori' -ForegroundColor Yellow
}
Write-Host '=====================================================' -ForegroundColor Cyan
