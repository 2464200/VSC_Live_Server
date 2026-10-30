######################################################################
# startup.ps1 - Avvio automatico del server unificato
######################################################################

param(
    [switch]$NoWait = $false,
    [switch]$NoMonitor = $false,
    [int]$PortOverride = 0,
    [ValidateRange(1, 600)] [int]$ServerReadyTimeoutSeconds = 60
)

Write-Host ""
Write-Host "========================================================"
Write-Host "  Avvio Automatico Sistema - Nessun Input Richiesto"
Write-Host "========================================================"
Write-Host ""

$RootPath = $PSScriptRoot
$UnifiedPort = 5500
$UnifiedPorts = @()
$PidDir = Join-Path $RootPath 'pids'
$PidFile = Join-Path $PidDir 'startup-pids.json'
$LogsDir = Join-Path $RootPath 'logs'

function Start-ProcessSafe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)] [string] $FilePath,
        [Parameter()] [string[]] $ArgumentList,
        [Parameter()] [string] $WorkingDirectory,
        [Parameter()] [System.Diagnostics.ProcessWindowStyle] $WindowStyle = 'Hidden',
        [Parameter()] [Switch] $PassThru,
        [Parameter()] [string] $Verb
    )

    try {
        $splat = @{ FilePath = $FilePath; WindowStyle = $WindowStyle }
        if ($ArgumentList) { $splat['ArgumentList'] = $ArgumentList }
        if ($WorkingDirectory) { $splat['WorkingDirectory'] = $WorkingDirectory }
        if ($PassThru) { $splat['PassThru'] = $true }
        if ($Verb) { $splat['Verb'] = $Verb }
        return Start-Process @splat
    } catch {
        Write-Warning "Start-ProcessSafe fallback failed: $($_.Exception.Message)"
        return $null
    }
}

# Load helpers
$helpers = Join-Path $PSScriptRoot 'scripts\ps_helpers.ps1'
if (Test-Path $helpers) {
    try {
        . $helpers
        if (-not (Get-Command -Name Start-ProcessSafe -ErrorAction SilentlyContinue)) {
            throw 'helper did not expose Start-ProcessSafe'
        }
    } catch {
        Write-Host "AVVISO: helper PowerShell non disponibile, uso il fallback locale."
    }
}

function Test-PortListening {
    param([int]$Port)
    # Loopback readiness does not need slow WMI/netstat scans or elevated rights.
    $client = New-Object System.Net.Sockets.TcpClient
    $connection = $null
    try {
        $connection = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $connection.AsyncWaitHandle.WaitOne(250)) { return $false }
        $client.EndConnect($connection)
        return $client.Connected
    } catch {
        return $false
    } finally {
        if ($connection) { $connection.AsyncWaitHandle.Close() }
        $client.Close()
    }
}

function Get-PortCandidates {
    $basePort = 5500
    if ($PortOverride -ge 1 -and $PortOverride -le 65515) {
        $basePort = $PortOverride
    }
    $envFile = Join-Path $RootPath '.env'
    if ($PortOverride -le 0 -and (Test-Path $envFile)) {
        foreach ($line in Get-Content $envFile) {
            if ($line -match '^\s*UNIFIED_PORT\s*=\s*["'']?(\d+)["'']?\s*(?:#.*)?$') {
                $parsedPort = [int]$Matches[1]
                if ($parsedPort -ge 1 -and $parsedPort -le 65515) { $basePort = $parsedPort }
                break
            }
        }
    }

    $script:UnifiedPorts = @($basePort..($basePort + 19))
    return $script:UnifiedPorts
}

function Test-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)] [string] $Uri,
        [int] $TimeoutSeconds = 3
    )

    try {
        $request = [System.Net.HttpWebRequest]::Create($Uri)
        $request.Timeout = $TimeoutSeconds * 1000
        $request.Proxy = $null
        $request.Method = 'GET'
        $response = $request.GetResponse()
        $response.Close()
        return $true
    } catch {
        return $false
    }
}

