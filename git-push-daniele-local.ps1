param(
    [string]$CommitMessage = "chore: sync daniele-local updates"
)

$ErrorActionPreference = 'Stop'

$repoRoot = (Get-Location).Path
try {
    git -C $repoRoot rev-parse --is-inside-work-tree | Out-Null
}
catch {
    Write-Error "Questo script deve essere eseguito dentro la cartella del repository Git."
    exit 1
}

$currentBranch = git -C $repoRoot branch --show-current
if ($LASTEXITCODE -ne 0) {
    Write-Error "Impossibile leggere il ramo attuale."
    exit 1
}

if ($currentBranch -ne 'daniele-local') {
    Write-Host "Ti porto sul ramo daniele-local prima del push..."
    git -C $repoRoot switch daniele-local
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Il ramo daniele-local non esiste o non e' possibile attivarlo."
        exit 1
    }
}

$status = git -C $repoRoot status --porcelain
if (-not $status) {
    Write-Host "Nessuna modifica da commitare. Solo controllo del ramo: daniele-local."
    git -C $repoRoot status --short --branch
    exit 0
}

git -C $repoRoot add -A
if ($LASTEXITCODE -ne 0) {
    Write-Error "Errore durante git add -A."
    exit 1
}

git -C $repoRoot commit -m $CommitMessage
if ($LASTEXITCODE -ne 0) {
    Write-Error "Commit fallito; nessun push eseguito."
    exit 1
}

git -C $repoRoot push origin daniele-local
if ($LASTEXITCODE -ne 0) {
    Write-Error "Push su origin/daniele-local fallito."
    exit 1
}

Write-Host "Push completato su daniele-local. Main non e' stato toccato."
