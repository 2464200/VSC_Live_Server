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

function Test-ProjectRunnerProcess {
    param([Parameter(Mandatory = $true)][int]$ProcessId)

    try {
        $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop
    } catch {
        return $false
    }

    if (-not $processInfo -or -not $processInfo.CommandLine) { return $false }
    $runnerScript = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'run-unified-server.ps1')).Replace('/', '\')
    $commandLine = ([string]$processInfo.CommandLine).Replace('/', '\')
    return $commandLine.IndexOf($runnerScript, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
}

function Test-ProjectServerPort {
    param([Parameter(Mandatory = $true)][int]$Port)

    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 3
        $eventi = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/eventi/api/ping" -TimeoutSec 3
        return $health.status -eq 'ok' -and
            $health.server -eq 'unified-server' -and
            $eventi.ok -eq $true
    } catch {
        return $false
    }
}

New-Item -ItemType Directory -Path (Split-Path -Parent $SupervisorStopFile) -Force | Out-Null
Set-Content -LiteralPath $SupervisorStopFile -Value (Get-Date -Format o) -Encoding UTF8

Write-Host ""
Write-Host "========================================================"
Write-Host "           Arresto Automatico Server"
Write-Host "========================================================"
Write-Host ""

$startedPids = @()
$activePort = 0
if (Test-Path $PidFile) {
    try {
        $pidState = Get-Content -LiteralPath $PidFile -Raw | ConvertFrom-Json
        if ($pidState -is [array]) {
            $startedPids = @($pidState)
        } elseif ($pidState -is [System.Management.Automation.PSCustomObject] -and
            $pidState.PSObject.Properties['ProcessIds']) {
            $startedPids = @($pidState.ProcessIds)
            [void][int]::TryParse([string]$pidState.Port, [ref]$activePort)
        } else {
            $startedPids = @($pidState)
        }
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

# Use the port recorded by startup. For legacy PID arrays, discover the configured
# unified-server port only through the project's health and Eventi API responses.
$portsToCheck = @()
$verifiedActivePort = 0
if ($activePort -ge 1 -and $activePort -le 65535) {
    $portsToCheck = @($activePort)
    if (Test-ProjectServerPort -Port $activePort) { $verifiedActivePort = $activePort }
} else {
    $basePort = 5500
    $envFile = Join-Path $PSScriptRoot '.env'
    if (Test-Path -LiteralPath $envFile -PathType Leaf) {
        foreach ($line in Get-Content -LiteralPath $envFile) {
            if ($line -match '^\s*UNIFIED_PORT\s*=\s*["'']?(\d+)["'']?\s*(?:#.*)?$') {
                $configuredPort = 0
                if ([int]::TryParse($Matches[1], [ref]$configuredPort) -and $configuredPort -ge 1 -and $configuredPort -le 65515) {
                    $basePort = $configuredPort
                }
                break
            }
        }
    }
    $portsToCheck = @($basePort..($basePort + 19))
    foreach ($candidatePort in $portsToCheck) {
        if (Test-ProjectServerPort -Port ([int]$candidatePort)) {
            $verifiedActivePort = [int]$candidatePort
            break
        }
    }
    if ($verifiedActivePort -gt 0) { $portsToCheck = @($verifiedActivePort) }
}

# Stop an optional deploy only after the project identity is verified on its actual port.
if ($verifiedActivePort -gt 0) {
    try {
        $deployStop = Invoke-RestMethod -Uri "http://127.0.0.1:$verifiedActivePort/api/admin/deploy/project-shutdown" `
            -Method Post -ContentType 'application/json' -Body '{}' -TimeoutSec 5
        if ($deployStop.ok) {
            Write-Host "Deploy Firebase arrestato per la chiusura del progetto"
        }
    } catch {
        Write-Host "Server deploy non raggiungibile; continuo con l'arresto dei processi"
    }
} else {
    Write-Host "Server unificato non verificato; salto la richiesta di arresto deploy."
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
                    if (Test-ProjectRunnerProcess -ProcessId ([int]$processId)) {
                        Write-Host "  Termino runner e processi figli PID $processId ($($proc.Name))"
                        & taskkill.exe /PID ([string]$processId) /T /F 2>&1 | Out-Null
                        if ($LASTEXITCODE -eq 0 -or -not (Get-Process -Id $processId -ErrorAction SilentlyContinue)) {
                            $terminatedCount++
                        } else {
                            Write-Warning "  Impossibile arrestare l'albero del runner PID $processId"
                        }
                    } else {
                        Write-Host "  Termino PID $processId ($($proc.Name))"
                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                        $terminatedCount++
                    }
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

# Arresto selettivo solo sulla porta attiva registrata o verificata
Write-Host ""
Write-Host "Arresto selettivo processi Node.js sulla porta del progetto..."
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