function Wait-ForPort {
    param(
        [int]$Port,
        [int]$TimeoutSeconds = 15
    )

    Write-Host "  Attendo porta $Port..."
    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-PortListening -Port $Port) {
            Write-Host "  OK Porta $Port attiva"
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Get-LocalJsonResponse {
    param([Parameter(Mandatory = $true)] [string]$Uri)
    $request = [System.Net.HttpWebRequest]::Create($Uri)
    $request.Proxy = $null
    $request.Timeout = 2000
    $request.ReadWriteTimeout = 2000
    $response = $request.GetResponse()
    try {
        $reader = New-Object System.IO.StreamReader($response.GetResponseStream())
        try { return ($reader.ReadToEnd() | ConvertFrom-Json) } finally { $reader.Dispose() }
    } finally { $response.Close() }
}

function Wait-ForHttpEndpoint {
    param(
        [Parameter(Mandatory = $true)] [string] $Uri,
        [int] $TimeoutSeconds = 15
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-HttpEndpoint -Uri $Uri -TimeoutSeconds 2) {
            return $true
        }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

function Save-Pids {
    param([int[]]$Pids)
    if ($Pids -and $Pids.Count -gt 0) {
        if (-not (Test-Path $PidDir)) {
            New-Item -ItemType Directory -Path $PidDir -Force | Out-Null
        }
        [pscustomobject]@{
            ProcessIds = @($Pids | Sort-Object -Unique)
            Port = [int]$UnifiedPort
        } | ConvertTo-Json -Depth 3 | Set-Content -Path $PidFile -Encoding UTF8
        Write-Host "OK PID salvati: $($Pids -join ', ')"
    } elseif (Test-Path $PidFile) {
        Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    }
}

function Start-MonitorLaunchers {
    param([string]$RootPath)

    $electronMain = Join-Path $RootPath 'electron\main.js'
    $electronCmd = Join-Path $RootPath 'node_modules\.bin\electron.cmd'
    $monitorPrefs = Join-Path $RootPath 'electron\monitor-preferences.json'
    $electronMainPattern = [Regex]::Escape($electronMain)

    if (-not (Test-Path $electronMain)) {
        Write-Host "AVVISO: Electron main non trovato: $electronMain" -ForegroundColor Yellow
        return $null
    }

    if (-not (Test-Path $electronCmd)) {
        Write-Host "AVVISO: Electron non installato (manca $electronCmd). Eseguire npm install." -ForegroundColor Yellow
        return $null
    }

    try {
        if (-not (Test-Path $monitorPrefs)) {
            $prefsPayload = @{
                primaryMonitorChoice = $null
                swapPrimarySecondary = $false
                selectionConfirmed = $false
                updatedAt = (Get-Date).ToString('o')
                source = 'startup.ps1-default'
            } | ConvertTo-Json

            $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
            [System.IO.File]::WriteAllText($monitorPrefs, $prefsPayload, $utf8NoBom)
            Write-Host "OK Preferenze monitor inizializzate (scelta monitor richiesta al primo avvio Electron)"
        } else {
            Write-Host "OK Preferenze monitor Electron gia presenti: mantengo scelta utente"
        }
    } catch {
        Write-Host "AVVISO: impossibile aggiornare le preferenze monitor Electron - $_" -ForegroundColor Yellow
    }

    try {
        $existing = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -match '^electron(\.exe)?$' -and
                $_.CommandLine -match $electronMainPattern
            } |
            Select-Object -First 1

        if ($existing) {
            Write-Host "OK Electron dual monitor gia in esecuzione (PID: $($existing.ProcessId))"
            return [int]$existing.ProcessId
        }
    } catch {
        Write-Host "AVVISO: verifica processo Electron non disponibile, provo avvio diretto" -ForegroundColor Yellow
    }

    Write-Host "Avvio Electron dual monitor..."
    try {
        $proc = Start-ProcessSafe -FilePath $electronCmd -ArgumentList @($electronMain) -WorkingDirectory $RootPath -WindowStyle Hidden -PassThru
        if (-not $proc) {
            Write-Host "AVVISO: impossibile avviare Electron dual monitor" -ForegroundColor Yellow
            return $null
        }

        Write-Host "OK Electron dual monitor avviato (PID: $($proc.Id))"
        Write-Host "  - Monitor principale: /Bordero/pages/bordero.html"
        Write-Host "  - Monitor secondario: /Bordero/pages/display.html"
        return $proc.Id
    } catch {
        Write-Host "AVVISO: errore avvio Electron dual monitor - $_" -ForegroundColor Yellow
        return $null
    }
}

function Clear-OldProcesses {
    Write-Host "Pulizia processi precedenti..."
    $oldPids = @()
    if (Test-Path $PidFile) {
        try {
            $oldPids = Get-Content $PidFile | ConvertFrom-Json
        } catch {
            Write-Host "AVVISO: File PID corrotto, procedo comunque..."
        }
    }

    foreach ($processId in $oldPids) {
        try {
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($proc) {
                Write-Host "  Termino processo vecchio PID $processId`: $($proc.Name)"
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
            }
        } catch {
        }
    }

    if (Test-Path $PidFile) {
        Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    }
}

function Stop-NodeListenersOnPort {
    param([int]$Port)

    Write-Host "Verifica processi Node.js sulla porta $Port..."
    $stopped = 0

    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                try {
                    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                    if ($proc -and $proc.Name -eq 'node') {
                        Write-Host "  Termino processo Node.js PID $($proc.Id) gia in ascolto sulla porta $Port"
                        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                        $stopped++
                    }
                } catch {
                }
            }
        }
    } catch {
    }

    if ($stopped -eq 0) {
        try {
            $netstatLines = & netstat -ano 2>$null | Select-String ":$Port\s" | Select-String "LISTENING"
            foreach ($line in $netstatLines) {
                $parts = ($line.ToString() -split '\s+') | Where-Object { $_ -ne '' }
                if ($parts.Length -ge 5) {
                    $processId = [int]$parts[-1]
                    try {
                        $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
                        if ($proc -and $proc.Name -eq 'node') {
                            Write-Host "  Termino processo Node.js PID $($proc.Id) gia in ascolto sulla porta $Port"
                            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                            $stopped++
                        }
                    } catch {
                    }
                }
            }
        } catch {
        }
    }

    if ($stopped -gt 0) {
        Start-Sleep -Seconds 1
        Write-Host "  OK Pulizia porta $Port completata ($stopped processi terminati)"
    } else {
        Write-Host "  Nessun processo Node.js da terminare sulla porta $Port"
    }
}

