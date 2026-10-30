param(
    [Parameter(Mandatory = $false)]
    [string]$CommitMessage = ''
)

$ErrorActionPreference = 'Stop'
$stashRef = ''
$stashRestoreAttempted = $false
$rebaseStarted = $false
$rebaseNeedsRecovery = $false

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArgs
    )

    & git @GitArgs
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Comando git fallito (codice $exitCode): git $($GitArgs -join ' ')"
    }
}

function Get-GitValue {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$GitArgs
    )

    $previousErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $value = (& git @GitArgs 2>&1)
        $exitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -ne 0) {
        return ''
    }
    return (($value | ForEach-Object { [string]$_ }) -join "`n").Trim()
}

function Get-StashReference {
    param([Parameter(Mandatory = $true)][string]$StashCommit)

    $entries = & git stash list '--format=%gd %H' 2>&1
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "Impossibile trovare il riferimento Git stash (codice $exitCode)."
    }

    foreach ($entry in $entries) {
        $parts = ([string]$entry).Trim() -split '\s+', 2
        if ($parts.Count -eq 2 -and $parts[1] -eq $StashCommit) {
            return $parts[0]
        }
    }

    return ''
}

function Remove-StaleGitLock {
    $lockPath = Get-GitValue -GitArgs @('rev-parse', '--git-path', 'index.lock')
    if (-not $lockPath) { return }

    if (-not [System.IO.Path]::IsPathRooted($lockPath)) {
        $lockPath = Join-Path (Get-Location).Path $lockPath
    }
    if (-not (Test-Path -LiteralPath $lockPath)) { return }

    $gitProcesses = @(Get-Process git -ErrorAction SilentlyContinue)
    if ($gitProcesses.Count -gt 0) {
        throw "Esiste index.lock e risulta attivo git.exe: attendo la fine dell'operazione Git per evitare corruzioni."
    }

    $lock = Get-Item -LiteralPath $lockPath -ErrorAction Stop
    $lockAge = (Get-Date) - $lock.LastWriteTime
    if ($lockAge.TotalMinutes -lt 2) {
        throw "Esiste un index.lock recente ($lockPath). Riprova tra qualche minuto; non lo rimuovo mentre potrebbe essere in uso."
    }

    Remove-Item -LiteralPath $lockPath -Force -ErrorAction Stop
    Write-Host "Rimosso lock Git inattivo da oltre due minuti: $lockPath" -ForegroundColor Yellow
}

function Get-WorkingTreeStatus {
    $status = @(& git status --porcelain --untracked-files=all)
    if ($LASTEXITCODE -ne 0) {
        throw 'Impossibile leggere git status --porcelain.'
    }
    return $status
}

function Get-CommitCounts {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemoteRef
    )

    $raw = Get-GitValue -GitArgs @('rev-list', '--left-right', '--count', "HEAD...$RemoteRef")
    if ($raw -notmatch '^\d+\s+\d+$') {
        throw "Impossibile confrontare HEAD con $RemoteRef."
    }

    $parts = $raw -split '\s+'
    return [pscustomobject]@{
        Ahead  = [int]$parts[0]
        Behind = [int]$parts[1]
    }
}

