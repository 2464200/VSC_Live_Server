param(
    [ValidateRange(1, 60)]
    [int]$CheckIntervalSeconds = 5,
    [ValidateRange(5, 120)]
    [int]$ElectronStartupTimeoutSeconds = 45
)

$ErrorActionPreference = 'Stop'
$rootPath = Split-Path -Parent $PSScriptRoot
$startupRetryScript = Join-Path $rootPath 'startup-retry.ps1'
$electronMain = Join-Path $rootPath 'electron\main.js'
$electronCommand = Join-Path $rootPath 'node_modules\.bin\electron.cmd'
$pidFile = Join-Path $rootPath 'pids\startup-pids.json'
$stopFile = Join-Path $rootPath 'pids\stop-supervisor.flag'
$helpers = Join-Path $rootPath 'scripts\ps_helpers.ps1'

if (Test-Path -LiteralPath $helpers) {
    . $helpers
}

if (-not (Test-Path -LiteralPath $startupRetryScript -PathType Leaf)) {
    throw "Script di avvio non trovato: $startupRetryScript"
}
if (-not (Test-Path -LiteralPath $electronMain -PathType Leaf)) {
    throw "Entry point Electron non trovato: $electronMain"
}
if (-not (Test-Path -LiteralPath $electronCommand -PathType Leaf)) {
    throw "Comando Electron non trovato: $electronCommand"
}

New-Item -ItemType Directory -Path (Split-Path -Parent $pidFile) -Force | Out-Null
Remove-Item -LiteralPath $stopFile -Force -ErrorAction SilentlyContinue

function Get-ProjectElectronProcesses {
    $electronMainPattern = [Regex]::Escape($electronMain)
    return @(Get-CimInstance Win32_Process -ErrorAction Stop | Where-Object {
        $_.Name -match '^electron(\.exe)?$'
        -and $_.CommandLine
        -and $_.CommandLine -match $electronMainPattern
    })
}

function Update-StartupProcessIds {
    param([int[]]$ElectronProcessIds = @())

    $processIds = @()
    if (Test-Path -LiteralPath $pidFile -PathType Leaf) {
        try {
            $storedIds = @(Get-Content -LiteralPath $pidFile -Raw | ConvertFrom-Json)
            foreach ($storedId in $storedIds) {
                $id = 0
                if ([int]::TryParse([string]$storedId, [ref]$id) -and (Get-Process -Id $id -ErrorAction SilentlyContinue)) {
                    $processIds += $id
                }
            }
        } catch {
            throw "Impossibile leggere il file PID del progetto '$pidFile': $($_.Exception.Message)"
        }
    }

    $processIds += $ElectronProcessIds
    $processIds = @($processIds | Sort-Object -Unique)
    if ($processIds.Count -gt 0) {
        $processIds | ConvertTo-Json | Set-Content -LiteralPath $pidFile -Encoding UTF8
    }
}

function Start-ProjectElectron {
    Write-Host '[supervisor] Avvio Electron dual monitor...'
    $process = Start-ProcessSafe -FilePath $electronCommand `
        -ArgumentList @($electronMain) `
        -WorkingDirectory $rootPath `
        -WindowStyle Hidden `
        -PassThru

    if (-not $process) {
        throw 'Impossibile avviare Electron dual monitor.'
    }

    $deadline = [DateTime]::UtcNow.AddSeconds($ElectronStartupTimeoutSeconds)
    do {
        $electronProcesses = Get-ProjectElectronProcesses
        if ($electronProcesses.Count -gt 0) {
            $electronIds = @($electronProcesses | ForEach-Object { [int]$_.ProcessId })
            Update-StartupProcessIds -ElectronProcessIds $electronIds
            Write-Host "[supervisor] Electron attivo (PID: $($electronIds -join ', '))."
            return $electronProcesses
        }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)

    throw "Electron non è diventato operativo entro $ElectronStartupTimeoutSeconds secondi."
}

