param(
    [Parameter(Mandatory = $false)]
    [string]$CommitMessage = ''
)

$ErrorActionPreference = 'Stop'

function Remove-StaleGitLock {
    $gitDir = (& git rev-parse --git-dir 2>$null)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($gitDir)) {
        return
    }

    $lockPath = Join-Path (Get-Location).Path $gitDir | Join-Path -ChildPath 'index.lock'
    if (-not (Test-Path $lockPath)) {
        return
    }

    $gitProcesses = @(Get-Process git -ErrorAction SilentlyContinue)
    if ($gitProcesses.Count -gt 0) {
        Write-Warning "Rilevato un processo Git attivo; non rimuovo il lock per evitare di corrompere l'operazione in corso."
        return
    }

    Remove-Item $lockPath -Force -ErrorAction Stop
    Write-Host "Rimosso lock Git stale: $lockPath"
}

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args
    )

    & git @Args
    if ($LASTEXITCODE -ne 0) {
        throw "Comando git fallito: git $($Args -join ' ')"
    }
}

function Get-WorkingTreeStatus {
    $status = @(& git status --porcelain)
    if ($LASTEXITCODE -ne 0) {
        throw 'Impossibile leggere git status --porcelain'
    }

    return $status
}

function Get-CommitCounts {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RemoteRef
    )

    $raw = (& git rev-list --left-right --count "HEAD...$RemoteRef").Trim()
    if ($LASTEXITCODE -ne 0 -or $raw -notmatch '^\d+\s+\d+$') {
        throw "Impossibile confrontare HEAD con $RemoteRef"
    }

    $parts = $raw -split '\s+'
    return [pscustomobject]@{
        Ahead  = [int]$parts[0]
        Behind = [int]$parts[1]
    }
}

try {
    Invoke-Git -Args @('rev-parse', '--is-inside-work-tree') | Out-Null
    Remove-StaleGitLock

    $currentBranch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentBranch)) {
        throw 'Impossibile determinare il branch corrente: il repository potrebbe essere in detached HEAD.'
    }

    Invoke-Git -Args @('remote', 'get-url', 'origin') | Out-Null
    Write-Host "Branch locale: $currentBranch"
    Write-Host 'Aggiornamento riferimenti remoti (git fetch origin)...'
    Invoke-Git -Args @('fetch', 'origin')

    $remoteRef = "origin/$currentBranch"
    & git show-ref --verify --quiet "refs/remotes/$remoteRef"
    $remoteBranchExists = ($LASTEXITCODE -eq 0)
    $hasStash = $false

    if ($LASTEXITCODE -eq 0) {
        $counts = Get-CommitCounts -RemoteRef $remoteRef
        if ($counts.Behind -gt 0) {
            $statusBeforeSync = Get-WorkingTreeStatus
            if ($statusBeforeSync.Count -gt 0) {
                $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
                Write-Host "Origin è avanti di $($counts.Behind) commit: salvo temporaneamente le modifiche nello stash..."
                Invoke-Git -Args @('stash', 'push', '-u', '-m', "pre-push-sync $currentBranch $stamp")
                $hasStash = $true
            }

            Write-Host "Riallineamento locale con $remoteRef (pull --rebase)..."
            Invoke-Git -Args @('pull', '--rebase', 'origin', $currentBranch)

            if ($hasStash) {
                Write-Host 'Ripristino delle modifiche locali dallo stash...'
                Invoke-Git -Args @('stash', 'pop')
                $hasStash = $false
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
    Invoke-Git -Args @('add', '-A')

    $status = Get-WorkingTreeStatus

    if ($status.Count -gt 0) {
        Write-Host "Commit: $CommitMessage"
        Invoke-Git -Args @('commit', '-m', $CommitMessage)
    } else {
        Write-Host 'Nessuna modifica da committare.'
    }

    if ($remoteBranchExists -and (Get-CommitCounts -RemoteRef $remoteRef).Ahead -gt 0) {
        Write-Host "Push su origin/$currentBranch..."
        Invoke-Git -Args @('push', '-u', 'origin', $currentBranch)
    } else {
        if (-not $remoteBranchExists) {
            Write-Host "Push iniziale con -u origin $currentBranch..."
            Invoke-Git -Args @('push', '-u', 'origin', $currentBranch)
        } else {
            Write-Host 'Nessun push necessario: branch già allineati.'
        }
    }

    Invoke-Git -Args @('fetch', 'origin', $currentBranch)
    $finalCounts = Get-CommitCounts -RemoteRef "origin/$currentBranch"
    if ($finalCounts.Ahead -ne 0 -or $finalCounts.Behind -ne 0) {
        throw "Allineamento finale non riuscito: locale avanti $($finalCounts.Ahead), indietro $($finalCounts.Behind)."
    }

    Write-Host 'Operazione completata: sync + stash opzionale + add + commit + push.'
} catch {
    if ($hasStash) {
        Write-Warning 'Lo stash temporaneo è stato mantenuto per sicurezza: usare git stash list e git stash pop dopo aver risolto il problema.'
    }
    Write-Error $_
    exit 1
}
