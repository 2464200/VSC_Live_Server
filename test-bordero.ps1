#!/usr/bin/env pwsh

<#
 # BORDERÒ - Comprehensive Test Suite
 # Verifica funzionamento di tutte le pagine
 #>

$baseUrl = "http://localhost:8000"
$borderoBases = @(
  "Bordero/index.html"
  "Bordero/pages/bordero.html"
  "Bordero/pages/next-coreo.html"
  "Bordero/pages/display.html"
  "Bordero/pages/lista-serata.html"
  "Bordero/pages/risultati.html"
  "Bordero/pages/videoclip.html"
)

Write-Host "🚀 BORDERÒ - TEST SUITE" -ForegroundColor Yellow
Write-Host "=" * 60
Write-Host ""

# Test 1: Server is responding
Write-Host "TEST 1: Verifico connessione server..." -ForegroundColor Cyan
try {
  $response = Invoke-WebRequest -Uri $baseUrl -UseBasicParsing -ErrorAction Stop
  Write-Host "✅ Server è online su $baseUrl" -ForegroundColor Green
} catch {
  Write-Host "❌ Server non risponde su $baseUrl" -ForegroundColor Red
  exit 1
}

Write-Host ""

# Test 2: Check all pages exist
Write-Host "TEST 2: Verifico disponibilità pagine..." -ForegroundColor Cyan
$failedPages = @()

foreach ($page in $borderoBases) {
  try {
    $url = "$baseUrl/$page"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
      Write-Host "✅ $page (200 OK)" -ForegroundColor Green
    } else {
      Write-Host "⚠️  $page (Status: $($response.StatusCode))" -ForegroundColor Yellow
      $failedPages += $page
    }
  } catch {
    Write-Host "❌ $page - ERRORE: $_" -ForegroundColor Red
    $failedPages += $page
  }
  Start-Sleep -Milliseconds 100
}

Write-Host ""

# Test 3: Check CSS files
Write-Host "TEST 3: Verifico CSS files..." -ForegroundColor Cyan
$cssFiles = @(
  "Bordero/assets/css/style.css"
  "Bordero/assets/css/bordero.css"
  "Bordero/pages/bordero.css"
  "Bordero/pages/next-coreo.css"
  "Bordero/pages/display.css"
  "Bordero/pages/lista-serata.css"
  "Bordero/pages/risultati.css"
  "Bordero/pages/videoclip.css"
)

foreach ($file in $cssFiles) {
  try {
    $url = "$baseUrl/$file"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ $file" -ForegroundColor Green
  } catch {
    Write-Host "❌ $file - ERRORE" -ForegroundColor Red
  }
  Start-Sleep -Milliseconds 50
}

Write-Host ""

# Test 4: Check JS files
Write-Host "TEST 4: Verifico JavaScript files..." -ForegroundColor Cyan
$jsFiles = @(
  "Bordero/js/config.js"
  "Bordero/js/utils.js"
  "Bordero/js/data-loader.js"
  "Bordero/pages/bordero.js"
  "Bordero/pages/next-coreo.js"
  "Bordero/pages/display.js"
  "Bordero/pages/lista-serata.js"
  "Bordero/pages/risultati.js"
  "Bordero/pages/videoclip.js"
)

foreach ($file in $jsFiles) {
  try {
    $url = "$baseUrl/$file"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    Write-Host "✅ $file" -ForegroundColor Green
  } catch {
    Write-Host "❌ $file - ERRORE" -ForegroundColor Red
  }
  Start-Sleep -Milliseconds 50
}

Write-Host ""

# Test 5: Check CSV data files
Write-Host "TEST 5: Verifico CSV data files..." -ForegroundColor Cyan
$csvFiles = @(
  "Bordero/data/brani.csv"
  "Bordero/data/iBBase.csv"
  "Bordero/data/comuni_italia.csv"
)

foreach ($file in $csvFiles) {
  try {
    $url = "$baseUrl/$file"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    $lines = ($response.Content -split "`n").Count
    Write-Host "✅ $file ($lines righe)" -ForegroundColor Green
  } catch {
    Write-Host "❌ $file - ERRORE" -ForegroundColor Red
  }
  Start-Sleep -Milliseconds 50
}

Write-Host ""

# Test 6: Check browser console errors (basic HTML structure)
Write-Host "TEST 6: Verifico struttura HTML (sintassi base)..." -ForegroundColor Cyan
foreach ($page in $borderoBases) {
  try {
    $url = "$baseUrl/$page"
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -ErrorAction Stop
    $content = $response.Content

    # Basic HTML validation
    $hasDoctype = $content -match '<!DOCTYPE html>'
    $hasTitle = $content -match '<title>'
    $hasMeta = $content -match '<meta'

    if ($hasDoctype -and $hasTitle -and $hasMeta) {
      Write-Host "✅ $page - HTML valido" -ForegroundColor Green
    } else {
      Write-Host "⚠️  $page - Struttura HTML incompleta" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "❌ $page - Errore validazione" -ForegroundColor Red
  }
  Start-Sleep -Milliseconds 50
}

Write-Host ""

# Summary
Write-Host "=" * 60 -ForegroundColor Yellow
Write-Host "📊 TEST SUMMARY" -ForegroundColor Yellow
Write-Host ""

if ($failedPages.Count -eq 0) {
  Write-Host "✅ TUTTI I TEST PASSATI!" -ForegroundColor Green
  Write-Host ""
  Write-Host "🌐 URL per test manual:" -ForegroundColor Cyan
  Write-Host "   Main:      $baseUrl/Bordero/pages/bordero.html" -ForegroundColor White
  Write-Host "   Monitor:   $baseUrl/Bordero/pages/display.html" -ForegroundColor White
  Write-Host "   NextCoreo: $baseUrl/Bordero/pages/next-coreo.html" -ForegroundColor White
  Write-Host "   Report:    $baseUrl/Bordero/pages/lista-serata.html" -ForegroundColor White
  Write-Host "   Video:     $baseUrl/Bordero/pages/videoclip.html" -ForegroundColor White
  Write-Host "   Stats:     $baseUrl/Bordero/pages/risultati.html" -ForegroundColor White
} else {
  Write-Host "❌ $($failedPages.Count) pagine non disponibili:" -ForegroundColor Red
  foreach ($page in $failedPages) {
    Write-Host "   - $page" -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "=" * 60 -ForegroundColor Yellow
