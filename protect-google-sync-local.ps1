param(
    [ValidateSet('snapshot', 'restore', 'install-hooks', 'verify', 'auto-backup', 'status')]
    [string]$Action = 'status',
    [switch]$Quiet
)

$ErrorActionPreference = 'Stop'

function Write-Info([string]$Message) {
    if (-not $Quiet) {
        Write-Host $Message
    }
}

function Get-RepoRoot {
    $root = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($root)) {
        throw 'Esegui lo script da un repository Git valido.'
    }
    return $root.Trim()
}

function Get-ProtectedFiles {
    return @(
        'Bordero/server/google-sheets-sync.js',
        'Bordero/server/sync-server.js',
        'electron/main.js',
        'Bordero/js/home-nav-guard.js',
        'Bordero/pages/bordero.html',
        'Bordero/pages/bordero.css',
        'Bordero/pages/bordero.js',
        'Bordero/pages/admin.html',
        'Bordero/pages/bordero-presentazione.html',
        'Bordero/pages/brani-eseguiti.html',
        'Bordero/pages/display.html',
        'Bordero/pages/elenco-richieste.html',
        'Bordero/pages/lista-serata.html',
        'Bordero/pages/location.html',
        'Bordero/pages/next-coreo.html',
        'Bordero/pages/risultati.html',
        'Bordero/pages/video-player.html',
        'Bordero/pages/videoclip.html',
        'Bordero/data/brani.csv',
        'Bordero/data/comuni_italia.csv',
        'Bordero/pages/elenco-richieste.js',
        'unified-server.js',
        'protect-google-sync-local.ps1',
        'Bordero/pages/display.js',
        'Bordero/pages/display.css',
        'Bordero/pages/videoclip.js'
    )
}

