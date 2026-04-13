# Script di configurazione iniziale per ScriptPDF1
# Questo script:
# 1. Verifica e installa Node.js se necessario
# 2. Installa le dipendenze npm
# 3. Crea la cartella C:\VSC_SCRIPT_PDF
# 4. Avvia il sistema

Write-Host "`n======================================"
Write-Host "  Setup ScriptPDF1"
Write-Host "====================================`n"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Verifica Node.js
Write-Host "1️⃣  Verifica di Node.js..."
try {
    $nodeVersion = node --version 2>$null
    if ($nodeVersion) {
        Write-Host "   ✓ Node.js $nodeVersion trovato"
    } else {
        throw "Node.js non trovato"
    }
} catch {
    Write-Host "   ❌ Node.js non è installato"
    Write-Host "   Scarica da: https://nodejs.org/"
    Write-Host ""
    Read-Host "Premi invio per uscire"
    exit 1
}

# 2. Installa dipendenze npm
Write-Host "`n2️⃣  Installazione dipendenze npm..."
Push-Location $scriptPath
try {
    if (-not (Test-Path "node_modules")) {
        Write-Host "   Installazione di Express e dipendenze..."
        npm install
        if ($LASTEXITCODE -ne 0) {
            throw "Errore nell'installazione npm"
        }
        Write-Host "   ✓ Dipendenze installate"
    } else {
        Write-Host "   ✓ Dipendenze già installate"
    }
} catch {
    Write-Host "   ❌ Errore nell'installazione: $_"
    Pop-Location
    Read-Host "Premi invio per uscire"
    exit 1
}
Pop-Location

# 3. Crea cartella C:\VSC_SCRIPT_PDF
Write-Host "`n3️⃣  Creazione cartella C:\VSC_SCRIPT_PDF..."
$pdfFolder = "C:\VSC_SCRIPT_PDF"
if (-not (Test-Path $pdfFolder)) {
    New-Item -ItemType Directory -Path $pdfFolder -Force | Out-Null
    Write-Host "   ✓ Cartella creata"
} else {
    Write-Host "   ✓ Cartella già esistente"
}

# 4. Crea un file PDF di test se non esiste
$testPdf = Join-Path $pdfFolder "README.txt"
if (-not (Test-Path $testPdf)) {
    @"
CARTELLA FILE PDF
=================

Questa cartella contiene i file PDF che verranno visualizzati in ScriptPDF1.

Istruzioni:
1. Aggiungi i tuoi file PDF (.pdf) in questa cartella
2. Avvia Start_ScriptPDF1.ps1 da C:\VSC_Live_Server
3. Seleziona il PDF che vuoi visualizzare dalla ComboBox
4. Usa i pulsanti di navigazione per sfogliare i file

I file verranno automaticamente rilevati dal programma.
"@ | Out-File $testPdf -Encoding UTF8
    Write-Host "   ✓ File README.txt creato"
}

# 5. Verifica Chrome
Write-Host "`n4️⃣  Verifica di Google Chrome..."
$chromePath = $null
$possiblePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

foreach ($path in $possiblePaths) {
    if (Test-Path $path) {
        $chromePath = $path
        break
    }
}

if ($chromePath) {
    Write-Host "   ✓ Chrome trovato: $chromePath"
} else {
    Write-Host "   ⚠️  Chrome non trovato"
    Write-Host "   Scarica da: https://www.google.com/chrome/"
    Write-Host "   Nota: Il sistema continuerà a funzionare ma non potrà visualizzare i PDF"
}

# 6. Riepilogo
Write-Host "`n======================================"
Write-Host "  ✓ Setup completato!"
Write-Host "====================================`n"

Write-Host "Cartella PDF: $pdfFolder"
Write-Host "Percorso script: $scriptPath`n"

Write-Host "Per avviare il programma:"
Write-Host "  .\Start_ScriptPDF1.ps1`n"

Write-Host "Per ulteriori informazioni:"
Write-Host "  Vedi il file README_ScriptPDF1.md`n"

$response = Read-Host "Vuoi avviare ora ScriptPDF1? (S/N)"
if ($response -eq "S" -or $response -eq "s") {
    & "$scriptPath\Start_ScriptPDF1.ps1"
}
