param(
    [string]$RootPath,
    [string]$StdoutLog,
    [string]$StderrLog,
    [int]$Port = 0
)

if (-not $RootPath) {
    $RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
}

$serverScript = Join-Path $RootPath 'unified-server.js'

if (-not (Test-Path $serverScript)) {
    Write-Error "unified-server.js non trovato in $RootPath"
    exit 1
}

Set-Location $RootPath

if ($Port -gt 0) {
    $env:UNIFIED_PORT = [string]$Port
}

& node $serverScript 1>> $StdoutLog 2>> $StderrLog
exit $LASTEXITCODE