function Start-UnifiedServer {
    param([int]$Port)
    $serverScript = Join-Path $RootPath 'unified-server.js'
    $runnerScript = Join-Path $RootPath 'run-unified-server.ps1'
    if (-not (Test-Path $serverScript)) {
        Write-Host "ERRORE FATALE: unified-server.js non trovato" -ForegroundColor Red
        exit 1
    }
    if (-not (Test-Path $runnerScript)) {
        Write-Host "ERRORE FATALE: run-unified-server.ps1 non trovato" -ForegroundColor Red
        exit 1
    }

    $firebaseCli = Join-Path $RootPath 'node_modules\firebase-tools\lib\bin\firebase.js'
    if (-not (Test-Path $firebaseCli)) {
        Write-Host "Firebase CLI locale assente. Installo le dipendenze del progetto..." -ForegroundColor Yellow
        Push-Location $RootPath
        try {
            & npm install --no-fund --no-audit
            if ($LASTEXITCODE -ne 0) {
                Write-Host "ERRORE FATALE: installazione dipendenze fallita (codice $LASTEXITCODE)" -ForegroundColor Red
                exit 1
            }
        } finally {
            Pop-Location
        }
    }
    if (-not (Test-Path $firebaseCli)) {
        Write-Host "ERRORE FATALE: Firebase CLI locale non trovato dopo npm install" -ForegroundColor Red
        exit 1
    }

    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
    }

    $stdoutLog = Join-Path $LogsDir 'unified-server.stdout.log'
    $stderrLog = Join-Path $LogsDir 'unified-server.stderr.log'

    Write-Host "Avvio Unified Server..."
    try {
        $proc = Start-ProcessSafe -FilePath powershell.exe -ArgumentList @(
                '-NoProfile',
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                $runnerScript,
                '-RootPath',
                $RootPath,
                '-StdoutLog',
                $stdoutLog,
                '-StderrLog',
                $stderrLog,
                '-Port',
                [string]$Port
            ) -WorkingDirectory $RootPath -WindowStyle Hidden -PassThru

        if (-not $proc) {
            Write-Host "ERRORE FATALE: impossibile avviare il processo host PowerShell" -ForegroundColor Red
            exit 1
        }

        Write-Host "OK Unified Server avviato (PID: $($proc.Id))"
        $null = $proc.Handle

        Write-Host "  Attendo le API del server (massimo $ServerReadyTimeoutSeconds secondi)..."
        $activePort = Find-ActiveUnifiedPort -PortWaitSeconds $ServerReadyTimeoutSeconds -StartedProcess $proc
        if (-not $activePort) {
            $proc.Refresh()
            if ($proc.HasExited) {
                Write-Host "ERRORE FATALE: il processo host si e chiuso prima che le API fossero pronte (codice $($proc.ExitCode))." -ForegroundColor Red
            } else {
                Write-Host "ERRORE FATALE: Unified Server non pronto entro $ServerReadyTimeoutSeconds secondi sulle porte $($UnifiedPorts -join ', ')" -ForegroundColor Red
            }
            Write-Host "  Log stdout: $stdoutLog"
            Write-Host "  Log stderr: $stderrLog"
            try {
                if (-not $proc.HasExited) {
                    # Stop only the newly launched tree, including Node, so a retry cannot leave an orphan server.
                    & taskkill.exe /PID $proc.Id /T /F 2>&1 | Out-Null
                }
            } catch {
            }
            exit 1
        }

        $script:UnifiedPort = $activePort

        Write-Host "  Verifico API Unified ed Eventi..."
        $healthUri = "http://127.0.0.1:$($activePort)/api/health"
        $eventiPingUri = "http://127.0.0.1:$($activePort)/eventi/api/ping"
        if (-not (Test-HttpEndpoint -Uri $healthUri -TimeoutSeconds 3) -or -not (Test-HttpEndpoint -Uri $eventiPingUri -TimeoutSeconds 3)) {
            Write-Host "ERRORE FATALE: la porta $activePort non risponde alle API del server unificato." -ForegroundColor Red
            Write-Host "  Log stdout: $stdoutLog"
            Write-Host "  Log stderr: $stderrLog"
            try {
                & taskkill.exe /PID $proc.Id /T /F 2>&1 | Out-Null
            } catch {
            }
            exit 1
        }

        Write-Host "  OK API Unified ed Eventi attive"

        return $proc.Id
    } catch {
        Write-Host "ERRORE FATALE: Impossibile avviare Unified Server - $_" -ForegroundColor Red
        exit 1
    }
}

