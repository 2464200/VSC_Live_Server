param(
    [ValidateSet('snapshot', 'restore', 'install-hooks', 'status')]
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
        'Bordero/pages/videoclip.html'
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

function Invoke-InstallHooks([string]$RepoRoot, [string]$ScriptPath) {
    $hooksDir = Join-Path $RepoRoot '.git/hooks'
    New-DirIfMissing $hooksDir

    $postMergeHook = Join-Path $hooksDir 'post-merge'
    $postRewriteHook = Join-Path $hooksDir 'post-rewrite'
    $postCommitHook = Join-Path $hooksDir 'post-commit'

    Install-Hook -HookPath $postMergeHook -ScriptPath $ScriptPath -Action 'restore'
    Install-Hook -HookPath $postRewriteHook -ScriptPath $ScriptPath -Action 'restore'
    Install-Hook -HookPath $postCommitHook -ScriptPath $ScriptPath -Action 'snapshot'

    Write-Info 'Hook installati: .git/hooks/post-merge, .git/hooks/post-rewrite, .git/hooks/post-commit'
    Write-Info 'Dopo pull/merge/rebase, i file protetti verranno ripristinati automaticamente.'
    Write-Info 'Dopo ogni commit, lo snapshot locale verra aggiornato automaticamente.'
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
            $postCommitHook = Join-Path $repoRoot '.git/hooks/post-commit'
            Write-Info ("Hook post-merge: " + (Test-Path $postMergeHook))
            Write-Info ("Hook post-rewrite: " + (Test-Path $postRewriteHook))
            Write-Info ("Hook post-commit (auto-snapshot): " + (Test-Path $postCommitHook))
        }
    }
} catch {
    Write-Error $_
    exit 1
}
