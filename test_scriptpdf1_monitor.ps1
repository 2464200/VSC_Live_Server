╔════════════════════════════════════════════════════════════════════════════════╗
║         SCRIPTPDF1 - TEST AUTOMATICO MONITOR SECONDARIO                        ║
║              Valida l'intera configurazione in 5 minuti                         ║
╚════════════════════════════════════════════════════════════════════════════════╝

# Scritto per PowerShell 5.0+
# Esecuzione: powershell -File test_scriptpdf1_monitor.ps1

param(
    [string]$ServerUrl = "http://localhost:5500"
)

# Colori per output  
$Colors = @{
    Success = "Green"
    Error = "Red"
    Warning = "Yellow"
    Info = "Cyan"
    Section = "Magenta"
}

function Write-ColorOutput {
    param(
        [string]$Text,
        [string]$Type = "Info"
    )
    $color = $Colors[$Type] ?? "White"
    Write-Host $Text -ForegroundColor $color
}

function Test-ServerConnectivity {
    Write-ColorOutput "`n═══════════════════════════════════════════════════════" "Section"
    Write-ColorOutput "TEST 1: CONNESSIONE AL SERVER" "Section"
    Write-ColorOutput "═══════════════════════════════════════════════════════" "Section"
    
    try {
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/pdf-list" -UseBasicParsing -TimeoutSec 3
        
        if ($response.StatusCode -eq 200) {
            Write-ColorOutput "✅ Server è raggiungibile a $ServerUrl" "Success"
            Write-ColorOutput "   Status Code: $($response.StatusCode)" "Success"
            return $true
        }
    } catch {
        Write-ColorOutput "❌ Errore di connessione al server!" "Error"
        Write-ColorOutput "   Assicurati che il server stia eseguendo:" "Error"
        Write-ColorOutput "   cd C:\VSC_Live_Server; node unified-server.js" "Error"
        Write-ColorOutput "   Errore: $($_.Exception.Message)" "Error"
        return $false
    }
}

function Test-MonitorDetection {
    Write-ColorOutput "`n═══════════════════════════════════════════════════════" "Section"
    Write-ColorOutput "TEST 2: RILEVAMENTO MONITOR" "Section"
    Write-ColorOutput "═══════════════════════════════════════════════════════" "Section"
    
    try {
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/monitor-info" -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        
        $primary = $data.primaryMonitor
        $secondary = $data.secondaryMonitor
        
        Write-ColorOutput "✅ Rilevamento monitor completato" "Success"
        
        Write-ColorOutput "`n📊 MONITOR PRIMARIO:" "Info"
        Write-ColorOutput "   Posizione: X=$($primary.x), Y=$($primary.y)" "Info"
        Write-ColorOutput "   Dimensioni: $($primary.width)x$($primary.height)" "Info"
        
        Write-ColorOutput "`n📊 MONITOR SECONDARIO:" "Info"
        Write-ColorOutput "   Posizione: X=$($secondary.x), Y=$($secondary.y)" "Info"
        Write-ColorOutput "   Dimensioni: $($secondary.width)x$($secondary.height)" "Info"
        
        # Validazione
        if ($secondary.x -eq 0 -and $secondary.y -eq 0) {
            Write-ColorOutput "`n⚠️  Avviso: Il monitor secondario ha coordinate (0,0)" "Warning"
            Write-ColorOutput "    Potrebbero essere uguali al primario (un solo monitor?)" "Warning"
        } else {
            Write-ColorOutput "`n✅ Configurazione monitor corretta!" "Success"
        }
        
        return @{
            Primary = $primary
            Secondary = $secondary
        }
    } catch {
        Write-ColorOutput "❌ Errore nel rilevamento monitor!" "Error"
        Write-ColorOutput "   Errore: $($_.Exception.Message)" "Error"
        return $null
    }
}

function Test-PdfList {
    Write-ColorOutput "`n═══════════════════════════════════════════════════════" "Section"
    Write-ColorOutput "TEST 3: ELENCO PDF DISPONIBILI" "Section"
    Write-ColorOutput "═══════════════════════════════════════════════════════" "Section"
    
    try {
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/pdf-list" -UseBasicParsing
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.files.Count -gt 0) {
            Write-ColorOutput "✅ Trovati $($data.files.Count) file PDF:" "Success"
            
            foreach ($file in $data.files) {
                Write-ColorOutput "   📄 $($file.name) ($($file.size))" "Info"
            }
            
            return $data.files[0].name
        } else {
            Write-ColorOutput "⚠️  Nessun file PDF trovato in C:\VSC_SCRIPT_PDF" "Warning"
            Write-ColorOutput "   Copia almeno un file PDF in C:\VSC_SCRIPT_PDF e riprova" "Warning"
            return $null
        }
    } catch {
        Write-ColorOutput "❌ Errore nel caricamento lista PDF!" "Error"
        Write-ColorOutput "   Errore: $($_.Exception.Message)" "Error"
        return $null
    }
}

