param(
    [string]$Branch = 'develop',
    [string]$Remote = 'origin',
    [string]$PatchPath = '.local/my-fix.patch'
)

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Args,
        [switch]$AllowFailure
    )

    & git @Args
    $exitCode = $LASTEXITCODE

    if (-not $AllowFailure -and $exitCode -ne 0) {
        throw "Comando git fallito: git $($Args -join ' ')"
    }

    return $exitCode
}

try {
    Invoke-Git -Args @('rev-parse', '--is-inside-work-tree') | Out-Null

    $repoRoot = (& git rev-parse --show-toplevel).Trim()
    if ([string]::IsNullOrWhiteSpace($repoRoot)) {
        throw 'Impossibile determinare la root del repository.'
    }

    $fullPatchPath = Join-Path $repoRoot $PatchPath

    if (-not (Test-Path $fullPatchPath)) {
        throw "Patch locale non trovata: $fullPatchPath`nCrea il file patch (esempio): git diff -- script.js > .local/my-fix.patch"
    }

    $status = (& git status --porcelain)
    if ($LASTEXITCODE -ne 0) {
        throw 'Impossibile leggere git status --porcelain'
    }

    $didStash = $false
    if (-not [string]::IsNullOrWhiteSpace($status)) {
        Write-Host 'Workspace non pulito: salvo temporaneamente con git stash push -u...'
        Invoke-Git -Args @('stash', 'push', '-u', '-m', 'auto-stash before safe pull develop') | Out-Null
        $didStash = $true
    }

    Write-Host "Checkout branch $Branch..."
    Invoke-Git -Args @('checkout', $Branch) | Out-Null

    Write-Host "Pull da $Remote/$Branch..."
    Invoke-Git -Args @('pull', $Remote, $Branch) | Out-Null

    Write-Host "Riapplico patch locale: $PatchPath"
    $applyExit = Invoke-Git -Args @('apply', '--reject', '--whitespace=nowarn', $fullPatchPath) -AllowFailure

    if ($applyExit -eq 0) {
        Write-Host 'Patch applicata correttamente.'
    } else {
        Write-Warning 'Patch non applicata in modo pulito. Controlla eventuali file .rej prima di continuare.'
    }

    if ($didStash) {
        Write-Host 'Ripristino modifiche precedenti dallo stash...'
        $stashPopExit = Invoke-Git -Args @('stash', 'pop') -AllowFailure
        if ($stashPopExit -ne 0) {
            Write-Warning 'git stash pop ha generato conflitti. Risolvili e poi prosegui con git status.'
        }
    }

    Write-Host 'Safe pull completato.'
} catch {
    Write-Error $_
    exit 1
}
