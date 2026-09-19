function Start-ProcessSafe {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory=$true)] [string] $FilePath,
        [Parameter()] [string[]] $ArgumentList,
        [Parameter()] [string] $WorkingDirectory,
        [Parameter()] [System.Diagnostics.ProcessWindowStyle] $WindowStyle = 'Hidden',
        [Parameter()] [Switch] $PassThru,
        [Parameter()] [string] $Verb,
        [Parameter()] [Switch] $NoNewWindow
    )

    # Check if FilePath is a URL - Start-Process can open URLs
    if ($FilePath -match '^[a-zA-Z]+:\/\/') {
        try {
            $splat = @{ FilePath = $FilePath; WindowStyle = $WindowStyle }
            if ($ArgumentList) { $splat['ArgumentList'] = $ArgumentList }
            if ($PassThru) { $splat['PassThru'] = $true }
            if ($NoNewWindow) { $splat['NoNewWindow'] = $true }
            if ($PassThru) { return Start-Process @splat }
            Start-Process @splat; return $null
        } catch { Write-Warning "Start-Process failed for URL $FilePath: $($_.Exception.Message)"; return $null }
    }

    # If FilePath is an absolute path, check it exists; otherwise try Get-Command
    $found = $false
    if (Test-Path $FilePath) { $found = $true }
    else {
        try {
            $cmd = Get-Command $FilePath -ErrorAction SilentlyContinue
            if ($cmd) { $found = $true }
        } catch { $found = $false }
    }

    if (-not $found) {
        Write-Warning "Start-ProcessSafe: executable not found or not invokable: $FilePath"
        return $null
    }

    $splat = @{ FilePath = $FilePath }
    if ($ArgumentList) { $splat['ArgumentList'] = $ArgumentList }
    if ($WorkingDirectory) { $splat['WorkingDirectory'] = $WorkingDirectory }
    if ($WindowStyle) { $splat['WindowStyle'] = $WindowStyle }
    if ($PassThru) { $splat['PassThru'] = $true }
    if ($Verb) { $splat['Verb'] = $Verb }
    if ($NoNewWindow) { $splat['NoNewWindow'] = $true }

    try {
        return Start-Process @splat
    } catch {
        Write-Warning "Start-ProcessSafe: failed to start $FilePath: $($_.Exception.Message)"
        return $null
    }
}

Export-ModuleMember -Function Start-ProcessSafe