function Invoke-WebcamProfiling {
    param(
        [int]$Port
    )

    $probeUrl = "http://localhost:$($Port)/api/userform/pagina05/cameras/probe"
    Write-Host "Profilazione webcam di sistema (FFmpeg + CSV)..."

    try {
        $response = Invoke-RestMethod -Uri $probeUrl -Method Get -TimeoutSec 30
        if ($response -and $response.ok) {
            $count = [int]($response.count | ForEach-Object { $_ })
            $physical = [int]($response.physicalCount | ForEach-Object { $_ })
            $added = [int]($response.systemCamera.addedCount | ForEach-Object { $_ })
            $updated = [int]($response.systemCamera.updatedCount | ForEach-Object { $_ })
            Write-Host "OK Profilazione completata: profili=$count, webcam fisiche=$physical, nuove=$added, aggiornate=$updated"
        } else {
            Write-Host "AVVISO: Profilazione webcam non riuscita (risposta inattesa)" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "AVVISO: Profilazione webcam non disponibile - $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

function Find-ActiveUnifiedPort {
    param(
        [int]$PortWaitSeconds = 0,
        [System.Diagnostics.Process]$StartedProcess = $null
    )

    $deadline = (Get-Date).AddSeconds($PortWaitSeconds)
    do {
        if ($StartedProcess) {
            $StartedProcess.Refresh()
            if ($StartedProcess.HasExited) { return $null }
        }
        foreach ($port in $UnifiedPorts) {
            if ($PortWaitSeconds -gt 0 -and (Get-Date) -ge $deadline) { return $null }
            $healthUri = "http://127.0.0.1:$port/api/health"
            $eventiPingUri = "http://127.0.0.1:$port/eventi/api/ping"
            if (-not (Test-PortListening -Port $port)) { continue }
            try {
                # A fresh PowerShell process must not spend its readiness budget on proxy autodetection.
                $health = Get-LocalJsonResponse -Uri $healthUri
                $eventiPing = Get-LocalJsonResponse -Uri $eventiPingUri
                if ($health.status -eq 'ok' -and $health.server -eq 'unified-server' -and $eventiPing.ok -eq $true) {
                    return [int]$port
                }
            } catch {
                # A listening port is not enough: only accept this project's
                # health payload and its Eventi API response.
            }
        }
        if ($PortWaitSeconds -le 0 -or (Get-Date) -ge $deadline) { break }
        Start-Sleep -Milliseconds 500
    } while ((Get-Date) -lt $deadline)

    return $null
}

try {
    $nodeVersion = & node --version 2>$null
    if (-not $nodeVersion) {
        throw "Node.js non trovato"
    }
    Write-Host "OK Node.js: $nodeVersion"
} catch {
    Write-Host "ERRORE FATALE: Node.js non trovato o non funzionante" -ForegroundColor Red
    exit 1
}

$envFile = Join-Path $RootPath '.env'
$envExample = Join-Path $RootPath '.env.example'
if (-not (Test-Path $envFile) -and (Test-Path $envExample)) {
    Copy-Item -Path $envExample -Destination $envFile
    Write-Host 'File .env creato dai valori predefiniti.'
}

Get-PortCandidates | Out-Null
$UnifiedPort = $UnifiedPorts[0]

Write-Host "Progetto: $RootPath"
Write-Host "Unified Server: porta $UnifiedPort"
Write-Host ""

$startedPids = @()

# Verifica che una porta supportata sia realmente servita dall'applicazione unificata, incluse le API Eventi.
$existingPort = Find-ActiveUnifiedPort
if ($existingPort) {
    $UnifiedPort = $existingPort
    Write-Host "Server già in esecuzione sulla porta $UnifiedPort - Nessuna azione necessaria"
    if ($NoWait) {
        Write-Host "Avvio rapido completato: salto le operazioni opzionali post-avvio."
        return [int]$UnifiedPort
    }
    # Electron is the part the user waits for. Start it before camera probing
    # and report generation so those independent tasks run while its windows load.
    try {
        $electronPid = Start-MonitorLaunchers -RootPath $RootPath
        if ($electronPid) { $startedPids += [int]$electronPid; Save-Pids -Pids $startedPids }
    } catch {
        Write-Host "AVVISO: impossibile avviare Electron dual monitor - $_" -ForegroundColor Yellow
    }
    Write-Host ""
    Write-Host "Generazione dati report..."
    try {
        $pythonExe = Join-Path $RootPath '.venv\Scripts\python.exe'
        if (-not (Test-Path $pythonExe)) { $pythonExe = 'python' }
        & $pythonExe (Join-Path $RootPath 'generate_report_data.py') 2>&1 | Out-Null
        Write-Host "OK Dati report aggiornati"
    } catch {
        Write-Host "AVVISO: Impossibile aggiornare dati report - $_"
    }
    Write-Host ""
    Write-Host "========================================================"
    Write-Host "        SISTEMA GIÀ OPERATIVO"
    Write-Host "========================================================"
    Write-Host ""
    Write-Host "URL per accesso:"
    Write-Host "  Homepage:    http://localhost:$($UnifiedPort)/index.html"
    Write-Host "  Mobile:      http://localhost:$($UnifiedPort)/public/mobile1.html"
    Write-Host ""
    Invoke-WebcamProfiling -Port $UnifiedPort
    exit 0
}

$selectedPort = $null
foreach ($candidatePort in $UnifiedPorts) {
    if (-not (Test-PortListening -Port $candidatePort)) {
        $selectedPort = [int]$candidatePort
        break
    }
}
if (-not $selectedPort) {
    Write-Host "ERRORE FATALE: nessuna porta libera nell'intervallo $($UnifiedPorts[0])-$($UnifiedPorts[-1])" -ForegroundColor Red
    exit 1
}
if ($selectedPort -ne $UnifiedPorts[0]) {
    Write-Host "Porta $($UnifiedPorts[0]) occupata da un altro servizio: uso la porta libera $selectedPort." -ForegroundColor Yellow
}
$UnifiedPort = $selectedPort

$processId = Start-UnifiedServer -Port $UnifiedPort
if ($processId) { $startedPids += $processId }
$syncProcessId = $null
if ($syncProcessId) { $startedPids += $syncProcessId }
Save-Pids -Pids $startedPids

if ($NoWait) {
    Write-Host "Avvio rapido completato: server unificato pronto sulla porta $UnifiedPort."
    return [int]$UnifiedPort
}

# Electron startup is independent of webcam profiling and report generation.
# Launch it as soon as the server is healthy so both windows can load in parallel
# with these existing post-start tasks.
try {
    $electronPid = Start-MonitorLaunchers -RootPath $RootPath
    if ($electronPid) { $startedPids += [int]$electronPid; Save-Pids -Pids $startedPids }
} catch {
    Write-Host "AVVISO: impossibile avviare Electron dual monitor - $_" -ForegroundColor Yellow
}

Invoke-WebcamProfiling -Port $UnifiedPort

Write-Host ""
Write-Host "Generazione iniziale dati report..."
try {
    $pythonExe = Join-Path $RootPath '.venv\Scripts\python.exe'
    if (-not (Test-Path $pythonExe)) { $pythonExe = 'python' }
    & $pythonExe (Join-Path $RootPath 'generate_report_data.py') 2>&1 | Out-Null
    Write-Host "OK Dati report generati"
} catch {
    Write-Host "AVVISO: Impossibile generare dati report iniziali - $_"
}

Write-Host ""
Write-Host "========================================================"
Write-Host "        SISTEMA COMPLETAMENTE OPERATIVO"
Write-Host "========================================================"
Write-Host ""
Write-Host "URL per accesso:"
Write-Host "  Homepage:    http://localhost:$($UnifiedPort)/index.html"
Write-Host "  PDF:         http://localhost:$($UnifiedPort)/USERFORM/pages/SCRIPT-PDF.html"
Write-Host "  Diagnostica: http://localhost:$($UnifiedPort)/diagnostica.html"
Write-Host "  Eventi:      http://localhost:$($UnifiedPort)/eventi/eventi.html"
Write-Host ""
Write-Host "Server integrati:"
Write-Host "  - Unified Server (porta $UnifiedPort): Web + PDF + Eventi"
Write-Host "  - Bordero Sync API integrato nel Unified Server (porta $UnifiedPort)"
Write-Host ""

if (-not $NoWait -and -not $NoMonitor) {
    Write-Host "Eseguito in foreground. Premi Ctrl+C per terminare tutti i server..."
    while ($true) {
        $allRunning = $true
        foreach ($id in $startedPids) {
            if (-not (Get-Process -Id $id -ErrorAction SilentlyContinue)) {
                $allRunning = $false
            }
        }

        if (-not $allRunning) {
            Write-Host "Uno o piu server si sono chiusi. Terminazione..."
            break
        }

        Start-Sleep -Seconds 5
    }
}
