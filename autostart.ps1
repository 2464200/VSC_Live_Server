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

if (Test-PortListening -Port $UnifiedPort) {
    Write-Log "Unified Server già in esecuzione sulla porta $UnifiedPort. Nessun avvio aggiuntivo necessario."
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

        if ($proc -ne $null) {
            Write-Log "Startup avviato con successo. PID wrapper: $($proc.Id)."
        } else {
            Write-Log "ERRORE: Start-ProcessSafe non ha restituito un processo valido."
        }
    } catch {
        Write-Log "ERRORE: impossibile avviare lo startup automatico: $_"
    }

exit 0
