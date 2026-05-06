######################################################################
# autostart.ps1 - Wrapper per l'avvio automatico all'apertura della cartella
######################################################################

$RootPath = $PSScriptRoot
$LogFile = Join-Path $RootPath 'logs\autostart-task.log'
$StartupScript = Join-Path $RootPath 'startup.ps1'
$UnifiedPort = 5500

function Write-Log {
    param([string]$Message)
    $timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
    "$timestamp $Message" | Out-File -FilePath $LogFile -Encoding UTF8 -Append
}

function Test-PortListening {
    param([int]$Port)
    try {
        $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
        if ($connections -ne $null -and $connections.Count -gt 0) { return $true }
    } catch {
    }
    try {
        $result = & netstat -ano 2>$null | Select-String ":$Port\s" | Select-String "LISTENING"
        return $result -ne $null
    } catch {
        return $false
    }
}

Write-Log "Wrapper autostart in esecuzione."

if (-not (Test-Path $StartupScript)) {
    Write-Log "ERRORE: script di startup non trovato: $StartupScript"
    exit 0
}

if (Test-PortListening -Port $UnifiedPort) {
    Write-Log "Unified Server già in esecuzione sulla porta $UnifiedPort. Nessun avvio aggiuntivo necessario."
    exit 0
}

try {
    $proc = Start-Process -FilePath powershell.exe -ArgumentList @(
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        $StartupScript,
        '-NoWait'
    ) -WorkingDirectory $RootPath -WindowStyle Hidden -PassThru

    if ($proc -ne $null) {
        Write-Log "Startup avviato con successo. PID wrapper: $($proc.Id)."
    } else {
        Write-Log "ERRORE: Start-Process non ha restituito un processo valido."
    }
} catch {
    Write-Log "ERRORE: impossibile avviare lo startup automatico: $_"
}

exit 0
