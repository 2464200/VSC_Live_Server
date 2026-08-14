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

try {
    Invoke-Git -Args @('rev-parse', '--is-inside-work-tree') | Out-Null
    Remove-StaleGitLock

    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
        $CommitMessage = "chore: auto commit $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }

    Write-Host 'Staging modifiche (git add -A)...'
    Invoke-Git -Args @('add', '-A')

    $status = (& git status --porcelain)
    if ($LASTEXITCODE -ne 0) {
        throw 'Impossibile leggere git status --porcelain'
    }

    if (-not $status) {
        Write-Host 'Nessuna modifica da committare.'
        exit 0
    }

    Write-Host "Commit: $CommitMessage"
    Invoke-Git -Args @('commit', '-m', $CommitMessage)

    $currentBranch = (& git branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($currentBranch)) {
        throw 'Impossibile determinare il branch corrente.'
    }

    $upstream = & git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null
    $hasUpstream = ($LASTEXITCODE -eq 0) -and (-not [string]::IsNullOrWhiteSpace($upstream))

    if ($hasUpstream) {
        Write-Host "Push su upstream esistente ($($upstream.Trim()))..."
        Invoke-Git -Args @('push')
    } else {
        Write-Host "Nessun upstream configurato. Push con -u origin $currentBranch..."
        Invoke-Git -Args @('push', '-u', 'origin', $currentBranch)
    }

    Write-Host 'Operazione completata: add + commit + push.'
} catch {
    Write-Error $_
    exit 1
}
