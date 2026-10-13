[CmdletBinding()]
param(
    [string]$Remote = 'origin',
    [string]$Branch = ''
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

function Invoke-GitChecked {
    param([Parameter(Mandatory = $true)][string[]]$GitArgs)

    $output = & git @GitArgs 2>&1
    $exitCode = $LASTEXITCODE
    foreach ($line in $output) {
        Write-Host ([string]$line)
    }
    if ($exitCode -ne 0) {
        throw "git $($GitArgs -join ' ') è terminato con codice $exitCode."
    }
}

function Get-GitValue {
    param([Parameter(Mandatory = $true)][string[]]$GitArgs)

    $output = & git @GitArgs 2>$null
    if ($LASTEXITCODE -ne 0) {
        return ''
    }
    return (($output | ForEach-Object { [string]$_ }) -join "`n").Trim()
}

$stashRef = ''
$restoreAttempted = $false

try {
    if (-not (Get-GitValue -GitArgs @('rev-parse', '--show-toplevel'))) {
        throw 'La cartella corrente non appartiene a un repository Git valido.'
    }

    if ([string]::IsNullOrWhiteSpace($Branch)) {
        $Branch = Get-GitValue -GitArgs @('branch', '--show-current')
    }
    if ([string]::IsNullOrWhiteSpace($Branch)) {
        throw 'Branch non determinabile: il repository potrebbe essere in detached HEAD.'
    }

    Write-Host "Branch locale: $Branch" -ForegroundColor Cyan
    Write-Host "Aggiorno i riferimenti remoti con git fetch $Remote --prune..." -ForegroundColor Cyan
    Invoke-GitChecked -GitArgs @('fetch', $Remote, '--prune')

    $remoteRef = "refs/remotes/$Remote/$Branch"
    if (-not (Get-GitValue -GitArgs @('rev-parse', '--verify', $remoteRef))) {
        throw "Il branch remoto '$Remote/$Branch' non esiste dopo il fetch. Nessuna modifica locale è stata spostata."
    }

    $localChanges = Get-GitValue -GitArgs @('status', '--porcelain', '--untracked-files=all')
    if ($localChanges) {
        # stash already captures staged and unstaged tracked edits; avoid staging
        # everything with git add because that would alter the user's index.
        $stashBefore = Get-GitValue -GitArgs @('rev-parse', '--verify', 'refs/stash')
        $stamp = Get-Date -Format 'yyyy-MM-dd_HH-mm-ss'
        $stashMessage = "pre-pull-$Branch-$stamp"

        Write-Host 'Salvo modifiche tracciate e file non tracciati con git stash push -u...' -ForegroundColor Yellow
        Invoke-GitChecked -GitArgs @('stash', 'push', '--include-untracked', '--message', $stashMessage)

        $stashAfter = Get-GitValue -GitArgs @('rev-parse', '--verify', 'refs/stash')
        if (-not $stashAfter -or $stashAfter -eq $stashBefore) {
            throw 'Git non ha creato lo stash atteso; interrompo il pull per proteggere le modifiche locali.'
        }
        $stashRef = $stashAfter
    } else {
        Write-Host 'Working tree pulito: non serve creare uno stash.' -ForegroundColor Green
    }

    Write-Host "Integro $Remote/$Branch con git pull --ff-only..." -ForegroundColor Cyan
    Invoke-GitChecked -GitArgs @('pull', '--ff-only', '--no-rebase', $Remote, $Branch)

    if ($stashRef) {
        $restoreAttempted = $true
        Write-Host 'Ripristino le modifiche locali salvate nello stash...' -ForegroundColor Cyan
        Invoke-GitChecked -GitArgs @('stash', 'pop', '--index', $stashRef)
        $stashRef = ''
    }

    Write-Host 'Stato finale:' -ForegroundColor Cyan
    Invoke-GitChecked -GitArgs @('status', '--short', '--branch')
    Invoke-GitChecked -GitArgs @('log', '-1', '--oneline', '--decorate')
    Write-Host 'PULL completato.' -ForegroundColor Green
    exit 0
} catch {
    $failureMessage = $_.Exception.Message

    if ($stashRef -and -not $restoreAttempted) {
        $restoreAttempted = $true
        Write-Host 'Il pull non è riuscito: provo a ripristinare le modifiche locali salvate.' -ForegroundColor Yellow
        try {
            Invoke-GitChecked -GitArgs @('stash', 'pop', '--index', $stashRef)
            $stashRef = ''
        } catch {
            $failureMessage += " Ripristino automatico non riuscito: $($_.Exception.Message)"
        }
    }

    if ($stashRef) {
        Write-Error "$failureMessage Lo stash è conservato (commit $stashRef); non eliminarlo finché non hai verificato i file."
    } else {
        Write-Error $failureMessage
    }
    exit 1
}
