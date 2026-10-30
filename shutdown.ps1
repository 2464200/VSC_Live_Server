######################################################################
# shutdown.ps1 - Arresta tutti i server avviati automaticamente
######################################################################

param(
    [switch]$Force = $false,
    [switch]$AutoCommit = $false
)

$PidFile = Join-Path $PSScriptRoot 'pids\startup-pids.json'
$SupervisorStopFile = Join-Path $PSScriptRoot 'pids\stop-supervisor.flag'
$AutoCommitFailed = $false

function Test-ProjectProcess {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    try {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    } catch {
        Write-Warning "Impossibile verificare il proprietario del PID $ProcessId; non lo termino."
        return $false
    }

    if (-not $processInfo -or -not $processInfo.CommandLine) {
        return $false
    }

    $commandLine = ([string]$processInfo.CommandLine).Replace('/', '\')
    $projectEntries = @(
        (Join-Path $PSScriptRoot 'electron\main.js'),
        (Join-Path $PSScriptRoot 'unified-server.js'),
        (Join-Path $PSScriptRoot 'run-unified-server.ps1')
    )

    foreach ($entry in $projectEntries) {
        $normalizedEntry = [System.IO.Path]::GetFullPath($entry).Replace('/', '\')
        if ($commandLine.IndexOf($normalizedEntry, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            return $true
        }
    }

    return $false
}

New-Item -ItemType Directory -Path (Split-Path -Parent $SupervisorStopFile) -Force | Out-Null
Set-Content -LiteralPath $SupervisorStopFile -Value (Get-Date -Format o) -Encoding UTF8

Write-Host ""
Write-Host "========================================================"
Write-Host "           Arresto Automatico Server"
Write-Host "========================================================"
Write-Host ""

# Disattiva e annulla il deploy prima di terminare il server unificato.
try {
    $deployStop = Invoke-RestMethod -Uri 'http://127.0.0.1:5500/api/admin/deploy/project-shutdown' `
        -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 5
    if ($deployStop.ok) {
        Write-Host "Deploy Firebase arrestato per la chiusura del progetto"
    }
} catch {
    Write-Host "Server deploy non raggiungibile; continuo con l'arresto dei processi"
}

$startedPids = @()
if (Test-Path $PidFile) {
    try {
        $startedPids = Get-Content $PidFile | ConvertFrom-Json
        Write-Host "OK File PID trovato: $($startedPids.Count) processi da terminare"
    } catch {
        Write-Host "ERRORE: File PID corrotto - $_"
        if (-not $Force) {
            Write-Host "Usa -Force per procedere con arresto selettivo"
            exit 1
        }
    }
} else {
    Write-Host "Nessun file PID trovato. Arresto selettivo..."
    $startedPids = @()
}

# Arresto processi per PID
$terminatedCount = 0
if ($startedPids -and $startedPids.Count -gt 0) {
    Write-Host "Termino processi gestiti:"
    foreach ($processId in $startedPids) {
        try {
            $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
            if ($proc) {
                if (Test-ProjectProcess -ProcessId ([int]$processId)) {
                    Write-Host "  Termino PID $processId ($($proc.Name))"
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    $terminatedCount++
                } else {
                    Write-Warning "  PID $processId non appartiene a questo progetto; non lo termino."
                }
            } else {
                Write-Host "  PID $processId già terminato"
            }
        } catch {
            Write-Host "  ERRORE terminando PID $processId - $_"
        }
    }
}

# Arresto selettivo per sicurezza (cerca processi Node.js sulle porte note)
Write-Host ""
Write-Host "Arresto selettivo processi Node.js sulle porte note..."
$portsToCheck = @(5500)
$nodeProcessesTerminated = 0

foreach ($port in $portsToCheck) {
    try {
        # Trova processi che ascoltano sulla porta
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                try {
                    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                    if ($proc -and $proc.Name -eq 'node' -and (Test-ProjectProcess -ProcessId ([int]$proc.Id))) {
                        Write-Host "  Termino processo Node.js PID $($proc.Id) (porta $port)"
                        Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                        $nodeProcessesTerminated++
                    }
                } catch {
                    # Ignora errori per processi già terminati
                }
            }
        }
    } catch {
        # Fallback per sistemi senza Get-NetTCPConnection
        try {
            $netstat = & netstat -ano 2>$null | Select-String ":$port\s" | Select-String "LISTENING"
            if ($netstat) {
                $pidMatch = $netstat | Select-String "\s+(\d+)$" | ForEach-Object { $_.Matches.Groups[1].Value }
                if ($pidMatch) {
                    try {
                        $proc = Get-Process -Id $pidMatch -ErrorAction SilentlyContinue
                        if ($proc -and $proc.Name -eq 'node' -and (Test-ProjectProcess -ProcessId ([int]$proc.Id))) {
                            Write-Host "  Termino processo Node.js PID $($proc.Id) (porta $port)"
                            Stop-Process -Id $proc.Id -Force -ErrorAction SilentlyContinue
                            $nodeProcessesTerminated++
                        }
                    } catch {
                        # Ignora
                    }
                }
            }
        } catch {
            # Sistema non supporta netstat, ignora
        }
    }
}

# Pulizia file PID
if (Test-Path $PidFile) {
    Remove-Item -Path $PidFile -Force -ErrorAction SilentlyContinue
    Write-Host "OK File PID rimosso"
}

# Consolidamento e salvataggio automatico
Write-Host ""
Write-Host "Eseguo consolidamento progetto..."

# Sync CSVs
$syncScript = Join-Path $PSScriptRoot ".github\skills\csv-manager\scripts\sync_csvs.ps1"
if (Test-Path $syncScript) {
    try {
        & $syncScript
        Write-Host "OK Sincronizzazione CSV completata"
    } catch {
        Write-Host "ERRORE durante sincronizzazione CSV: $_"
    }
} else {
    Write-Host "Script sync_csvs.ps1 non trovato"
}

# Git commit automatico (opt-in)
if ($AutoCommit) {
    try {
        & git add -A
        if ($LASTEXITCODE -ne 0) {
            throw "git add -A non riuscito (codice $LASTEXITCODE)."
        }

        & git diff --cached --quiet
        $diffExitCode = $LASTEXITCODE
        if ($diffExitCode -eq 0) {
            Write-Host "Nessuna modifica da committare."
        } elseif ($diffExitCode -eq 1) {
            $commitMessage = "Auto save on exit $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
            & git commit -m $commitMessage
            if ($LASTEXITCODE -ne 0) {
                throw "git commit non riuscito (codice $LASTEXITCODE)."
            }
            Write-Host "OK Commit automatico eseguito: $commitMessage"
        } else {
            throw "Impossibile verificare le modifiche in stage (codice $diffExitCode)."
        }
    } catch {
        $AutoCommitFailed = $true
        Write-Error "Commit automatico non riuscito: $($_.Exception.Message)"
    }
} else {
    Write-Host "Auto-commit disattivato (usa -AutoCommit per abilitarlo)."
}

Write-Host ""
Write-Host "========================================================"
Write-Host "              Shutdown Completato"
Write-Host "========================================================"
Write-Host ""
Write-Host "Processi terminati:"
Write-Host "  - Gestiti: $terminatedCount"
Write-Host "  - Selettivi: $nodeProcessesTerminated"
Write-Host "  - Totale: $($terminatedCount + $nodeProcessesTerminated)"
Write-Host ""

if ($AutoCommitFailed) {
    exit 1
}
