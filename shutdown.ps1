######################################################################
# shutdown.ps1 - Arresta tutti i server avviati automaticamente
######################################################################

param(
    [switch]$Force = $false
)

$PidFile = Join-Path $PSScriptRoot 'pids\startup-pids.json'

Write-Host ""
Write-Host "========================================================"
Write-Host "           Arresto Automatico Server"
Write-Host "========================================================"
Write-Host ""

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
                Write-Host "  Termino PID $processId ($($proc.Name))"
                Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                $terminatedCount++
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
$portsToCheck = @(5500, 5501)
$nodeProcessesTerminated = 0

foreach ($port in $portsToCheck) {
    try {
        # Trova processi che ascoltano sulla porta
        $connections = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($connections) {
            foreach ($conn in $connections) {
                try {
                    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
                    if ($proc -and $proc.Name -eq 'node') {
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
                        if ($proc -and $proc.Name -eq 'node') {
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

# Git commit automatico
try {
    & git add . 2>$null
    $commitMessage = "Auto save on exit $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    & git commit -m $commitMessage 2>$null
    Write-Host "OK Commit automatico eseguito: $commitMessage"
} catch {
    Write-Host "Nessun cambiamento da committare o errore git: $_"
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
