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

    # Start-Process joins ArgumentList into one command-line string. Quote each
    # value using Windows command-line rules so paths with spaces survive.
    $quotedArguments = @()
    foreach ($argument in $ArgumentList) {
        $value = [string]$argument
        if ($value -notmatch '[\s"]') {
            $quotedArguments += $value
            continue
        }

        $builder = New-Object System.Text.StringBuilder
        [void]$builder.Append('"')
        $slashes = 0
        foreach ($character in $value.ToCharArray()) {
            if ($character -eq '\') {
                $slashes++
            } elseif ($character -eq '"') {
                [void]$builder.Append(('\' * (($slashes * 2) + 1)))
                [void]$builder.Append('"')
                $slashes = 0
            } else {
                if ($slashes -gt 0) { [void]$builder.Append(('\' * $slashes)) }
                [void]$builder.Append($character)
                $slashes = 0
            }
        }
        if ($slashes -gt 0) { [void]$builder.Append(('\' * ($slashes * 2))) }
        [void]$builder.Append('"')
        $quotedArguments += $builder.ToString()
    }

    # Check if FilePath is a URL - Start-Process can open URLs
    if ($FilePath -match '^[a-zA-Z]+:\/\/') {
        try {
            $splat = @{ FilePath = $FilePath; WindowStyle = $WindowStyle }
            if ($quotedArguments) { $splat['ArgumentList'] = $quotedArguments }
            if ($PassThru) { $splat['PassThru'] = $true }
            if ($NoNewWindow) { $splat['NoNewWindow'] = $true }
            if ($PassThru) { return Start-Process @splat }
            Start-Process @splat; return $null
        } catch { Write-Warning "Start-Process failed for URL ${FilePath}: $($_.Exception.Message)"; return $null }
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
    if ($quotedArguments) { $splat['ArgumentList'] = $quotedArguments }
    if ($WorkingDirectory) { $splat['WorkingDirectory'] = $WorkingDirectory }
    if ($WindowStyle) { $splat['WindowStyle'] = $WindowStyle }
    if ($PassThru) { $splat['PassThru'] = $true }
    if ($Verb) { $splat['Verb'] = $Verb }
    if ($NoNewWindow) { $splat['NoNewWindow'] = $true }

    try {
        return Start-Process @splat
    } catch {
        Write-Warning "Start-ProcessSafe: failed to start ${FilePath}: $($_.Exception.Message)"
        return $null
    }
}
