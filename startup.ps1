######################################################################
# startup.ps1 - Avvio automatico del server unificato
######################################################################

param(
    [switch]$NoWait = $false
)

Write-Host ""
Write-Host "========================================================"
Write-Host "  Avvio Automatico Sistema - Nessun Input Richiesto"
Write-Host "========================================================"
Write-Host ""

$RootPath = $PSScriptRoot
$UnifiedPort = 5500
$PidFile = Join-Path $RootPath '.startup-pids.json'
$LogsDir = Join-Path $RootPath 'logs'

function Test-PortListening {
    param([int]$Port)
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($connections -ne $null -and $connections.Count -gt 0) {
            return $true
        }
    } catch {
    }

    try {
        $result = & netstat -ano 2>$null | Select-String ":$Port\s" | Select-String "LISTENING"
        return $result -ne $null
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

function Save-Pids {
    param([int[]]$Pids)
    if ($Pids -and $Pids.Count -gt 0) {
        $Pids | ConvertTo-Json | Set-Content -Path $PidFile -Encoding UTF8
        Write-Host "OK PID salvati: $($Pids -join ', ')"
    } elseif (Test-Path $PidFile) {
        Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    }
}

function Cleanup-OldProcesses {
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

    if (-not (Test-Path $LogsDir)) {
        New-Item -ItemType Directory -Path $LogsDir -Force | Out-Null
    }

    $stdoutLog = Join-Path $LogsDir 'unified-server.stdout.log'
    $stderrLog = Join-Path $LogsDir 'unified-server.stderr.log'

    Write-Host "Avvio Unified Server..."
    try {
        $proc = Start-Process -FilePath powershell.exe `
            -ArgumentList @(
                '-ExecutionPolicy',
                'Bypass',
                '-File',
                $runnerScript,
                '-RootPath',
                $RootPath,
                '-StdoutLog',
                $stdoutLog,
                '-StderrLog',
                $stderrLog
            ) `
            -WorkingDirectory $RootPath `
            -WindowStyle Hidden `
            -PassThru

        if (-not $proc) {
            Write-Host "ERRORE FATALE: impossibile avviare il processo host PowerShell" -ForegroundColor Red
            exit 1
        }

        Write-Host "OK Unified Server avviato (PID: $($proc.Id))"

        if (-not (Wait-ForPort -Port $UnifiedPort -TimeoutSeconds 15)) {
            Write-Host "ERRORE FATALE: Unified Server non risponde sulla porta $UnifiedPort" -ForegroundColor Red
            Write-Host "  Log stdout: $stdoutLog"
            Write-Host "  Log stderr: $stderrLog"
            try {
                Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
            } catch {
            }
            exit 1
        }

        return $proc.Id
    } catch {
        Write-Host "ERRORE FATALE: Impossibile avviare Unified Server - $_" -ForegroundColor Red
        exit 1
    }
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

Write-Host "Progetto: $RootPath"
Write-Host "Unified Server: porta $UnifiedPort"
Write-Host ""

Cleanup-OldProcesses
Stop-NodeListenersOnPort -Port $UnifiedPort

$startedPids = @()
$processId = Start-UnifiedServer
if ($processId) { $startedPids += $processId }
Save-Pids -Pids $startedPids

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
Write-Host "  Homepage:    http://localhost:$UnifiedPort/index.html"
Write-Host "  PDF:         http://localhost:$UnifiedPort/Prova/ScriptPDF1.html"
Write-Host "  Diagnostica: http://localhost:$UnifiedPort/diagnostica.html"
Write-Host "  Eventi:      http://localhost:$UnifiedPort/eventi/eventi.html"
Write-Host ""
Write-Host "Server integrati:"
Write-Host "  - Unified Server (porta $UnifiedPort): Web + PDF + Eventi"
Write-Host ""

if (-not $NoWait) {
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
