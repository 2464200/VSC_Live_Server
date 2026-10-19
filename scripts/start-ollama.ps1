param(
    [ValidateRange(5, 300)]
    [int]$ReadyTimeoutSeconds = 60
)

$ErrorActionPreference = 'Stop'
$apiBase = 'http://127.0.0.1:11434'

function Test-OllamaReady {
    try {
        $response = Invoke-RestMethod -Uri "$apiBase/api/version" -TimeoutSec 2
        return -not [string]::IsNullOrWhiteSpace($response.version)
    } catch {
        return $false
    }
}

if (Test-OllamaReady) {
    Write-Output "Ollama e gia disponibile su $apiBase."
    exit 0
}

# Serialize startup when more than one VS Code window opens this project.
$startupMutex = [System.Threading.Mutex]::new($false, 'Local\VSCode-Ollama-11434')
$lockTaken = $false

try {
    try {
        $lockTaken = $startupMutex.WaitOne(($ReadyTimeoutSeconds + 5) * 1000)
    } catch [System.Threading.AbandonedMutexException] {
        $lockTaken = $true
    }
    if (-not $lockTaken) {
        throw 'Un altro avvio di Ollama non si e concluso entro il tempo previsto.'
    }

    if (Test-OllamaReady) {
        Write-Output "Ollama e gia disponibile su $apiBase."
        exit 0
    }

    $ollamaCommand = Get-Command 'ollama.exe' -CommandType Application -ErrorAction SilentlyContinue
    if ($ollamaCommand) {
        $ollamaPath = $ollamaCommand.Source
    } else {
        $ollamaPath = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
        if (-not (Test-Path -LiteralPath $ollamaPath -PathType Leaf)) {
            throw 'Ollama non trovato. Installarlo o aggiungere ollama.exe al PATH.'
        }
    }

    $logsPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'logs'
    New-Item -ItemType Directory -Path $logsPath -Force | Out-Null
    $stdoutPath = Join-Path $logsPath 'ollama.stdout.log'
    $stderrPath = Join-Path $logsPath 'ollama.stderr.log'

    $server = Start-Process -FilePath $ollamaPath -ArgumentList 'serve' `
        -WorkingDirectory (Split-Path -Parent $ollamaPath) -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru

    $deadline = [DateTime]::UtcNow.AddSeconds($ReadyTimeoutSeconds)
    do {
        if (Test-OllamaReady) {
            Write-Output "Ollama disponibile su $apiBase."
            exit 0
        }
        if ($server.HasExited) {
            throw "Ollama si e arrestato durante l'avvio. Controllare $stderrPath."
        }
        Start-Sleep -Milliseconds 500
    } while ([DateTime]::UtcNow -lt $deadline)

    throw "Ollama non risponde dopo $ReadyTimeoutSeconds secondi. Controllare $stderrPath."
} catch {
    Write-Error -Message $_ -ErrorAction Continue
    exit 1
} finally {
    if ($lockTaken) {
        $startupMutex.ReleaseMutex()
    }
    $startupMutex.Dispose()
}