function New-DirIfMissing([string]$Path) {
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Invoke-Snapshot([string]$RepoRoot, [string]$StoreDir, [string[]]$Files) {
    New-DirIfMissing $StoreDir

    foreach ($relativePath in $Files) {
        $source = Join-Path $RepoRoot $relativePath
        if (-not (Test-Path $source)) {
            Write-Warning "File non trovato, salto snapshot: $relativePath"
            continue
        }

        $target = Join-Path $StoreDir $relativePath
        $targetDir = Split-Path -Parent $target
        New-DirIfMissing $targetDir
        Copy-Item -Path $source -Destination $target -Force
        Write-Info "Snapshot aggiornato: $relativePath"
    }

    $manifestPath = Join-Path $StoreDir 'protected-files.txt'
    ($Files -join [Environment]::NewLine) | Set-Content -Path $manifestPath -Encoding UTF8
    Write-Info "Manifest aggiornato: .local/protected-google-sync/protected-files.txt"
}

function Invoke-Restore([string]$RepoRoot, [string]$StoreDir, [string[]]$Files) {
    $restored = 0

    foreach ($relativePath in $Files) {
        $backup = Join-Path $StoreDir $relativePath
        if (-not (Test-Path $backup)) {
            continue
        }

        $destination = Join-Path $RepoRoot $relativePath
        $destinationDir = Split-Path -Parent $destination
        New-DirIfMissing $destinationDir
        Copy-Item -Path $backup -Destination $destination -Force
        $restored += 1
        Write-Info "Ripristinato: $relativePath"
    }

    if ($restored -eq 0) {
        Write-Info 'Nessun file ripristinato (snapshot mancante).'
    } else {
        Write-Info "Ripristino completato: $restored file."
    }
}

function Install-Hook([string]$HookPath, [string]$ScriptPath, [ValidateSet('restore', 'snapshot')][string]$Action) {
    $hookCommand = "  powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$ScriptPath' -Action $Action -Quiet"
    $hookContent = @(
        '#!/bin/sh',
        'if command -v powershell.exe >/dev/null 2>&1; then',
        $hookCommand,
        'fi',
        'exit 0'
    ) -join "`n"

    Set-Content -Path $HookPath -Value $hookContent -Encoding ASCII
}

function Install-PreCommitHook([string]$HookPath, [string]$ScriptPath) {
    $hookContent = @(
        '#!/bin/sh',
        '# Bypass only when explicitly requested: ALLOW_PROTECTED_CHANGES=1 git commit ...',
        'if [ "$ALLOW_PROTECTED_CHANGES" = "1" ]; then',
        '  exit 0',
        'fi',
        'if command -v powershell.exe >/dev/null 2>&1; then',
        "  powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$ScriptPath' -Action verify -Quiet",
        '  status=$?',
        '  if [ $status -ne 0 ]; then',
        '    exit $status',
        '  fi',
        'fi',
        'exit 0'
    ) -join "`n"

    Set-Content -Path $HookPath -Value $hookContent -Encoding ASCII
}

function Get-StagedFiles([string]$RepoRoot) {
    Push-Location $RepoRoot
    try {
        $output = & git diff --cached --name-only --diff-filter=ACMR
        if ($LASTEXITCODE -ne 0) {
            throw 'Impossibile leggere i file staged.'
        }

        $items = @()
        foreach ($line in $output) {
            $value = [string]$line
            if (-not [string]::IsNullOrWhiteSpace($value)) {
                $items += $value.Trim()
            }
        }

        return $items
    } finally {
        Pop-Location
    }
}

function Invoke-Verify([string]$RepoRoot, [string[]]$Files) {
    $staged = Get-StagedFiles -RepoRoot $RepoRoot
    if (-not $staged -or $staged.Count -eq 0) {
        return
    }

    $protectedSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
    foreach ($path in $Files) {
        [void]$protectedSet.Add($path)
    }

    $blocked = @()
    foreach ($candidate in $staged) {
        if ($protectedSet.Contains($candidate)) {
            $blocked += $candidate
        }
    }

    if ($blocked.Count -gt 0) {
        $lines = @(
            'Commit bloccato: stai modificando file protetti.',
            'Se la modifica e voluta e approvata, riesegui il commit con:',
            '  ALLOW_PROTECTED_CHANGES=1 git commit ...',
            'File bloccati:'
        ) + ($blocked | ForEach-Object { " - $_" })
        throw ($lines -join [Environment]::NewLine)
    }
}

function Get-AutoBackupEveryCommits {
    $defaultValue = 5
    $envValue = [Environment]::GetEnvironmentVariable('VSC_AUTO_BACKUP_EVERY_COMMITS', 'Process')
    if ([string]::IsNullOrWhiteSpace($envValue)) {
        $envValue = [Environment]::GetEnvironmentVariable('VSC_AUTO_BACKUP_EVERY_COMMITS', 'User')
    }
    if ([string]::IsNullOrWhiteSpace($envValue)) {
        $envValue = [Environment]::GetEnvironmentVariable('VSC_AUTO_BACKUP_EVERY_COMMITS', 'Machine')
    }

    $parsed = 0
    if ([int]::TryParse([string]$envValue, [ref]$parsed) -and $parsed -gt 0) {
        return $parsed
    }

    return $defaultValue
}

function Invoke-AutoBackup([string]$RepoRoot) {
    $every = Get-AutoBackupEveryCommits
    $backupDir = Join-Path $RepoRoot '.local/git-backups'
    $docBackupDir = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'VSC_Live_Server_backups'
    $stateFile = Join-Path $backupDir 'auto-backup-state.json'

    New-DirIfMissing $backupDir
    New-DirIfMissing $docBackupDir

    $counter = 0
    if (Test-Path $stateFile) {
        try {
            $state = Get-Content -Path $stateFile -Raw -Encoding UTF8 | ConvertFrom-Json
            if ($state -and $state.counter -as [int] -ge 0) {
                $counter = [int]$state.counter
            }
        } catch {
            $counter = 0
        }
    }

    $counter += 1

    if ($counter -lt $every) {
        @{
            counter = $counter
            every = $every
            updatedAt = (Get-Date).ToString('o')
        } | ConvertTo-Json | Set-Content -Path $stateFile -Encoding UTF8
        return
    }

    $timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $name = "VSC_Live_Server-$timestamp.bundle"
    $repoBundle = Join-Path $backupDir $name
    $docBundle = Join-Path $docBackupDir $name

    Push-Location $RepoRoot
    try {
        & git bundle create $repoBundle --all
        if ($LASTEXITCODE -ne 0) {
            throw 'Creazione bundle automatica fallita.'
        }
    } finally {
        Pop-Location
    }

    Copy-Item -Path $repoBundle -Destination $docBundle -Force

    $head = ''
    Push-Location $RepoRoot
    try {
        $head = (& git rev-parse --short HEAD 2>$null)
        if ($LASTEXITCODE -ne 0) {
            $head = ''
        }
    } finally {
        Pop-Location
    }

    @{
        counter = 0
        every = $every
        updatedAt = (Get-Date).ToString('o')
        lastBackupCommit = [string]$head
        lastBackupRepoPath = $repoBundle
        lastBackupDocPath = $docBundle
    } | ConvertTo-Json | Set-Content -Path $stateFile -Encoding UTF8

    Write-Info "Backup automatico creato: $repoBundle"
    Write-Info "Copia backup automatico: $docBundle"
}

function Install-PostCommitBackupHook([string]$HookPath, [string]$ScriptPath) {
    $hookContent = @(
        '#!/bin/sh',
        '# Disable if needed for a single commit: DISABLE_AUTO_LOCAL_BACKUP=1 git commit ...',
        'if [ "$DISABLE_AUTO_LOCAL_BACKUP" = "1" ]; then',
        '  exit 0',
        'fi',
        'if command -v powershell.exe >/dev/null 2>&1; then',
        "  powershell.exe -NoProfile -ExecutionPolicy Bypass -File '$ScriptPath' -Action auto-backup || true",
        'fi',
        'exit 0'
    ) -join "`n"

    Set-Content -Path $HookPath -Value $hookContent -Encoding ASCII
}

function Invoke-InstallHooks([string]$RepoRoot, [string]$ScriptPath) {
    $hooksDir = Join-Path $RepoRoot '.git/hooks'
    New-DirIfMissing $hooksDir

    $postMergeHook = Join-Path $hooksDir 'post-merge'
    $postRewriteHook = Join-Path $hooksDir 'post-rewrite'
    $postCheckoutHook = Join-Path $hooksDir 'post-checkout'
    $preCommitHook = Join-Path $hooksDir 'pre-commit'
    $postCommitHook = Join-Path $hooksDir 'post-commit'

    Install-Hook -HookPath $postMergeHook -ScriptPath $ScriptPath -Action 'restore'
    Install-Hook -HookPath $postRewriteHook -ScriptPath $ScriptPath -Action 'restore'
    Install-Hook -HookPath $postCheckoutHook -ScriptPath $ScriptPath -Action 'restore'
    Install-PreCommitHook -HookPath $preCommitHook -ScriptPath $ScriptPath
    Install-PostCommitBackupHook -HookPath $postCommitHook -ScriptPath $ScriptPath

    Write-Info 'Hook installati: .git/hooks/pre-commit, .git/hooks/post-merge, .git/hooks/post-rewrite, .git/hooks/post-checkout, .git/hooks/post-commit'
    Write-Info 'Dopo pull/merge/rebase/checkout, i file protetti verranno ripristinati automaticamente.'
    Write-Info 'I commit che toccano file protetti vengono bloccati (override esplicito con ALLOW_PROTECTED_CHANGES=1).'
    Write-Info "Backup locale automatico: bundle ogni $(Get-AutoBackupEveryCommits) commit (override env: VSC_AUTO_BACKUP_EVERY_COMMITS)."
}

try {
    $repoRoot = Get-RepoRoot
    $scriptPath = Join-Path $repoRoot 'protect-google-sync-local.ps1'
    $storeDir = Join-Path $repoRoot '.local/protected-google-sync'
    $files = Get-ProtectedFiles

    switch ($Action) {
        'snapshot' {
            Invoke-Snapshot -RepoRoot $repoRoot -StoreDir $storeDir -Files $files
        }
        'restore' {
            Invoke-Restore -RepoRoot $repoRoot -StoreDir $storeDir -Files $files
        }
        'install-hooks' {
            Invoke-InstallHooks -RepoRoot $repoRoot -ScriptPath $scriptPath
        }
        'verify' {
            Invoke-Verify -RepoRoot $repoRoot -Files $files
        }
        'auto-backup' {
            Invoke-AutoBackup -RepoRoot $repoRoot
        }
        'status' {
            Write-Info 'File protetti:'
            $files | ForEach-Object { Write-Info " - $_" }
            Write-Info "Cartella snapshot: $storeDir"

            $manifestPath = Join-Path $storeDir 'protected-files.txt'
            if (Test-Path $manifestPath) {
                Write-Info 'Snapshot: presente'
            } else {
                Write-Info 'Snapshot: assente (esegui -Action snapshot)'
            }

            $postMergeHook = Join-Path $repoRoot '.git/hooks/post-merge'
            $postRewriteHook = Join-Path $repoRoot '.git/hooks/post-rewrite'
            $postCheckoutHook = Join-Path $repoRoot '.git/hooks/post-checkout'
            $preCommitHook = Join-Path $repoRoot '.git/hooks/pre-commit'
            $postCommitHook = Join-Path $repoRoot '.git/hooks/post-commit'
            Write-Info ("Hook post-merge: " + (Test-Path $postMergeHook))
            Write-Info ("Hook post-rewrite: " + (Test-Path $postRewriteHook))
            Write-Info ("Hook post-checkout: " + (Test-Path $postCheckoutHook))
            Write-Info ("Hook pre-commit (blocco file protetti): " + (Test-Path $preCommitHook))
            Write-Info ("Hook post-commit (auto-backup bundle): " + (Test-Path $postCommitHook))
            Write-Info ("Soglia backup automatico commit: " + (Get-AutoBackupEveryCommits))
        }
    }
} catch {
    Write-Error $_
    exit 1
}