try {
    if (-not (Get-GitValue -GitArgs @('rev-parse', '--is-inside-work-tree'))) {
        throw 'La cartella corrente non appartiene a un repository Git valido.'
    }
    Remove-StaleGitLock

    $currentBranch = Get-GitValue -GitArgs @('branch', '--show-current')
    if ([string]::IsNullOrWhiteSpace($currentBranch)) {
        throw 'Impossibile determinare il branch corrente: il repository potrebbe essere in detached HEAD.'
    }

    Invoke-Git -GitArgs @('remote', 'get-url', 'origin') | Out-Null
    Write-Host "Branch locale: $currentBranch"
    Write-Host 'Aggiornamento riferimenti remoti (git fetch origin --prune)...'
    Invoke-Git -GitArgs @('fetch', 'origin', '--prune')

    $remoteRef = "origin/$currentBranch"
    $remoteBranchExists = [bool](Get-GitValue -GitArgs @('rev-parse', '--verify', "refs/remotes/$remoteRef"))
    $counts = $null

    if ($remoteBranchExists) {
        $counts = Get-CommitCounts -RemoteRef $remoteRef

        if ($counts.Behind -gt 0) {
            $statusBeforeSync = Get-WorkingTreeStatus
            if ($statusBeforeSync.Count -gt 0) {
                # Stash preserves staged and unstaged edits; avoid changing the
                # user's index with an unnecessary git add before synchronization.
                $stashBefore = Get-GitValue -GitArgs @('rev-parse', '--verify', 'refs/stash')
                $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
                Write-Host "Origin è avanti di $($counts.Behind) commit: salvo le modifiche nello stash..."
                try {
                    Invoke-Git -GitArgs @('stash', 'push', '--include-untracked', '--message', "pre-push-sync-$currentBranch-$stamp")
                } finally {
                    $stashAfter = Get-GitValue -GitArgs @('rev-parse', '--verify', 'refs/stash')
                    if ($stashAfter -and $stashAfter -ne $stashBefore) {
                        $stashRef = $stashAfter
                    }
                }
                if (-not $stashRef) {
                    throw 'Git non ha creato lo stash atteso; interrompo il riallineamento per proteggere le modifiche locali.'
                }
                $stashRef = Get-StashReference -StashCommit $stashRef
                if (-not $stashRef) {
                    throw 'Creato lo stash, ma non è stato possibile risolverne il riferimento.'
                }
            }

            Write-Host "Riallineamento locale con $remoteRef (pull --rebase)..."
            $rebaseStarted = $true
            Invoke-Git -GitArgs @('pull', '--rebase', 'origin', $currentBranch)
            $rebaseStarted = $false

            if ($stashRef) {
                $stashRestoreAttempted = $true
                Write-Host 'Ripristino le modifiche locali dallo stash...'
                Invoke-Git -GitArgs @('stash', 'pop', '--index', $stashRef)
                $stashRef = ''
            }
        } elseif ($counts.Ahead -gt 0) {
            Write-Host "Il branch locale è avanti di $($counts.Ahead) commit rispetto a $remoteRef."
        } else {
            Write-Host "Branch locale e $remoteRef già allineati."
        }
    } else {
        Write-Host "Il branch remoto $remoteRef non esiste ancora: verrà creato con il push."
    }

    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
        $CommitMessage = "chore: auto commit $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }

    Write-Host 'Staging modifiche (git add -A)...'
    Invoke-Git -GitArgs @('add', '-A')

    $status = Get-WorkingTreeStatus
    if ($status.Count -gt 0) {
        Write-Host "Commit: $CommitMessage"
        Invoke-Git -GitArgs @('commit', '-m', $CommitMessage)
    } else {
        Write-Host 'Nessuna modifica da committare.'
    }

    if ($remoteBranchExists -and (Get-CommitCounts -RemoteRef $remoteRef).Ahead -gt 0) {
        Write-Host "Push su origin/$currentBranch..."
        Invoke-Git -GitArgs @('push', '-u', 'origin', $currentBranch)
    } elseif (-not $remoteBranchExists) {
        Write-Host "Push iniziale con -u origin $currentBranch..."
        Invoke-Git -GitArgs @('push', '-u', 'origin', $currentBranch)
    } else {
        Write-Host 'Nessun push necessario: branch già allineati.'
    }

    Invoke-Git -GitArgs @('fetch', 'origin', $currentBranch)
    $finalCounts = Get-CommitCounts -RemoteRef "origin/$currentBranch"
    if ($finalCounts.Ahead -ne 0 -or $finalCounts.Behind -ne 0) {
        throw "Allineamento finale non riuscito: locale avanti $($finalCounts.Ahead), indietro $($finalCounts.Behind)."
    }

    Write-Host 'Operazione completata: fetch + stash opzionale + add + commit + push verificato.' -ForegroundColor Green
    exit 0
} catch {
    $failureMessage = $_.Exception.Message

    if ($rebaseStarted) {
        $rebaseHead = Get-GitValue -GitArgs @('rev-parse', '--verify', '-q', 'REBASE_HEAD')
        if ($rebaseHead) {
            Write-Host 'Il rebase è rimasto in conflitto: annullo il rebase iniziato da questo task.' -ForegroundColor Yellow
            try {
                Invoke-Git -GitArgs @('rebase', '--abort')
                $rebaseStarted = $false
            } catch {
                $rebaseNeedsRecovery = $true
                $failureMessage += " Impossibile annullare il rebase: $($_.Exception.Message)"
            }
        } else {
            $rebaseStarted = $false
        }
    }

    if ($stashRef -and -not $stashRestoreAttempted -and -not $rebaseNeedsRecovery) {
        $stashRestoreAttempted = $true
        Write-Host 'Operazione interrotta: provo a ripristinare le modifiche locali salvate nello stash.' -ForegroundColor Yellow
        try {
            Invoke-Git -GitArgs @('stash', 'pop', '--index', $stashRef)
            $stashRef = ''
        } catch {
            $failureMessage += " Ripristino dello stash non riuscito: $($_.Exception.Message)"
        }
    }

    if ($rebaseNeedsRecovery) {
        Write-Error "$failureMessage Il repository è in stato di rebase: risolvi o annulla il rebase prima di ripristinare lo stash $stashRef."
    } elseif ($stashRef) {
        Write-Error "$failureMessage Lo stash è conservato (commit $stashRef); non eliminarlo finché non hai verificato i file."
    } else {
        Write-Error $failureMessage
    }
    exit 1
}
