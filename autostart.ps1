######################################################################
# autostart.ps1 - Wrapper per l'avvio automatico all'apertura della cartella
######################################################################

$RootPath = $PSScriptRoot
$LogFile = Join-Path $RootPath 'logs\autostart-task.log'
$StartupScript = Join-Path $RootPath 'startup.ps1'
$UnifiedPort = 5500

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

function Write-Log {
    param([string]$Message)
    $timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    "$timestamp $Message" | Out-File -FilePath $LogFile -Encoding UTF8 -Append
}

function Test-PortListening {
    param([int]$Port)
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($null -ne $connections -and $connections.Count -gt 0) { return $true }
    } catch {
    }
    try {
        $result = & netstat -ano 2>$null | Select-String ":$Port\s" | Select-String "LISTENING"
        return $null -ne $result
    } catch {
        return $false
    }
}

function Test-HttpEndpoint {
    param(
        [Parameter(Mandatory = $true)] [string] $Uri,
        [int] $TimeoutSeconds = 3
    )
    try {
        $request = [System.Net.HttpWebRequest]::Create($Uri)
        $request.Timeout = $TimeoutSeconds * 1000
        $request.Method = 'GET'
        $response = $request.GetResponse()
        $response.Close()
        return $true
    } catch {
        return $false
    }
}

function Start-MonitorLaunchers {
    param([string]$RootPath)

    $electronMain = Join-Path $RootPath 'electron\main.js'
    $electronCmd = Join-Path $RootPath 'node_modules\.bin\electron.cmd'
    $monitorPrefs = Join-Path $RootPath 'electron\monitor-preferences.json'
    $electronMainPattern = [Regex]::Escape($electronMain)

    if (-not (Test-Path $electronMain)) {
        Write-Log "AVVISO: Electron main non trovato: $electronMain"
        return
    }

    if (-not (Test-Path $electronCmd)) {
        Write-Log "AVVISO: Electron non installato (manca $electronCmd)."
        return
    }

    try {
        $prefsPayload = @{
            swapPrimarySecondary = $false
            updatedAt = (Get-Date).ToString('o')
            source = 'autostart.ps1'
        } | ConvertTo-Json
        [System.IO.File]::WriteAllText($monitorPrefs, $prefsPayload, [System.Text.UTF8Encoding]::new($false))
        Write-Log "OK Preferenze monitor Electron forzate: principale=bordero, secondario=display"
    } catch {
        Write-Log "AVVISO: impossibile aggiornare preferenze monitor Electron: $($_.Exception.Message)"
    }

    try {
        $existing = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -match '^electron(\.exe)?$' -and
                $_.CommandLine -match $electronMainPattern
            } |
            Select-Object -First 1

        if ($existing) {
            Write-Log "OK Electron dual monitor gia in esecuzione (PID: $($existing.ProcessId))"
            return
        }
    } catch {
        Write-Log "AVVISO: verifica processo Electron non disponibile: $($_.Exception.Message)"
    }

    try {
        $proc = Start-ProcessSafe -FilePath $electronCmd -ArgumentList @($electronMain) -WorkingDirectory $RootPath -WindowStyle Hidden -PassThru
        if ($proc -ne $null) {
            Write-Log "OK Electron dual monitor avviato (PID: $($proc.Id))"
        } else {
            Write-Log "ERRORE: impossibile avviare Electron dual monitor"
        }
    } catch {
        Write-Log "ERRORE: avvio Electron dual monitor fallito: $($_.Exception.Message)"
    }
}

Write-Log "Wrapper autostart in esecuzione."

# Load safe Start-Process helper if available
$helpers = Join-Path $PSScriptRoot 'scripts\ps_helpers.ps1'
if (Test-Path $helpers) {
    try {
        . $helpers
        if (-not (Get-Command -Name Start-ProcessSafe -ErrorAction SilentlyContinue)) {
            throw 'helper did not expose Start-ProcessSafe'
        }
    } catch {
        Write-Log "Helper PowerShell non disponibile, uso il fallback locale: $($_.Exception.Message)"
    }
}

if (-not (Test-Path $StartupScript)) {
    Write-Log "ERRORE: script di startup non trovato: $StartupScript"
    exit 0
}

if ((Test-HttpEndpoint -Uri "http://localhost:$($UnifiedPort)/") -and (Test-HttpEndpoint -Uri "http://localhost:$($UnifiedPort)/api/health" -TimeoutSeconds 2)) {
    Write-Log "Unified Server e Sync Server già in esecuzione. Avvio Electron dual monitor."
    Start-MonitorLaunchers -RootPath $RootPath
    exit 0
}

    try {
        $proc = Start-ProcessSafe -FilePath powershell.exe -ArgumentList @(
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-File',
            $StartupScript,
            '-NoWait'
        ) -WorkingDirectory $RootPath -WindowStyle Hidden -PassThru

        if ($null -ne $proc) {
            Write-Log "Startup avviato con successo. PID wrapper: $($proc.Id)."
        } else {
            Write-Log "ERRORE: Start-ProcessSafe non ha restituito un processo valido."
        }
    } catch {
        Write-Log "ERRORE: impossibile avviare lo startup automatico: $($_.Exception.Message)"
    }

exit 0