function Test-PdfOpening {
    param([string]$PdfFile, $MonitorInfo)
    
    Write-ColorOutput "`n═══════════════════════════════════════════════════════" "Section"
    Write-ColorOutput "TEST 4: APERTURA PDF SUL MONITOR SECONDARIO" "Section"
    Write-ColorOutput "═══════════════════════════════════════════════════════" "Section"
    
    if (-not $PdfFile) {
        Write-ColorOutput "⏭️  Saltato: Nessun file PDF disponibile" "Warning"
        return
    }
    
    try {
        $payload = @{
            filename = $PdfFile
        } | ConvertTo-Json
        
        $response = Invoke-WebRequest -Uri "$ServerUrl/api/open-pdf" `
            -Method POST `
            -ContentType "application/json" `
            -Body $payload `
            -UseBasicParsing
            
        $data = $response.Content | ConvertFrom-Json
        
        if ($data.success -eq $true) {
            Write-ColorOutput "✅ PDF aperto con successo!" "Success"
            Write-ColorOutput "   File: $PdfFile" "Info"
            Write-ColorOutput "   PID Chrome: $($data.pid)" "Info"
            
            if ($data.monitor) {
                Write-ColorOutput "`n📍 FINESTRA APERTA SU:" "Info"
                Write-ColorOutput "   Posizione: X=$($data.monitor.x), Y=$($data.monitor.y)" "Info"
                Write-ColorOutput "   Dimensioni: $($data.monitor.width)x$($data.monitor.height)" "Info"
                
                # Valida che sia sul monitor secondario
                if ($data.monitor.x -eq $MonitorInfo.Secondary.x) {
                    Write-ColorOutput "`n✅ Chrome è stato posizionato correttamente!" "Success"
                    Write-ColorOutput "   La finestra dovrebbe essere SUL MONITOR SECONDARIO" "Success"
                } else {
                    Write-ColorOutput "`n⚠️  Attenzione: Posizione potrebbe essere diversa dal previsto" "Warning"
                }
            }
            
            Write-ColorOutput "`n📋 Prossimi step:" "Info"
            Write-ColorOutput "   1. Guarda il monitor secondario: dovrebbe mostrare il PDF" "Info"
            Write-ColorOutput "   2. Se vedi il PDF, il sistema funziona correttamente!" "Info"
            Write-ColorOutput "   3. Il monitor principale rimane disponibile per i comandi" "Info"
            
            # Attendi un po' prima di chiudere
            Write-ColorOutput "`n⏳ Chrome rimane aperto per 10 secondi (poi viene chiuso)..." "Warning"
            Start-Sleep -Seconds 10
            
            # Chiudi Chrome
            try {
                $chromePid = $data.pid
                Stop-Process -Id $chromePid -Force 2>$null
                Write-ColorOutput "✅ Chrome chiuso correttamente" "Success"
            } catch {
                Write-ColorOutput "⚠️  Chrome era già chiuso" "Warning"
            }
            
        } else {
            Write-ColorOutput "❌ Errore nell'apertura del PDF!" "Error"
            Write-ColorOutput "   Messaggio: $($data.error)" "Error"
        }
    } catch {
        Write-ColorOutput "❌ Errore nella richiesta API!" "Error"
        Write-ColorOutput "   Errore: $($_.Exception.Message)" "Error"
    }
}

function Test-SystemResources {
    Write-ColorOutput "`n═══════════════════════════════════════════════════════" "Section"
    Write-ColorOutput "TEST 5: RISORSE DI SISTEMA" "Section"
    Write-ColorOutput "═══════════════════════════════════════════════════════" "Section"
    
    # Verificare processi Chrome
    try {
        $chromeProcesses = Get-Process chrome -ErrorAction SilentlyContinue
        $chromeCount = @($chromeProcesses).Count
        
        Write-ColorOutput "📊 Processi Chrome attivi: $chromeCount" "Info"
        
        if ($chromeCount -gt 0) {
            $totalMemory = ($chromeProcesses | Measure-Object WorkingSet -Sum).Sum / 1MB
            Write-ColorOutput "   Memoria totale: $([math]::Round($totalMemory, 2)) MB" "Info"
        }
    } catch {
        Write-ColorOutput "⚠️  Chrome non trovato, potrebbe non essere installato" "Warning"
    }
    
    # Verificare cartella PDF
    if (Test-Path "C:\VSC_SCRIPT_PDF") {
        $fileCount = @(Get-ChildItem -Path "C:\VSC_SCRIPT_PDF" -Filter "*.pdf" -ErrorAction SilentlyContinue).Count
        Write-ColorOutput "📁 File PDF in C:\VSC_SCRIPT_PDF: $fileCount" "Info"
    } else {
        Write-ColorOutput "⚠️  Cartella C:\VSC_SCRIPT_PDF non trovata" "Warning"
        Write-ColorOutput "   Crea la cartella e aggiungi file PDF" "Warning"
    }
}

