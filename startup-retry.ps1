param(
    [int]$MaxAttempts = 3,
    [int]$RetryDelaySeconds = 3,
    [switch]$NoWait
)

$RootPath = $PSScriptRoot
$StartupScript = Join-Path $RootPath 'startup.ps1'

if (-not (Test-Path $StartupScript)) {
    Write-Host "ERRORE FATALE: startup.ps1 non trovato in $RootPath" -ForegroundColor Red
    exit 1
}

$attempt = 0
$exitCode = 1

while ($attempt -lt $MaxAttempts) {
    $attempt++
    Write-Host ""
    Write-Host "=== Tentativo $attempt di $MaxAttempts ==="

    $startupArguments = @(
        '-NoProfile',
        '-ExecutionPolicy',
        'Bypass',
        '-WindowStyle',
        'Hidden',
        '-File',
        $StartupScript
    )
    if ($NoWait) { $startupArguments += '-NoWait' }

    $process = Start-Process -FilePath 'powershell.exe' `
        -ArgumentList $startupArguments `
        -WorkingDirectory $RootPath `
        -PassThru `
        -Wait

    $exitCode = $process.ExitCode

    if ($exitCode -eq 0) {
        Write-Host "OK Avvio completato con successo al tentativo $attempt." -ForegroundColor Green
        break
    }

    if ($attempt -lt $MaxAttempts) {
        Write-Host "startup.ps1 fallito con codice $exitCode. Nuovo tentativo tra $RetryDelaySeconds secondi..." -ForegroundColor Yellow
        Start-Sleep -Seconds $RetryDelaySeconds
    }
}

if ($exitCode -ne 0) {
    Write-Host "ERRORE FATALE: startup.ps1 non riuscito dopo $MaxAttempts tentativi." -ForegroundColor Red
}

exit $exitCode