function Confirm-ElectronRestart {
    Add-Type -AssemblyName System.Windows.Forms
    $answer = [System.Windows.Forms.MessageBox]::Show(
        'Electron dual monitor è stato chiuso. Vuoi riaprirlo?',
        'Bordero - Riavvio Electron',
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question,
        [System.Windows.Forms.MessageBoxDefaultButton]::Button2
    )
    return $answer -eq [System.Windows.Forms.DialogResult]::Yes
}

Write-Host '[supervisor] Avvio verificato dei servizi del progetto...'
$startupProcess = Start-ProcessSafe -FilePath 'powershell.exe' `
    -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        $startupRetryScript,
        '-NoMonitor'
    ) `
    -WorkingDirectory $rootPath `
    -NoNewWindow `
    -PassThru

if (-not $startupProcess) {
    throw 'Impossibile avviare startup-retry.ps1.'
}

$startupProcess.WaitForExit()
$startupProcess.Refresh()
if ($startupProcess.ExitCode -ne 0) {
    throw "Avvio dei servizi non riuscito (codice $($startupProcess.ExitCode))."
}

$electronProcesses = Get-ProjectElectronProcesses
if ($electronProcesses.Count -eq 0) {
    $electronProcesses = Start-ProjectElectron
} else {
    $electronIds = @($electronProcesses | ForEach-Object { [int]$_.ProcessId })
    Update-StartupProcessIds -ElectronProcessIds $electronIds
    Write-Host "[supervisor] Electron già attivo (PID: $($electronIds -join ', '))."
}

Write-Host '[supervisor] Servizi pronti; monitoraggio attivo.'
$electronWasRunning = $true
$electronRestartDeclined = $false
$serverWasReady = $true

while ($true) {
    if (Test-Path -LiteralPath $stopFile -PathType Leaf) {
        Write-Host '[supervisor] Arresto del progetto richiesto; termino il monitoraggio.'
        break
    }

    $electronProcesses = Get-ProjectElectronProcesses
    if ($electronProcesses.Count -gt 0) {
        $electronWasRunning = $true
        $electronRestartDeclined = $false
        $electronIds = @($electronProcesses | ForEach-Object { [int]$_.ProcessId })
        Update-StartupProcessIds -ElectronProcessIds $electronIds
    } elseif ($electronWasRunning -and -not $electronRestartDeclined) {
        $electronWasRunning = $false
        try {
            if (Confirm-ElectronRestart) {
                if (Test-Path -LiteralPath $stopFile -PathType Leaf) {
                    Write-Host '[supervisor] Arresto del progetto richiesto durante la conferma.'
                    break
                }
                $electronProcesses = Start-ProjectElectron
                $electronWasRunning = $electronProcesses.Count -gt 0
            } else {
                $electronRestartDeclined = $true
                Update-StartupProcessIds
                Write-Host '[supervisor] Riavvio Electron rifiutato; continuo a monitorare i servizi.'
            }
        } catch {
            $electronRestartDeclined = $true
            Write-Warning "Riavvio Electron non riuscito: $($_.Exception.Message)"
        }
    }

    $serverReady = $false
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:5500/api/health' -TimeoutSec 3
        $eventi = Invoke-RestMethod -Uri 'http://127.0.0.1:5500/eventi/api/ping' -TimeoutSec 3
        $serverReady = $health.status -eq 'ok'
            -and $health.server -eq 'unified-server'
            -and $eventi.ok -eq $true
    } catch {
        $serverReady = $false
    }

    if ($serverReady -ne $serverWasReady) {
        if ($serverReady) {
            Write-Host '[supervisor] Unified Server ed Eventi sono nuovamente disponibili.'
        } else {
            Write-Warning '[supervisor] Unified Server o API Eventi non rispondono; il monitoraggio continua.'
        }
        $serverWasReady = $serverReady
    }

    Start-Sleep -Seconds $CheckIntervalSeconds
}

Write-Host '[supervisor] Supervisione terminata.'