function Show-Summary {
    Write-ColorOutput "`n╔════════════════════════════════════════════════════════╗" "Section"
    Write-ColorOutput "║           RIEPILOGO TEST COMPLETATO                   ║" "Section"
    Write-ColorOutput "╚════════════════════════════════════════════════════════╝" "Section"
    
    Write-ColorOutput "`n✅ COSA VERIFICARE MANUALMENTE:" "Success"
    Write-ColorOutput "   1. Apri http://localhost:5500/Prova/ScriptPDF1.html" "Info"
    Write-ColorOutput "   2. Seleziona un PDF dalla ComboBox" "Info"
    Write-ColorOutput "   3. Clicca 'Successivo ▶' o 'Precedente ◀'" "Info"
    Write-ColorOutput "   4. Chrome dovrebbe aprirsi sul monitor SECONDARIO" "Info"
    Write-ColorOutput "   5. La pagina rimane disponibile sul monitor PRINCIPALE" "Info"
    
    Write-ColorOutput "`n📊 COORDINATE MONITOR:" "Info"
    Write-ColorOutput "   Se le coordinate sono diverse da quelle previste," "Info"
    Write-ColorOutput "   modifica il file unified-server.js nella logica" "Info"
    Write-ColorOutput "   getSecondaryMonitorInfo() alla riga ~50" "Info"
    
    Write-ColorOutput "`n❓ DOMANDE FREQUENTI:" "Info"
    Write-ColorOutput "   P: Chrome si apre sul monitor sbagliato?" "Warning"
    Write-ColorOutput "   R: Verifica le coordinate in TEST 2" "Info"
    Write-ColorOutput "   " "Info"
    Write-ColorOutput "   P: Non vedo la pagina HTML?" "Warning"
    Write-ColorOutput "   R: Assicurati che il server Node.js sia in esecuzione" "Info"
    Write-ColorOutput "   " "Info"
    Write-ColorOutput "   P: Voglio personalizzare il posizionamento?" "Warning"
    Write-ColorOutput "   R: Vedi il file SCRIPTPDF1_MONITOR.txt" "Info"
    
    Write-ColorOutput "`n═══════════════════════════════════════════════════════" "Section"
}

# ════════════════════════════════════════════════════════════════════════════════
# ESECUZIONE DEI TEST
# ════════════════════════════════════════════════════════════════════════════════

Clear-Host
Write-ColorOutput "`n╔════════════════════════════════════════════════════════════╗" "Magenta"
Write-ColorOutput "║     TEST AUTOMATICO - SCRIPTPDF1 MONITOR SECONDARIO        ║" "Magenta"
Write-ColorOutput "║                                                            ║" "Magenta"
Write-ColorOutput "║  Questo script valida:                                     ║" "Magenta"
Write-ColorOutput "║  ✓ Connessione al server                                   ║" "Magenta"
Write-ColorOutput "║  ✓ Rilevamento monitor                                     ║" "Magenta"
Write-ColorOutput "║  ✓ Elenco file PDF                                         ║" "Magenta"
Write-ColorOutput "║  ✓ Apertura PDF su monitor secondario                      ║" "Magenta"
Write-ColorOutput "║  ✓ Risorse di sistema                                      ║" "Magenta"
Write-ColorOutput "║                                                            ║" "Magenta"
Write-ColorOutput "╚════════════════════════════════════════════════════════════╝" "Magenta"

# Esegui i test
$isConnected = Test-ServerConnectivity

if (-not $isConnected) {
    Write-ColorOutput "`n❌ I test sono stati interrotti perché il server non è disponibile." "Error"
    Write-ColorOutput "   Avvia il server e riprova:" "Error"
    Write-ColorOutput "   cd C:\VSC_Live_Server && node unified-server.js" "Error"
    exit 1
}

$monitorInfo = Test-MonitorDetection
$pdfFile = Test-PdfList

if ($pdfFile -and $monitorInfo) {
    Test-PdfOpening -PdfFile $pdfFile -MonitorInfo $monitorInfo
}

Test-SystemResources
Show-Summary

Write-ColorOutput "`n✅ Test completati!`n" "Success"
