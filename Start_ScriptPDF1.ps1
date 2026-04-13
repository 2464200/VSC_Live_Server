# Script PowerShell per avviare ScriptPDF1.html
# Questo script:
# 1. Avvia il server Node.js (pdf-server.js)
# 2. Apre la pagina HTML in Chrome (modalità Kiosk) sul monitor secondario
# 3. Chiude tutto quando viene chiuso Excel

param(
    [switch]$Secondary = $true  # Apri sul monitor secondario di default
)

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$serverScript = Join-Path $scriptPath "pdf-server.js"
$htmlUrl = "http://localhost:8765/Prova/ScriptPDF1.html"

# Verifica che Node.js sia installato
try {
    $nodeVersion = node --version 2>$null
    if (-not $nodeVersion) {
        Write-Host "❌ Node.js non è installato o non è nel PATH"
        Write-Host "   Installa Node.js da: https://nodejs.org/"
        Read-Host "Premi invio per uscire"
        exit 1
    }
    Write-Host "✓ Node.js $nodeVersion trovato"
} catch {
    Write-Host "❌ Errore nel verificare Node.js"
    exit 1
}

# Verifica che Express sia installato, altrimenti lo installa
Write-Host "Verifica delle dipendenze Node.js..."
try {
    npm list express --global --silent *>$null
} catch {
    Write-Host "Installazione di Express.js..."
    npm install -g express --silent
}

# Crea la cartella C:\VSC_SCRIPT_PDF se non esiste
$pdfFolder = "C:\VSC_SCRIPT_PDF"
if (-not (Test-Path $pdfFolder)) {
    New-Item -ItemType Directory -Path $pdfFolder -Force | Out-Null
    Write-Host "Cartella creata: $pdfFolder"
}

# Avvia il server Node.js in background
Write-Host "Avvio del server PDF..."
$serverProcess = Start-Process -FilePath "node" -ArgumentList $serverScript -PassThru -WindowStyle Hidden -NoNewWindow

# Aspetta che il server sia pronto
Start-Sleep -Seconds 3

# Verifica che il server sia avviato
$retries = 10
$serverReady = $false
while ($retries -gt 0) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8765/api/pdf-list" -UseBasicParsing -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            $serverReady = $true
            Write-Host "✓ Server avviato e pronto"
            break
        }
    } catch {
        # Server non ancora pronto
    }
    $retries--
    if ($retries -gt 0) {
        Start-Sleep -Seconds 1
    }
}

if (-not $serverReady) {
    Write-Host "❌ Il server non è riuscito ad avviarsi"
    $serverProcess | Stop-Process -Force
    exit 1
}

# Determina la posizione dello schermo secondario
$screen = [System.Windows.Forms.Screen]::AllScreens | Select-Object -Last 1
if ($screen -eq $null) {
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen
    Write-Host "Monitor secondario non trovato. Uso del monitor primario."
} else {
    Write-Host "Apertura su monitor secondario: $($screen.DeviceName)"
}

# Calcola la posizione della finestra
$x = $screen.Bounds.X
$y = $screen.Bounds.Y
$width = $screen.Bounds.Width
$height = $screen.Bounds.Height

# Prepara i parametri di Chrome per la modalità Kiosk
$chromeArgs = @(
    '--kiosk',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-client-side-phishing-detection',
    '--disable-component-update',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-hang-monitor',
    '--enable-automation',
    "--window-position=$x,$y",
    "--window-size=$width,$height",
    $htmlUrl
)

# Avvia Chrome in modalità Kiosk
Write-Host "Apertura di Chrome in modalità Kiosk..."
$chromeProcess = Start-Process -FilePath "chrome" -ArgumentList $chromeArgs -PassThru

# Aspetta che Chrome si chiuda
$chromeProcess | Wait-Process

# Chiudi il server quando Chrome si chiude
Write-Host "Chrome chiuso. Chiusura del server..."
$serverProcess | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "✓ Sessione terminata"
